"""Integration tests for the Chat volume (service + HTTP router).

These run against real Postgres like the rest of the suite, but every
outbound dependency is monkeypatched:

  - `app.chat.service.complete` -- so no request ever reaches Anthropic.
  - `app.chat.service.semantic_search` -- so the network-downloaded fastembed
    model is never loaded for note retrieval.
  - `app.memory.service.embed_text` -- chat's `_recall_memories` lazily imports
    the real `recall`, which would otherwise embed the query with that model.

The one deliberate exception is the no-API-key path, which calls the real
`app.chat.llm.complete` with the key blanked so it raises before constructing
a client.
"""

import uuid

import pytest
from sqlalchemy import select

import app.chat.service as chat_service
import app.memory.service as memory_service
from app.base import init_models
from app.chat.llm import LLMNotConfigured, complete
from app.chat.models import ROLE_ASSISTANT, ROLE_USER, Message
from app.config import settings
from app.db import async_session, engine

STUB_NOTE = {
    "id": 424242,
    "title": "Stub Note",
    "vault_path": "stub-note.md",
    "snippet": "A stubbed retrieval hit.",
    "score": 0.9,
}


def _fake_embed_text(text: str) -> list[float]:
    """Deterministic stand-in for the real (network-downloaded) fastembed model."""
    vector = [0.0] * 384
    vector[0] = float(len(text) % 97) / 97.0
    return vector


async def _stub_semantic_search(query: str, limit: int = 5) -> list[dict]:
    return [dict(STUB_NOTE)]


@pytest.fixture
def stub_retrieval(monkeypatch):
    """Cut every model download / network call out of `send_message`.

    Memory recall still runs for real against Postgres -- only its embedding
    call is replaced.
    """
    monkeypatch.setattr(chat_service, "semantic_search", _stub_semantic_search)
    monkeypatch.setattr(memory_service, "embed_text", _fake_embed_text)


@pytest.fixture
def stub_llm(monkeypatch):
    """Replace the LLM with an echo, and record what it was asked."""
    calls: list[dict] = []

    async def _complete(system, messages, max_tokens=2048):
        calls.append({"system": system, "messages": messages})
        return f"reply to: {messages[-1]['content']}"

    monkeypatch.setattr(chat_service, "complete", _complete)
    return calls


async def _create_conversation(api_client, cleanup_conversations) -> int:
    response = await api_client.post("/chat/conversations")
    assert response.status_code == 201
    body = response.json()
    cleanup_conversations.append(body["id"])
    return body["id"]


def test_derive_title_collapses_whitespace_and_truncates():
    assert chat_service._derive_title("  hello\n  there  ") == "hello there"
    assert chat_service._derive_title("   ") == "New conversation"

    long_title = chat_service._derive_title("word " * 40)
    assert len(long_title) == chat_service.TITLE_MAX_CHARS
    assert long_title.endswith("…")


