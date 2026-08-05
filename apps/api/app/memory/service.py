"""Memory service: persistence, semantic recall, and LLM-driven extraction.

`recall()` is imported by the chat service as `app.memory.service.recall` --
its name and signature are a hard contract.
"""

import asyncio
import inspect
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.chat.models import ROLE_USER, Conversation, Message
from app.db import async_session
from app.knowledge.embeddings import embed_text
from app.memory.models import SCOPE_GLOBAL, SCOPE_PROJECT, Memory

# Guardrails on what a single extraction run may write.
MAX_EXTRACTED = 10
_MAX_FACT_CHARS = 500
_TRANSCRIPT_CHARS = 12_000

_EXTRACT_SYSTEM = (
    "You extract durable long-term memories from a conversation between a user "
    "and their assistant. Keep only facts that stay true after this conversation "
    "ends: preferences, habits, tools, ongoing projects, constraints, people, "
    "goals. Ignore small talk, one-off questions, and anything the assistant "
    "said about itself. Each memory must be a short standalone sentence that "
    "makes sense with no other context. "
    f"Return at most {MAX_EXTRACTED} of them as a JSON array of strings and "
    "nothing else. Return [] if there is nothing worth remembering."
)


class LLMUnavailable(RuntimeError):
    """The LLM backend is missing or unconfigured; the router maps this to 503."""


class ConversationNotFound(LookupError):
    """No conversation with the requested id; the router maps this to 404."""


def _filtered(stmt, scope: str | None, project: str | None):
    """Apply the optional scope/project filters shared by recall and list."""
    if scope is not None:
        stmt = stmt.where(Memory.scope == scope)
    if project is not None:
        stmt = stmt.where(Memory.project == project)
    return stmt


async def remember(
    scope: str,
    content: str,
    project: str | None = None,
    source_conversation_id: int | None = None,
    session_factory: async_sessionmaker = async_session,
) -> Memory:
    """Persist one memory, embedding its content into the shared 384-dim space."""
    if scope != SCOPE_PROJECT:
        # `project` is only meaningful for project-scoped memories.
        project = None

    # embed_text is synchronous/CPU-bound; keep it off the event loop.
    embedding = await asyncio.to_thread(embed_text, content)

    async with session_factory() as session:
        memory = Memory(
            scope=scope,
            project=project,
            content=content,
            embedding=embedding,
            source_conversation_id=source_conversation_id,
        )
        session.add(memory)
        await session.commit()
        # Session uses expire_on_commit=False, so server defaults
        # (created_at/updated_at) need an explicit refresh.
        await session.refresh(memory)

    return memory


async def recall(
    query: str,
    limit: int = 5,
    scope: str | None = None,
    project: str | None = None,
    session_factory: async_sessionmaker = async_session,
) -> list[dict]:
    """Return the `limit` memories closest to `query` by cosine distance.

    Rows without an embedding are skipped. `score` is 1 - distance, so higher
    is more relevant (same convention as knowledge semantic_search).
    """
    if limit <= 0:
        return []

    query_embedding = await asyncio.to_thread(embed_text, query)

    async with session_factory() as session:
        distance = Memory.embedding.cosine_distance(query_embedding)
        stmt = select(Memory, distance.label("distance")).where(
            Memory.embedding.is_not(None)
        )
        stmt = _filtered(stmt, scope, project).order_by(distance.asc()).limit(limit)
        rows = (await session.execute(stmt)).all()

    return [
        {
            "id": memory.id,
            "scope": memory.scope,
            "project": memory.project,
            "content": memory.content,
            "score": 1 - cosine_distance,
        }
        for memory, cosine_distance in rows
    ]


async def list_memories(
    scope: str | None = None,
    project: str | None = None,
    session_factory: async_sessionmaker = async_session,
) -> list[Memory]:
    """All memories matching the optional scope/project filters, newest first."""
    stmt = _filtered(select(Memory), scope, project).order_by(
        Memory.created_at.desc(), Memory.id.desc()
    )
    async with session_factory() as session:
        return list(await session.scalars(stmt))


async def forget(
    memory_id: int, session_factory: async_sessionmaker = async_session
) -> bool:
    """Delete one memory. Returns False when the row doesn't exist (router 404s)."""
    async with session_factory() as session:
        memory = await session.get(Memory, memory_id)
        if memory is None:
            return False
        await session.delete(memory)
        await session.commit()
    return True


async def extract_from_conversation(
    conversation_id: int, session_factory: async_sessionmaker = async_session
) -> list[Memory]:
    """Ask the LLM for durable facts in a conversation and store each as a memory.

    Raises ConversationNotFound (404) or LLMUnavailable (503). Facts already
    extracted from this same conversation are skipped, so re-running is safe.
    """
    async with session_factory() as session:
        if await session.get(Conversation, conversation_id) is None:
            raise ConversationNotFound(f"conversation {conversation_id} not found")

        messages = await session.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.id.asc())
        )
        # Keep the tail of long conversations: recent turns carry the facts.
        transcript = "\n".join(f"{m.role}: {m.content}" for m in messages)
        transcript = transcript[-_TRANSCRIPT_CHARS:].strip()

        already = {
            content.strip().lower()
            for content in await session.scalars(
                select(Memory.content).where(
                    Memory.source_conversation_id == conversation_id
                )
            )
        }

    if not transcript:
        return []

    raw = await _complete(f"Conversation:\n{transcript}", _EXTRACT_SYSTEM)

    created: list[Memory] = []
    for fact in _parse_facts(raw)[:MAX_EXTRACTED]:
        if fact.lower() in already:
            continue
        already.add(fact.lower())
        created.append(
            await remember(
                SCOPE_GLOBAL,
                fact,
                source_conversation_id=conversation_id,
                session_factory=session_factory,
            )
        )
    return created


def _parse_facts(raw: str) -> list[str]:
    """Pull a JSON array of strings out of an LLM reply, tolerating slop.

    Handles markdown code fences and surrounding prose; anything unparseable
    yields [] rather than raising.
    """
    if not raw:
        return []
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end <= start:
        return []
    try:
        parsed = json.loads(raw[start : end + 1])
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    facts: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            continue
        fact = item.strip()[:_MAX_FACT_CHARS].strip()
        if fact:
            facts.append(fact)
    return facts


async def _complete(prompt: str, system: str) -> str:
    """Call the chat volume's LLM helper, which is owned by a parallel agent.

    Imported lazily so /memory stays importable and every other endpoint keeps
    working even when app.chat.llm is missing or unconfigured. Arguments are
    bound by keyword, and both a sync and an async `complete` are accepted, so
    the call survives everything but an outright rename.
    """
    try:
        from app.chat.llm import LLMNotConfigured, complete
    except (ImportError, AttributeError) as exc:
        raise LLMUnavailable(f"LLM backend unavailable: {exc}") from exc

    try:
        result = complete(
            system=system, messages=[{"role": ROLE_USER, "content": prompt}]
        )
        if inspect.isawaitable(result):
            result = await result
    except LLMNotConfigured as exc:
        raise LLMUnavailable(f"LLM is not configured: {exc}") from exc
    except TypeError as exc:
        # complete()'s signature drifted; a 503 beats a 500 traceback.
        raise LLMUnavailable(f"cannot call app.chat.llm.complete: {exc}") from exc

    return result if isinstance(result, str) else str(result or "")
