"""Content Studio orchestration.

`generate_content` is the one heavy entry point: it pulls grounding from the
Knowledge + Memory volumes, optionally replays a source conversation, calls
the shared LLM, and persists a ContentDraft row. On LLM failure it still
persists a body=None draft so nothing silently vanishes, then re-raises.

The retrieval-fencing pattern (`_fence_safe` + `_FENCE_TAG_RE`) mirrors the
chat service — retrieved note content is UNTRUSTED and must not be able to
close the `<retrieved_context>` block from inside.
"""

import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.chat.llm import complete
from app.chat.models import ROLE_ASSISTANT, ROLE_USER, Conversation, Message
from app.config import settings
from app.content.models import (
    STATUS_DRAFT,
    STATUS_FINAL,
    ContentDraft,
)
from app.content.prompts import build_system_prompt
from app.db import async_session
from app.knowledge.search import semantic_search
from app.memory.service import recall
from app.projects.models import Project

logger = logging.getLogger(__name__)

NOTE_LIMIT = 6
MEMORY_LIMIT = 4
HISTORY_LIMIT = 10
TITLE_MAX_CHARS = 60
MAX_TOKENS = 2048

_MUTABLE_FIELDS = frozenset({"title", "body", "tone", "length", "status"})

_FENCE_TAG_RE = re.compile(
    r"<\s*/?\s*(retrieved_context|note|memory|title|content|conversation|turn)\b[^>]*>",
    re.IGNORECASE,
)


class ProjectNotFound(ValueError):
    """Router maps this to 404."""


class ConversationNotFound(ValueError):
    """Router maps this to 404."""


def _fence_safe(value: str | None) -> str:
    return _FENCE_TAG_RE.sub("", (value or "")).strip()


def _one_line(value: str | None) -> str:
    return " ".join(_fence_safe(value).split())


def _format_context(notes: list[dict], memories: list[dict]) -> str:
    lines: list[str] = ["<retrieved_context>"]
    if notes:
        for i, note in enumerate(notes, start=1):
            title = _one_line(note.get("title") or note.get("vault_path"))
            lines.append(f'<note index="{i}">')
            lines.append(f"<title>{title}</title>")
            lines.append("<content>")
            lines.append(_fence_safe(note.get("snippet")))
            lines.append("</content>")
            lines.append("</note>")
    else:
        lines.append("<note>(no notes matched this brief)</note>")
    for memory in memories:
        text = _fence_safe(memory.get("content"))
        if text:
            lines.append(f"<memory>{text}</memory>")
    lines.append("</retrieved_context>")
    return "\n".join(lines)


def _to_sources(notes: list[dict]) -> list[dict]:
    """Map semantic_search results onto the ContentDraft.sources contract."""
    return [
        {
            "note_id": note["id"],
            "title": note.get("title"),
            "vault_path": note.get("vault_path"),
            "score": note.get("score"),
        }
        for note in notes
    ]


def _derive_title(body: str, prompt: str) -> str:
    """First heading/subject-like line if any, else first ~60 chars of body/prompt."""
    text = (body or "").strip() or (prompt or "").strip()
    if not text:
        return "Untitled draft"
    first_line = text.splitlines()[0].strip()
    # Strip common leading markers so the list view reads cleanly.
    stripped = re.sub(r"^(#+\s*|Subject:\s*|\d+\.\s*|-\s*)", "", first_line).strip()
    candidate = stripped or first_line
    if len(candidate) <= TITLE_MAX_CHARS:
        return candidate
    return candidate[: TITLE_MAX_CHARS - 1].rstrip() + "…"


async def _load_history(session, conversation_id: int) -> list[dict]:
    """Last ~HISTORY_LIMIT messages from a conversation, oldest first, user-led."""
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .limit(HISTORY_LIMIT)
    )
    rows = (await session.execute(stmt)).scalars().all()
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(rows)
        if m.content and m.content.strip()
    ]
    while history and history[0]["role"] != ROLE_USER:
        history.pop(0)
    return history


