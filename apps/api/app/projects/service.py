"""Projects service: CRUD plus cross-volume detail counts.

The router is the only intended caller. `get_project_detail` reaches into the
Tasks and Memory volumes for aggregate counts, but only via read-only
`SELECT COUNT(*)` -- it never mutates those tables.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db import async_session
from app.memory.models import Memory
from app.projects.models import STATUS_ACTIVE, STATUS_ARCHIVED, Project
from app.tasks.models import STATUS_DOING, STATUS_DONE, STATUS_TODO, Task


class ProjectNotFound(ValueError):
    """No project with the requested id; the router maps this to 404."""


async def create_project(
    name: str,
    description: str | None = None,
    session_factory: async_sessionmaker = async_session,
) -> Project:
    """Create a new active project."""
    async with session_factory() as session:
        project = Project(
            name=name,
            description=description,
            status=STATUS_ACTIVE,
        )
        session.add(project)
        await session.commit()
        # expire_on_commit=False, so server defaults need an explicit refresh.
        await session.refresh(project)
    return project


async def list_projects(
    status: str | None = STATUS_ACTIVE,
    limit: int = 200,
    session_factory: async_sessionmaker = async_session,
) -> list[Project]:
    """List projects, newest first, optionally filtered by status.

    Default is active-only, matching how the UI's project list wants to look.
    Pass status=None to bypass the filter. limit is a hard cap so the endpoint
    can't be forced into a huge scan.
    """
    stmt = select(Project)
    if status is not None:
        stmt = stmt.where(Project.status == status)
    stmt = stmt.order_by(Project.created_at.desc(), Project.id.desc()).limit(limit)
    async with session_factory() as session:
        return list(await session.scalars(stmt))


async def get_project(
    pid: int, session_factory: async_sessionmaker = async_session
) -> Project | None:
    """Return the project row or None."""
    async with session_factory() as session:
        return await session.get(Project, pid)


async def get_project_detail(
    pid: int, session_factory: async_sessionmaker = async_session
) -> dict | None:
    """Return the project plus tasks_open / tasks_done / memories counts.

    Three cheap COUNT(*) queries. Memories are attributed by NAME (see
    Memory.project), so we count where Memory.project == project.name.
    """
    async with session_factory() as session:
        project = await session.get(Project, pid)
        if project is None:
            return None

        tasks_open = await session.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.project_id == pid,
                Task.status.in_([STATUS_TODO, STATUS_DOING]),
            )
        )
        tasks_done = await session.scalar(
            select(func.count())
            .select_from(Task)
            .where(Task.project_id == pid, Task.status == STATUS_DONE)
        )
        memories = await session.scalar(
            select(func.count())
            .select_from(Memory)
            .where(Memory.project == project.name)
        )

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "counts": {
            "tasks_open": int(tasks_open or 0),
            "tasks_done": int(tasks_done or 0),
            "memories": int(memories or 0),
        },
    }


# Fields the PATCH endpoint is allowed to change; everything else is ignored.
_MUTABLE_FIELDS = frozenset({"name", "description", "status"})
_VALID_STATUSES = frozenset({STATUS_ACTIVE, STATUS_ARCHIVED})


async def update_project(
    pid: int,
    patch: dict,
    session_factory: async_sessionmaker = async_session,
) -> Project | None:
    """Apply a partial update. Returns None if the project doesn't exist."""
    async with session_factory() as session:
        project = await session.get(Project, pid)
        if project is None:
            return None

        for key, value in patch.items():
            if key not in _MUTABLE_FIELDS:
                continue
            if key == "status" and value not in _VALID_STATUSES:
                # Belt-and-braces; the router's Literal type already 422s.
                raise ValueError(f"invalid status: {value!r}")
            setattr(project, key, value)

        await session.commit()
        await session.refresh(project)
    return project


async def delete_project(
    pid: int, session_factory: async_sessionmaker = async_session
) -> bool:
    """Delete a project. Tasks' project_id is set NULL by the FK's ON DELETE."""
    async with session_factory() as session:
        project = await session.get(Project, pid)
        if project is None:
            return False
        await session.delete(project)
        await session.commit()
    return True
