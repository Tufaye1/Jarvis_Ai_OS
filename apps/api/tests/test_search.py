"""Integration test for app.knowledge.search.semantic_search.

Uses real Postgres/pgvector for the cosine-distance ordering (the part worth
testing), but monkeypatches embed_text so the test doesn't need the
network-downloaded fastembed model: two notes are inserted with known,
hand-picked embedding vectors, and the "query embedding" is pinned to match
one of them exactly.
"""

import uuid

import pytest

import app.knowledge.search as search_module
from app.db import async_session, engine
from app.knowledge.models import Note, init_models


def _unit_vector(index: int, dim: int = 384) -> list[float]:
    vector = [0.0] * dim
    vector[index] = 1.0
    return vector


async def test_semantic_search_orders_by_cosine_distance(ensure_db, cleanup_notes, monkeypatch):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    close_path = f"search-close-{unique}.md"
    far_path = f"search-far-{unique}.md"
    cleanup_notes.extend([close_path, far_path])

    query_vector = _unit_vector(0)

    async with async_session() as session:
        session.add_all(
            [
                Note(
                    vault_path=close_path,
                    title="Close Note",
                    content="This note matches the query embedding closely.",
                    content_hash="close-hash",
                    embedding=_unit_vector(0),  # identical direction -> cosine distance 0
                ),
                Note(
                    vault_path=far_path,
                    title="Far Note",
                    content="This note is orthogonal to the query embedding.",
                    content_hash="far-hash",
                    embedding=_unit_vector(1),  # orthogonal -> cosine distance 1
                ),
            ]
        )
        await session.commit()

    monkeypatch.setattr(search_module, "embed_text", lambda _query: query_vector)

    results = await search_module.semantic_search("anything", limit=50)
    by_path = {r["vault_path"]: r for r in results if r["vault_path"] in {close_path, far_path}}

    assert set(by_path) == {close_path, far_path}
    assert by_path[close_path]["score"] == pytest.approx(1.0, abs=1e-4)
    assert by_path[far_path]["score"] == pytest.approx(0.0, abs=1e-4)
    assert by_path[close_path]["title"] == "Close Note"
    assert by_path[close_path]["snippet"] == "This note matches the query embedding closely."

    ordered_paths = [r["vault_path"] for r in results]
    assert ordered_paths.index(close_path) < ordered_paths.index(far_path)