async def test_conversation_derives_title_and_keeps_messages_in_order(
    ensure_db, cleanup_conversations, api_client, stub_retrieval, stub_llm
):
    await init_models(engine)

    cid = await _create_conversation(api_client, cleanup_conversations)

    listed = await api_client.get("/chat/conversations")
    assert listed.status_code == 200
    created = next(c for c in listed.json() if c["id"] == cid)
    assert created["title"] is None  # null until the first user message lands

    unique = uuid.uuid4().hex[:8]
    first = f"first question {unique}"
    second = f"second question {unique}"

    turn = await api_client.post(
        f"/chat/conversations/{cid}/messages", json={"content": first}
    )
    assert turn.status_code == 200
    payload = turn.json()
    assert payload["user_message"]["role"] == ROLE_USER
    assert payload["user_message"]["content"] == first
    assert payload["assistant_message"]["role"] == ROLE_ASSISTANT
    assert payload["assistant_message"]["content"] == f"reply to: {first}"
    # Retrieved notes are recorded on the assistant turn, not the user turn.
    assert payload["user_message"]["sources"] is None
    assert payload["assistant_message"]["sources"] == [
        {
            "note_id": STUB_NOTE["id"],
            "title": STUB_NOTE["title"],
            "vault_path": STUB_NOTE["vault_path"],
            "score": STUB_NOTE["score"],
        }
    ]

    second_turn = await api_client.post(
        f"/chat/conversations/{cid}/messages", json={"content": second}
    )
    assert second_turn.status_code == 200

    # The title is derived from the *first* user message and never rewritten.
    listed = await api_client.get("/chat/conversations")
    assert next(c for c in listed.json() if c["id"] == cid)["title"] == first

    transcript = await api_client.get(f"/chat/conversations/{cid}/messages")
    assert transcript.status_code == 200
    messages = transcript.json()
    assert [(m["role"], m["content"]) for m in messages] == [
        (ROLE_USER, first),
        (ROLE_ASSISTANT, f"reply to: {first}"),
        (ROLE_USER, second),
        (ROLE_ASSISTANT, f"reply to: {second}"),
    ]
    assert [m["id"] for m in messages] == sorted(m["id"] for m in messages)

    # The second call replays the first exchange as history, oldest first,
    # starting on a user turn (an Anthropic API requirement).
    replayed = stub_llm[-1]["messages"]
    assert [m["content"] for m in replayed] == [
        first,
        f"reply to: {first}",
        second,
    ]
    assert replayed[0]["role"] == ROLE_USER
    assert "<retrieved_context>" in stub_llm[-1]["system"]


async def test_delete_conversation_cascades_messages_away(
    ensure_db, cleanup_conversations, api_client, stub_retrieval, stub_llm
):
    await init_models(engine)

    cid = await _create_conversation(api_client, cleanup_conversations)
    await api_client.post(
        f"/chat/conversations/{cid}/messages", json={"content": "doomed message"}
    )

    async with async_session() as session:
        before = (
            await session.scalars(
                select(Message.id).where(Message.conversation_id == cid)
            )
        ).all()
    assert len(before) == 2

    deleted = await api_client.delete(f"/chat/conversations/{cid}")
    assert deleted.status_code == 204

    async with async_session() as session:
        after = (
            await session.scalars(
                select(Message.id).where(Message.conversation_id == cid)
            )
        ).all()
    assert after == []

    assert (await api_client.get(f"/chat/conversations/{cid}/messages")).status_code == 404
    assert (await api_client.delete(f"/chat/conversations/{cid}")).status_code == 404


async def test_post_message_to_missing_conversation_is_404(
    ensure_db, api_client, stub_retrieval, stub_llm
):
    await init_models(engine)

    response = await api_client.post(
        "/chat/conversations/2147483000/messages", json={"content": "hello?"}
    )
    assert response.status_code == 404
    assert not stub_llm  # the LLM is never called for a missing conversation


async def test_complete_raises_when_api_key_is_blank(monkeypatch):
    """No key -> LLMNotConfigured, raised before any client is constructed."""
    for blank in ("", "   "):
        monkeypatch.setattr(settings, "anthropic_api_key", blank)
        with pytest.raises(LLMNotConfigured):
            await complete("system", [{"role": ROLE_USER, "content": "hi"}])


async def test_post_message_without_api_key_is_503_and_keeps_user_message(
    ensure_db, cleanup_conversations, api_client, stub_retrieval, monkeypatch
):
    """The unconfigured-LLM path must be a 503, not a 500, and must not lose the turn.

    `complete` is intentionally *not* stubbed here: the real one runs with the
    key blanked, so it raises LLMNotConfigured before touching the network.
    """
    await init_models(engine)
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    cid = await _create_conversation(api_client, cleanup_conversations)
    content = f"remember this {uuid.uuid4().hex[:8]}"

    response = await api_client.post(
        f"/chat/conversations/{cid}/messages", json={"content": content}
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "ANTHROPIC_API_KEY is not configured"

    # The user's turn was committed before the LLM call, so it survives.
    transcript = await api_client.get(f"/chat/conversations/{cid}/messages")
    assert [(m["role"], m["content"]) for m in transcript.json()] == [
        (ROLE_USER, content)
    ]

    # ...and so does the title derived from it.
    listed = await api_client.get("/chat/conversations")
    assert next(c for c in listed.json() if c["id"] == cid)["title"] == content
