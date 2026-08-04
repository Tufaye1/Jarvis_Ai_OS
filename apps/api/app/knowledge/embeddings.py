"""Local embeddings for notes using fastembed (no external API calls, no per-call cost).

Model: BAAI/bge-small-en-v1.5 -> 384-dim vectors, matching the pgvector
Vector(384) column on Note.embedding.
"""

import asyncio

from fastembed import TextEmbedding
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db import async_session
from app.knowledge.models import Note

_MODEL_NAME = "BAAI/bge-small-en-v1.5"

_model: TextEmbedding | None = None

_CONTENT_TRUNCATE_CHARS = 2000


def _get_model() -> TextEmbedding:
    """Lazily instantiate (and cache) the module-level TextEmbedding model.

    Loading the model is expensive, so this only happens once, on first use.
    """
    global _model
    if _model is None:
        _model = TextEmbedding(model_name=_MODEL_NAME)
    return _model


def embed_text(text: str) -> list[float]:
    """Compute a single embedding for `text`, returned as a plain list of floats."""
    model = _get_model()
    # TextEmbedding.embed is a generator that yields one np.ndarray per input.
    (embedding,) = model.embed([text])
    return embedding.tolist()


def _build_embedding_input(title: str, content: str) -> str:
    truncated_content = (content or "")[:_CONTENT_TRUNCATE_CHARS]
    return f"{title or ''}\n{truncated_content}"


async def backfill_embeddings(session_factory: async_sessionmaker = async_session) -> dict:
    """Compute and store embeddings for every Note row missing one.

    Returns {"embedded_count": <int>}.
    """
    embedded_count = 0

    async with session_factory() as session:
        result = await session.execute(select(Note).where(Note.embedding.is_(None)))
        notes = result.scalars().all()

        for note in notes:
            text = _build_embedding_input(note.title, note.content)
            # fastembed's embed call is synchronous/CPU-bound; run it in a
            # worker thread so it doesn't block the event loop.
            embedding = await asyncio.to_thread(embed_text, text)
            note.embedding = embedding
            embedded_count += 1

        await session.commit()

    return {"embedded_count": embedded_count}
