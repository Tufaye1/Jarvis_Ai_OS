"""Planner service: today's dashboard.

Pure DB logic -- no LLM call. Ranking rules are a fixed contract shared with
the frontend, so any change here has to be coordinated with /planner
consumers.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db import async_session
from app.tasks.models import STATUS_DOING, STATUS_DONE, STATUS_TODO, Task


def _naive_midnight(d: date) -> datetime:
    """Naive datetime at 00:00 on `d` -- matches how tasks store timestamps."""
    return datetime.combine(d, datetime.min.time())


async def today(session_factory: async_sessionmaker = async_session) -> dict[str, Any]:
    """Return today's planner dashboard.

    Buckets returned (each a list of Task rows serialized as dicts):
        priorities       -- top 3 by the ranking rules below.
        overdue          -- not done AND due_at < today.
        due_today        -- not done AND due_at is today.
        in_progress      -- status='doing', not already in overdue/due_today.
        completed_today  -- status='done' AND completed_at is today.

    Ranking for `priorities` (cap 3, dedup across buckets):
        1) doing AND overdue
        2) overdue
        3) due_today
        4) doing (not already ranked)
        5) todo, oldest first
    Within equal priority: `due_at ASC NULLS LAST, id ASC`.
    """
    # One "now" for the whole call -- avoids the ranking flipping mid-query.
    today_date = datetime.now(tz=UTC).date()
    today_start = _naive_midnight(today_date)
    tomorrow_start = _naive_midnight(today_date + timedelta(days=1))

    async with session_factory() as session:
        # `due_at ASC NULLS LAST, id ASC` is the tiebreaker for every bucket.
        base_order = (Task.due_at.asc().nulls_last(), Task.id.asc())

        overdue_rows = list(
            await session.scalars(
                select(Task)
                .where(
                    Task.status != STATUS_DONE,
                    Task.due_at.is_not(None),
                    Task.due_at < today_start,
                )
                .order_by(*base_order)
            )
        )
        due_today_rows = list(
            await session.scalars(
                select(Task)
                .where(
                    Task.status != STATUS_DONE,
                    Task.due_at >= today_start,
                    Task.due_at < tomorrow_start,
                )
                .order_by(*base_order)
            )
        )
        # completed_today: any task done today, regardless of when it was due.
        completed_today_rows = list(
            await session.scalars(
                select(Task)
                .where(
                    Task.status == STATUS_DONE,
                    Task.completed_at.is_not(None),
                    Task.completed_at >= today_start,
                    Task.completed_at < tomorrow_start,
                )
                .order_by(Task.completed_at.desc(), Task.id.desc())
            )
        )

        overdue_ids = {t.id for t in overdue_rows}
        due_today_ids = {t.id for t in due_today_rows}

        # in_progress excludes anything already surfaced as overdue/due_today,
        # so the UI can render the four "not done" buckets side-by-side
        # without duplication.
        all_doing_rows = list(
            await session.scalars(
                select(Task)
                .where(Task.status == STATUS_DOING)
                .order_by(*base_order)
            )
        )
        in_progress_rows = [
            t for t in all_doing_rows
            if t.id not in overdue_ids and t.id not in due_today_ids
        ]

        # ---- priorities ranking -------------------------------------------
        priorities: list[Task] = []
        seen: set[int] = set()

        def add(rows: list[Task]) -> None:
            for row in rows:
                if len(priorities) >= 3:
                    return
                if row.id in seen:
                    continue
                seen.add(row.id)
                priorities.append(row)

        # 1) doing AND overdue
        doing_overdue = [t for t in overdue_rows if t.status == STATUS_DOING]
        add(doing_overdue)
        # 2) overdue (any non-done)
        add(overdue_rows)
        # 3) due_today (any non-done)
        add(due_today_rows)
        # 4) doing (not overdue) -- everything from all_doing_rows we haven't
        #    already picked up. due_today doing tasks come along via seen-set.
        add(all_doing_rows)
        # 5) todo, oldest first
        if len(priorities) < 3:
            todo_rows = list(
                await session.scalars(
                    select(Task)
                    .where(Task.status == STATUS_TODO)
                    .order_by(Task.created_at.asc(), Task.id.asc())
                )
            )
            add(todo_rows)

    def serialize(rows: list[Task]) -> list[dict[str, Any]]:
        return [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "project_id": t.project_id,
                "status": t.status,
                "due_at": t.due_at,
                "completed_at": t.completed_at,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
            }
            for t in rows
        ]

    return {
        "date": today_date,
        "priorities": serialize(priorities),
        "overdue": serialize(overdue_rows),
        "due_today": serialize(due_today_rows),
        "in_progress": serialize(in_progress_rows),
        "completed_today": serialize(completed_today_rows),
    }


# Re-export a couple of helpers so tests can build fixtures without duplicating
# the naive-midnight convention.
__all__ = ["today", "_naive_midnight"]
