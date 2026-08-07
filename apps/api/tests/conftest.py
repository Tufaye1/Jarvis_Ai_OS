"""Shared fixtures for the API test suite."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, or_, select, text

from app.chat.models import Conversation, Message
from app.config import settings
from app.db import async_session, engine
from app.knowledge.models import Note, NoteLink
from app.memory.models import Memory
from app.projects.models import Project
from app.tasks.models import Task


@pytest.fixture
def vault_root(tmp_path, monkeypatch):
    """Point settings.vault_path at a throwaway directory for the duration of a test.

    scan_vault() reads settings.vault_path (a shared, module-level Settings
    instance) rather than taking a path argument, so tests redirect it here.
    """
    monkeypatch.setattr(settings, "vault_path", tmp_path)
    return tmp_path


@pytest.fixture
async def ensure_db():
    """Skip the test if the local Postgres (docker compose 'db' service) isn't reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - depends on local environment
        pytest.skip(f"requires running Postgres: {exc}")


@pytest.fixture
async def cleanup_notes():
    """Yield a list; append the vault_path of any Note a test creates.

    After the test, deletes those Notes (and any NoteLink rows touching them)
    so the shared local dev Postgres instance doesn't accumulate test data.
    """
    vault_paths: list[str] = []
    yield vault_paths
    if not vault_paths:
        return
    async with async_session() as session:
        result = await session.execute(select(Note).where(Note.vault_path.in_(vault_paths)))
        note_ids = [n.id for n in result.scalars().all()]
        if note_ids:
            await session.execute(
                delete(NoteLink).where(
                    or_(
                        NoteLink.source_note_id.in_(note_ids),
                        NoteLink.target_note_id.in_(note_ids),
                    )
                )
            )
            await session.execute(delete(Note).where(Note.id.in_(note_ids)))
            await session.commit()


@pytest.fixture
async def cleanup_conversations():
    """Yield a list; append the id of any Conversation a test creates.

    After the test, deletes those Conversations and their Messages. Messages
    are removed explicitly rather than relying on the FK's ON DELETE CASCADE,
    so cleanup still works if a test deleted the conversation row itself.
    """
    conversation_ids: list[int] = []
    yield conversation_ids
    if not conversation_ids:
        return
    async with async_session() as session:
        await session.execute(
            delete(Message).where(Message.conversation_id.in_(conversation_ids))
        )
        await session.execute(
            delete(Conversation).where(Conversation.id.in_(conversation_ids))
        )
        await session.commit()


@pytest.fixture
async def cleanup_memories():
    """Yield a list; append the id of any Memory a test creates.

    Memory.source_conversation_id is ON DELETE SET NULL, so ordering against
    cleanup_conversations doesn't matter.
    """
    memory_ids: list[int] = []
    yield memory_ids
    if not memory_ids:
        return
    async with async_session() as session:
        await session.execute(delete(Memory).where(Memory.id.in_(memory_ids)))
        await session.commit()


@pytest.fixture
async def cleanup_projects():
    """Yield a list; append the id of any Project a test creates.

    After the test, deletes those Projects. Task.project_id has ON DELETE
    SET NULL, so any tasks the test created against these projects survive
    -- they must be tracked via `cleanup_tasks` if the test wants them gone.
    """
    project_ids: list[int] = []
    yield project_ids
    if not project_ids:
        return
    async with async_session() as session:
        await session.execute(delete(Project).where(Project.id.in_(project_ids)))
        await session.commit()


@pytest.fixture
async def cleanup_tasks():
    """Yield a list; append the id of any Task a test creates.

    After the test, deletes those Tasks. Ordering against `cleanup_projects`
    does not matter -- Task.project_id is ON DELETE SET NULL.
    """
    task_ids: list[int] = []
    yield task_ids
    if not task_ids:
        return
    async with async_session() as session:
        await session.execute(delete(Task).where(Task.id.in_(task_ids)))
        await session.commit()


@pytest.fixture
async def api_client():
    """An httpx client bound directly to the FastAPI app via ASGI (no sockets).

    The app's lifespan (which calls init_models) is deliberately not run here:
    tests call `await init_models(engine)` themselves, matching the rest of the
    suite, and that keeps the client usable on the session-scoped event loop.
    """
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        yield client
