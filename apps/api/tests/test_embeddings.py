"""Integration test for app.knowledge.embeddings.backfill_embeddings.

The real embedding model (fastembed's BAAI/bge-small-en-v1.5) downloads
weights from the network on first use, so embed_text is monkeypatched with a
fast, deterministic stand-in here rather than exercising the real model.

backfill_embeddings operates on *every* Note row missing an embedding, so
this test guards against ever mutating real vault data: if some other note
is already missing an embedding, it skips rather than silently overwriting
that note with a fake test vector.
"""

import uuid

import pytest
from sqlalchemy import select

import app.knowledge.embeddings as embeddings_module
from app.db import async_session, engine
from app.base import init_models
from app.knowledge.models import Note


def _fake_embed_text(text: str) -> list[float]:
    """Deterministic stand-in for the real (network-downloaded) fastembed model."""
    vector = [0.0] * 384
    vector[0] = float(len(text) % 97) / 97.0
    return vector


async def test_backfill_embeddings_fills_missing_vector(ensure_db, cleanup_notes, monkeypatch):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    vault_path = f"embed-test-{unique}.md"
    cleanup_notes.append(vault_path)

    async with async_session() as session:
        note = Note(
            vault_path=vault_path,
            title="Embed Me",
            content="Some content to embed.",
            content_hash="deadbeef",
        )
        session.add(note)
        await session.commit()
        note_id = note.id

        other_missing = await session.execute(
            select(Note.id).where(Note.embedding.is_(None), Note.id != note_id)
        )
        if other_missing.first() is not None:
            pytest.skip(
                "other notes without embeddings already exist in this Postgres "
                "instance; skipping rather than risk overwriting real vault data"
            )

    monkeypatch.setattr(embeddings_module, "embed_text", _fake_embed_text)

    stats = await embeddings_module.backfill_embeddings()
    assert stats["embedded_count"] == 1

    async with async_session() as session:
        refreshed = await session.get(Note, note_id)
        assert refreshed.embedding is not None
        assert len(refreshed.embedding) == 384
