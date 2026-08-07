"""Integration tests for the Tasks volume (service + HTTP router)."""

import uuid

from app.base import init_models
from app.db import async_session, engine
from app.tasks.models import STATUS_DOING, STATUS_DONE, STATUS_TODO, Task


async def test_create_task_without_project(
    ensure_db, cleanup_tasks, api_client
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    response = await api_client.post(
        "/tasks", json={"title": f"solo {unique}", "description": "no project"}
    )
    assert response.status_code == 201
    body = response.json()
    cleanup_tasks.append(body["id"])

    assert body["title"] == f"solo {unique}"
    assert body["description"] == "no project"
    assert body["project_id"] is None
    assert body["status"] == STATUS_TODO
    assert body["completed_at"] is None


async def test_create_task_with_project_id(
    ensure_db, cleanup_projects, cleanup_tasks, api_client
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    project = await api_client.post(
        "/projects", json={"name": f"holds-{unique}"}
    )
    assert project.status_code == 201
    pid = project.json()["id"]
    cleanup_projects.append(pid)

    response = await api_client.post(
        "/tasks", json={"title": f"linked {unique}", "project_id": pid}
    )
    assert response.status_code == 201
    body = response.json()
    cleanup_tasks.append(body["id"])
    assert body["project_id"] == pid


async def test_list_tasks_filters_by_project_and_status(
    ensure_db, cleanup_projects, cleanup_tasks, api_client
):
    """`project_id` and `status` query params both narrow the result set."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    project = await api_client.post(
        "/projects", json={"name": f"filter-{unique}"}
    )
    assert project.status_code == 201
    pid = project.json()["id"]
    cleanup_projects.append(pid)

    todo = await api_client.post(
        "/tasks", json={"title": f"todo {unique}", "project_id": pid}
    )
    doing = await api_client.post(
        "/tasks", json={"title": f"doing {unique}", "project_id": pid}
    )
    other_project_task = await api_client.post(
        "/tasks", json={"title": f"unrelated {unique}"}
    )
    for r in (todo, doing, other_project_task):
        assert r.status_code == 201
    todo_id = todo.json()["id"]
    doing_id = doing.json()["id"]
    cleanup_tasks.extend([todo_id, doing_id, other_project_task.json()["id"]])

    # Move `doing` into status='doing' via PATCH.
    patched = await api_client.patch(
        f"/tasks/{doing_id}", json={"status": STATUS_DOING}
    )
    assert patched.status_code == 200

    # Filter by project_id -- only our two tasks (in either order).
    listed = await api_client.get("/tasks", params={"project_id": pid})
    assert listed.status_code == 200
    assert {t["id"] for t in listed.json()} == {todo_id, doing_id}

    # Filter by project_id AND status -- only the doing one.
    listed = await api_client.get(
        "/tasks", params={"project_id": pid, "status": STATUS_DOING}
    )
    assert listed.status_code == 200
    assert [t["id"] for t in listed.json()] == [doing_id]


async def test_patch_status_done_stamps_completed_at_and_reverts_clears_it(
    ensure_db, cleanup_tasks, api_client
):
    """status -> done sets completed_at; status -> todo clears it."""
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    created = await api_client.post("/tasks", json={"title": f"life {unique}"})
    assert created.status_code == 201
    tid = created.json()["id"]
    cleanup_tasks.append(tid)
    assert created.json()["completed_at"] is None

    done = await api_client.patch(f"/tasks/{tid}", json={"status": STATUS_DONE})
    assert done.status_code == 200
    done_body = done.json()
    assert done_body["status"] == STATUS_DONE
    assert done_body["completed_at"] is not None

    # Verify on the raw row too, not just the serialized response.
    async with async_session() as session:
        row = await session.get(Task, tid)
        assert row.completed_at is not None

    reverted = await api_client.patch(f"/tasks/{tid}", json={"status": STATUS_TODO})
    assert reverted.status_code == 200
    reverted_body = reverted.json()
    assert reverted_body["status"] == STATUS_TODO
    assert reverted_body["completed_at"] is None

    async with async_session() as session:
        row = await session.get(Task, tid)
        assert row.completed_at is None


async def test_patch_missing_task_returns_404(ensure_db, api_client):
    await init_models(engine)
    response = await api_client.patch(
        "/tasks/2147483000", json={"status": STATUS_DONE}
    )
    assert response.status_code == 404


async def test_delete_task_removes_row(
    ensure_db, cleanup_tasks, api_client
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    created = await api_client.post("/tasks", json={"title": f"delme {unique}"})
    assert created.status_code == 201
    tid = created.json()["id"]
    # Track for safety; the delete below should remove it, but the fixture
    # is a no-op on missing ids.
    cleanup_tasks.append(tid)

    deleted = await api_client.delete(f"/tasks/{tid}")
    assert deleted.status_code == 204

    # Second delete: already gone.
    again = await api_client.delete(f"/tasks/{tid}")
    assert again.status_code == 404

    async with async_session() as session:
        assert await session.get(Task, tid) is None