async def generate_content(
    *,
    kind: str,
    prompt: str,
    project_id: int | None = None,
    tone: str | None = None,
    length: str | None = None,
    source_conversation_id: int | None = None,
    notes_query: str | None = None,
    session_factory: async_sessionmaker = async_session,
) -> ContentDraft:
    """Retrieve grounding, call the LLM, persist a ContentDraft row.

    On LLM failure a draft row is persisted with body=None and status=draft,
    then the exception is re-raised — deliberate: no silent losses.
    """
    project_name: str | None = None
    history: list[dict] = []

    async with session_factory() as session:
        if project_id is not None:
            project = await session.get(Project, project_id)
            if project is None:
                raise ProjectNotFound(f"project {project_id} not found")
            project_name = project.name

        if source_conversation_id is not None:
            conv = await session.get(Conversation, source_conversation_id)
            if conv is None:
                raise ConversationNotFound(
                    f"conversation {source_conversation_id} not found"
                )
            history = await _load_history(session, source_conversation_id)

    retrieval_query = (notes_query or prompt).strip()
    notes = await semantic_search(retrieval_query, limit=NOTE_LIMIT)

    try:
        if project_name:
            memories = await recall(
                prompt, limit=MEMORY_LIMIT, scope="project", project=project_name
            )
        else:
            memories = await recall(prompt, limit=MEMORY_LIMIT, scope="global")
    except Exception:  # memory volume must not break generation
        logger.warning("memory recall failed; continuing without memories", exc_info=True)
        memories = []

    system_prompt = (
        build_system_prompt(kind, tone, length)
        + "\n\n"
        + _format_context(notes, memories)
    )

    messages: list[dict] = list(history)
    messages.append({"role": ROLE_USER, "content": prompt})
    # Guarantee the messages list starts on a user turn (some providers require it).
    while messages and messages[0]["role"] == ROLE_ASSISTANT:
        messages.pop(0)

    sources = _to_sources(notes) or None
    model_used = settings.llm_model or None

    try:
        body = await complete(system_prompt, messages, max_tokens=MAX_TOKENS)
    except Exception:
        # Persist the failed attempt so the user can see it in the drafts list.
        async with session_factory() as session:
            failed = ContentDraft(
                prompt=prompt,
                kind=kind,
                title=_derive_title("", prompt),
                body=None,
                tone=tone,
                length=length,
                status=STATUS_DRAFT,
                project_id=project_id,
                source_conversation_id=source_conversation_id,
                sources=sources,
                model=model_used,
            )
            session.add(failed)
            await session.commit()
        raise

    title = _derive_title(body, prompt)
    async with session_factory() as session:
        draft = ContentDraft(
            prompt=prompt,
            kind=kind,
            title=title,
            body=body,
            tone=tone,
            length=length,
            status=STATUS_FINAL,
            project_id=project_id,
            source_conversation_id=source_conversation_id,
            sources=sources,
            model=model_used,
        )
        session.add(draft)
        await session.commit()
        await session.refresh(draft)
    return draft


async def list_content(
    project_id: int | None = None,
    kind: str | None = None,
    status: str | None = None,
    limit: int = 50,
    session_factory: async_sessionmaker = async_session,
) -> list[ContentDraft]:
    """List drafts, newest first, with optional filters."""
    stmt = select(ContentDraft)
    if project_id is not None:
        stmt = stmt.where(ContentDraft.project_id == project_id)
    if kind is not None:
        stmt = stmt.where(ContentDraft.kind == kind)
    if status is not None:
        stmt = stmt.where(ContentDraft.status == status)
    stmt = stmt.order_by(ContentDraft.id.desc()).limit(limit)
    async with session_factory() as session:
        return list((await session.execute(stmt)).scalars().all())


async def get_content(
    cid: int, session_factory: async_sessionmaker = async_session
) -> ContentDraft | None:
    async with session_factory() as session:
        return await session.get(ContentDraft, cid)


async def update_content(
    cid: int,
    patch: dict,
    session_factory: async_sessionmaker = async_session,
) -> ContentDraft | None:
    """Apply a whitelisted partial update. Unknown fields silently dropped."""
    async with session_factory() as session:
        draft = await session.get(ContentDraft, cid)
        if draft is None:
            return None
        for key, value in patch.items():
            if key not in _MUTABLE_FIELDS:
                continue
            setattr(draft, key, value)
        await session.commit()
        await session.refresh(draft)
    return draft


async def delete_content(
    cid: int, session_factory: async_sessionmaker = async_session
) -> bool:
    async with session_factory() as session:
        draft = await session.get(ContentDraft, cid)
        if draft is None:
            return False
        await session.delete(draft)
        await session.commit()
    return True
