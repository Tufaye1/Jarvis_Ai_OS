"""Tasks service: CRUD over Task rows.

`get_task`/`list_tasks`/`update_task` are imported by the planner service
and the router -- their signatures are a hard contract.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db import async_session
from app.tasks.models import STATUS_DONE, Task


class TaskNotFound(ValueError):
    """No task with the requested id; the router maps this to 404."""


# Fields that PATCH is allowed to touch. `status` is handled specially so
# completed_at stays in sync with the transition into/out of "done".
_UPDATABLE_FIELDS = {"title", "description", "project_id", "due_at"}


async def create_task(
    title: str,
    description: str | None = None,
    project_id: int | None = None,
    due_at: datetime | None = None,
    session_factory: async_sessionmaker = async_session,
) -> Task:
    """Persist a new task in status='todo'."""
    async with session_factory() as session:
        task = Task(
            title=title,
            description=description,
            project_id=project_id,
            due_at=due_at,
        )
        session.add(task)
        await session.commit()
        # expire_on_commit=False, so server defaults need an explicit refresh.
        await session.refresh(task)
    return task


async def list_tasks(
    project_id: int | None = None,
    status: str | None = None,
    limit: int | None = None,
    session_factory: async_sessionmaker = async_session,
) -> list[Task]:
    """All tasks matching the optional filters, newest first."""
    stmt = select(Task)
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if status is not None:
        stmt = stmt.where(Task.status == status)
    stmt = stmt.order_by(Task.created_at.desc(), Task.id.desc())
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    async with session_factory() as session:
        return list(await session.scalars(stmt))


async def get_task(
    tid: int, session_factory: async_sessionmaker = async_session
) -> Task | None:
    """Return one task by id, or None if missing (router 404s on None)."""
    async with session_factory() as session:
        return await session.get(Task, tid)


async def update_task(
    tid: int,
    patch: dict[str, Any],
    session_factory: async_sessionmaker = async_session,
) -> Task | None:
    """Apply the given partial patch. Keeps completed_at in sync with status.

    Transitioning INTO status='done' stamps completed_at=now(UTC); moving away
    from 'done' clears it. Returns None when the task doesn't exist.
    """
    async with session_factory() as session:
        task = await session.get(Task, tid)
        if task is None:
            return None

        for key, value in patch.items():
            if key in _UPDATABLE_FIELDS:
                setattr(task, key, value)

        if "status" in patch:
            new_status = patch["status"]
            if new_status is not None and new_status != task.status:
                task.status = new_status
                if new_status == STATUS_DONE:
                    # Naive UTC — matches TIMESTAMP WITHOUT TIME ZONE columns
                    # (asyncpg rejects tz-aware values on naive columns).
                    task.completed_at = datetime.now(tz=UTC).replace(tzinfo=None)
                else:
                    task.completed_at = None
            elif new_status is not None:
                # Same status, but reassert completion stamp invariants in
                # case the row is inconsistent for some reason.
                if new_status != STATUS_DONE and task.completed_at is not None:
                    task.completed_at = None

        await session.commit()
        await session.refresh(task)
        return task


async def delete_task(
    tid: int, session_factory: async_sessionmaker = async_session
) -> bool:
    """Delete one task. Returns False when the row doesn't exist."""
    async with session_factory() as session:
        task = await session.get(Task, tid)
        if task is None:
            return False
        await session.delete(task)
        await session.commit()
    return True
