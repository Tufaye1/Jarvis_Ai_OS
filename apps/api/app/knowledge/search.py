"""Semantic search over notes using pgvector cosine distance."""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db import async_session
from app.knowledge.embeddings import embed_text
from app.knowledge.models import Note

_SNIPPET_CHARS = 200


async def semantic_search(
    query: str, limit: int = 10, session_factory: async_sessionmaker = async_session
) -> list[dict]:
    """Embed `query` and return the `limit` closest notes by cosine distance.

    Rows with a NULL embedding are excluded. Results are ordered closest-first
    (ascending cosine distance).
    """
    # embed_text is synchronous/CPU-bound; run it in a worker thread so it
    # doesn't block the event loop (same reasoning as backfill_embeddings).
    query_embedding = await asyncio.to_thread(embed_text, query)

    async with session_factory() as session:
        distance = Note.embedding.cosine_distance(query_embedding)
        stmt = (
            select(Note, distance.label("distance"))
            .where(Note.embedding.is_not(None))
            .order_by(distance.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        rows = result.all()

    results: list[dict] = []
    for note, cosine_distance in rows:
        content = note.content or ""
        results.append(
            {
                "id": note.id,
                "title": note.title,
                "vault_path": note.vault_path,
                "snippet": content[:_SNIPPET_CHARS],
                "score": 1 - cosine_distance,
            }
        )

    return results
