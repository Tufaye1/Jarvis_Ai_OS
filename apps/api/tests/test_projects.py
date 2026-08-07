"""Integration tests for the Projects volume (service + HTTP router).

Runs against the same shared local Postgres as the rest of the suite. All
created rows are tracked via the `cleanup_projects` / `cleanup_tasks` /
`cleanup_memories` fixtures so nothing leaks between test runs.

Memories are inserted directly through the session (with `embedding=None`,
which the column allows) to avoid the fastembed model download that the
memory service would otherwise trigger.
"""

import uuid

import pytest

from app.base import init_models
from app.db import async_session, engine
from app.memory.models import SCOPE_PROJECT, Memory
from app.projects.models import STATUS_ACTIVE, STATUS_ARCHIVED, Project
from app.tasks.models import STATUS_DOING, STATUS_DONE, STATUS_TODO, Task


async def test_create_project_route_returns_active_row(
    ensure_db, cleanup_projects, api_client
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    response = await api_client.post(
        "/projects",
        json={"name": f"jarvis-{unique}", "description": "the assistant"},
    )
    assert response.status_code == 201
    body = response.json()
    cleanup_projects.append(body["id"])

    assert body["name"] == f"jarvis-{unique}"
    assert body["description"] == "the assistant"
    assert body["status"] == STATUS_ACTIVE
    assert body["created_at"] is not None


async def test_list_projects_defaults_to_active_and_supports_archived_filter(
    ensure_db, cleanup_projects, api_client
):
    """`GET /projects` returns only active rows unless `status=archived` is passed."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    active = await api_client.post(
        "/projects", json={"name": f"active-{unique}"}
    )
    archived = await api_client.post(
        "/projects", json={"name": f"archived-{unique}"}
    )
    assert active.status_code == 201 and archived.status_code == 201
    active_id = active.json()["id"]
    archived_id = archived.json()["id"]
    cleanup_projects.extend([active_id, archived_id])

    patched = await api_client.patch(
        f"/projects/{archived_id}", json={"status": STATUS_ARCHIVED}
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == STATUS_ARCHIVED

    # Default filter (active). Other tests share the DB, so we assert
    # inclusion/exclusion of our two rows rather than exact list equality.
    default = await api_client.get("/projects")
    assert default.status_code == 200
    ids = {p["id"] for p in default.json()}
    assert active_id in ids
    assert archived_id not in ids

    archived_only = await api_client.get("/projects", params={"status": "archived"})
    assert archived_only.status_code == 200
    ids_archived = {p["id"] for p in archived_only.json()}
    assert archived_id in ids_archived
    assert active_id not in ids_archived


async def test_get_project_detail_returns_cross_volume_counts(
    ensure_db,
    cleanup_projects,
    cleanup_tasks,
    cleanup_memories,
    api_client,
):
    """Detail endpoint sums 2 open + 1 done tasks and 1 name-matched memory."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    project_name = f"counted-{unique}"
    created = await api_client.post("/projects", json={"name": project_name})
    assert created.status_code == 201
    pid = created.json()["id"]
    cleanup_projects.append(pid)

    # 2 open tasks (one todo, one doing), 1 done task, and one unrelated task
    # that should NOT count.
    async with async_session() as session:
        todo = Task(title=f"todo {unique}", project_id=pid, status=STATUS_TODO)
        doing = Task(title=f"doing {unique}", project_id=pid, status=STATUS_DOING)
        done = Task(title=f"done {unique}", project_id=pid, status=STATUS_DONE)
        other = Task(title=f"other {unique}", status=STATUS_TODO)  # no project_id
        session.add_all([todo, doing, done, other])

        # Memory attributed by NAME, matching project_name.
        matching = Memory(
            scope=SCOPE_PROJECT,
            project=project_name,
            content=f"remembered fact {unique}",
            embedding=None,
        )
        # And an unrelated memory that should NOT count.
        unrelated = Memory(
            scope=SCOPE_PROJECT,
            project=f"other-{unique}",
            content=f"unrelated fact {unique}",
            embedding=None,
        )
        session.add_all([matching, unrelated])
        await session.commit()
        await session.refresh(todo)
        await session.refresh(doing)
        await session.refresh(done)
        await session.refresh(other)
        await session.refresh(matching)
        await session.refresh(unrelated)

    cleanup_tasks.extend([todo.id, doing.id, done.id, other.id])
    cleanup_memories.extend([matching.id, unrelated.id])

    response = await api_client.get(f"/projects/{pid}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == pid
    assert body["name"] == project_name
    assert body["counts"] == {"tasks_open": 2, "tasks_done": 1, "memories": 1}


async def test_get_project_detail_missing_returns_404(ensure_db, api_client):
    await init_models(engine)
    response = await api_client.get("/projects/2147483000")
    assert response.status_code == 404


async def test_patch_project_name_and_status(
    ensure_db, cleanup_projects, api_client
):
    """PATCH updates only the sent fields; description is preserved."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    created = await api_client.post(
        "/projects",
        json={"name": f"before-{unique}", "description": "keep me"},
    )
    assert created.status_code == 201
    pid = created.json()["id"]
    cleanup_projects.append(pid)

    response = await api_client.patch(
        f"/projects/{pid}",
        json={"name": f"after-{unique}", "status": STATUS_ARCHIVED},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == f"after-{unique}"
    assert body["status"] == STATUS_ARCHIVED
    # description was not sent -- it must survive the partial patch.
    assert body["description"] == "keep me"


async def test_patch_missing_project_returns_404(ensure_db, api_client):
    await init_models(engine)
    response = await api_client.patch(
        "/projects/2147483000", json={"name": "nope"}
    )
    assert response.status_code == 404


async def test_delete_project_nulls_task_project_id_but_keeps_tasks(
    ensure_db, cleanup_projects, cleanup_tasks, api_client
):
    """The FK is ON DELETE SET NULL, so tasks outlive the project."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    created = await api_client.post(
        "/projects", json={"name": f"doomed-{unique}"}
    )
    assert created.status_code == 201
    pid = created.json()["id"]
    cleanup_projects.append(pid)

    task_a = await api_client.post(
        "/tasks", json={"title": f"a-{unique}", "project_id": pid}
    )
    task_b = await api_client.post(
        "/tasks", json={"title": f"b-{unique}", "project_id": pid}
    )
    assert task_a.status_code == 201 and task_b.status_code == 201
    task_ids = [task_a.json()["id"], task_b.json()["id"]]
    cleanup_tasks.extend(task_ids)

    deleted = await api_client.delete(f"/projects/{pid}")
    assert deleted.status_code == 204

    # Project itself is gone.
    assert (await api_client.get(f"/projects/{pid}")).status_code == 404

    # Tasks survive with project_id nulled.
    async with async_session() as session:
        for tid in task_ids:
            row = await session.get(Task, tid)
            assert row is not None, f"task {tid} was unexpectedly deleted"
            assert row.project_id is None


async def test_delete_missing_project_returns_404(ensure_db, api_client):
    await init_models(engine)
    response = await api_client.delete("/projects/2147483000")
    assert response.status_code == 404
