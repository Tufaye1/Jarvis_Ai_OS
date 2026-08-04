"""Shared fixtures for the app.knowledge test suite."""

import pytest
from sqlalchemy import delete, or_, select, text

from app.config import settings
from app.db import async_session, engine
from app.knowledge.models import Note, NoteLink


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
