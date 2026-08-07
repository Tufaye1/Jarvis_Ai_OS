"""Integration tests for the Planner volume (service + HTTP router)."""

import uuid
from datetime import UTC, datetime, timedelta

from app.base import init_models
from app.db import async_session, engine
from app.planner.service import _naive_midnight
from app.tasks.models import STATUS_DOING, STATUS_TODO, Task


async def test_today_returns_empty_bucketed_lists_on_empty_state(
    ensure_db, api_client
):
    """No tasks eligible for a bucket means [], never null or 500.

    The endpoint MUST return a well-formed body with every bucket present as
    a list, so the frontend can safely render `.map()` without a null check.
    """
    await init_models(engine)

    response = await api_client.get("/planner/today")
    assert response.status_code == 200
    body = response.json()

    for key in ("priorities", "overdue", "due_today", "in_progress", "completed_today"):
        assert key in body, f"missing bucket {key!r} in planner response"
        assert isinstance(body[key], list), f"{key} must be a list, got {type(body[key]).__name__}"

    assert body["date"] is not None


async def test_today_priorities_ranking(
    ensure_db, cleanup_tasks, api_client
):
    """Ranking rules (top 3, dedup):
        1) doing AND overdue
        2) overdue (not doing)
        3) due_today (not doing)
        4) doing (not already ranked)
        5) todo (oldest first)

    We create one task per bucket and assert the priorities list ranks them
    in that order. Other tests share the DB, so the assertions filter down to
    the IDs this test created.
    """
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    today_date = datetime.now(tz=UTC).date()
    today_start = _naive_midnight(today_date)

    # Yesterday: overdue. Today mid-day: due_today (naive UTC, matches column).
    yesterday = today_start - timedelta(days=1)
    today_noon = today_start + timedelta(hours=12)

    async with async_session() as session:
        # Rank 1: doing AND overdue.
        doing_overdue = Task(
            title=f"doing+overdue {unique}",
            status=STATUS_DOING,
            due_at=yesterday,
        )
        # Rank 2: overdue (not doing).
        overdue_todo = Task(
            title=f"overdue {unique}",
            status=STATUS_TODO,
            due_at=yesterday,
        )
        # Rank 3: due_today (not doing).
        due_today_todo = Task(
            title=f"due-today {unique}",
            status=STATUS_TODO,
            due_at=today_noon,
        )
        # Rank 4: doing, not overdue and not due today (no due date at all).
        doing_only = Task(
            title=f"doing {unique}",
            status=STATUS_DOING,
            due_at=None,
        )
        # Rank 5: todo, no due date -- shouldn't make the top 3.
        plain_todo = Task(
            title=f"plain-todo {unique}",
            status=STATUS_TODO,
            due_at=None,
        )
        session.add_all(
            [doing_overdue, overdue_todo, due_today_todo, doing_only, plain_todo]
        )
        await session.commit()
        for row in (doing_overdue, overdue_todo, due_today_todo, doing_only, plain_todo):
            await session.refresh(row)

    our_ids = [
        doing_overdue.id,
        overdue_todo.id,
        due_today_todo.id,
        doing_only.id,
        plain_todo.id,
    ]
    cleanup_tasks.extend(our_ids)
    our_set = set(our_ids)

    response = await api_client.get("/planner/today")
    assert response.status_code == 200
    body = response.json()

    # Priorities is capped at 3 globally. Filter to only tasks we created and
    # assert relative order matches the ranking rules.
    prio_ids = [t["id"] for t in body["priorities"] if t["id"] in our_set]
    assert prio_ids == [doing_overdue.id, overdue_todo.id, due_today_todo.id], (
        f"expected [doing+overdue, overdue, due_today] to be the top 3 "
        f"priorities among our tasks, got {prio_ids}"
    )

    # Bucket sanity checks -- same filtering approach.
    overdue_ids = [t["id"] for t in body["overdue"] if t["id"] in our_set]
    assert overdue_ids == [doing_overdue.id, overdue_todo.id] or overdue_ids == [
        overdue_todo.id,
        doing_overdue.id,
    ], f"overdue bucket wrong: {overdue_ids}"

    due_today_ids = [t["id"] for t in body["due_today"] if t["id"] in our_set]
    assert due_today_ids == [due_today_todo.id]

    # `in_progress` excludes anything already in overdue/due_today, so
    # doing_overdue must NOT be here; doing_only must be.
    in_progress_ids = [t["id"] for t in body["in_progress"] if t["id"] in our_set]
    assert doing_only.id in in_progress_ids
    assert doing_overdue.id not in in_progress_ids


async def test_today_endpoint_is_available_without_tasks(
    ensure_db, api_client
):
    """Second empty-state guard: a fresh call in a clean state still 200s.

    Doubles as a smoke test for the router being registered and the
    response_model round-tripping without an actual task row present.
    """
    await init_models(engine)

    response = await api_client.get("/planner/today")
    assert response.status_code == 200
    body = response.json()
    assert body["priorities"] == [] or isinstance(body["priorities"], list)
    assert isinstance(body["overdue"], list)
    assert isinstance(body["due_today"], list)
    assert isinstance(body["in_progress"], list)
    assert isinstance(body["completed_today"], list)
