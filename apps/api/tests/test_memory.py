"""Integration tests for the Memory volume (service + HTTP router).

Real Postgres/pgvector does the cosine ranking -- that's the part worth
testing -- but `embed_text` is monkeypatched with a deterministic stand-in so
no test needs the network-downloaded fastembed model (same approach as
test_search.py / test_embeddings.py). `extract_from_conversation` reaches the
LLM through a lazy `from app.chat.llm import complete`, so that module
attribute is patched rather than `app.chat.service`'s copy.
"""

import uuid

import pytest

import app.chat.llm as llm_module
import app.memory.service as memory_service
from app.base import init_models
from app.chat.models import ROLE_ASSISTANT, ROLE_USER, Conversation, Message
from app.db import async_session, engine
from app.memory.models import SCOPE_GLOBAL, SCOPE_PROJECT, SCOPE_SESSION, Memory

EMBED_DIM = 384


def _unit_vector(index: int, dim: int = EMBED_DIM) -> list[float]:
    vector = [0.0] * dim
    vector[index] = 1.0
    return vector


@pytest.fixture
def keyword_embed(monkeypatch):
    """Map text onto orthogonal unit vectors by keyword, so ranking is exact.

    Text containing "alpha" embeds to axis 0, "beta" to axis 1, anything else
    to axis 2. Cosine distance is then 0 for a match and 1 for a non-match.
    """

    def _embed(text: str) -> list[float]:
        lowered = text.lower()
        if "alpha" in lowered:
            return _unit_vector(0)
        if "beta" in lowered:
            return _unit_vector(1)
        return _unit_vector(2)

    monkeypatch.setattr(memory_service, "embed_text", _embed)
    return _embed


async def test_remember_persists_memory_with_embedding(
    ensure_db, cleanup_memories, keyword_embed
):
    await init_models(engine)

    content = f"The user prefers alpha builds {uuid.uuid4().hex[:8]}"
    memory = await memory_service.remember(SCOPE_GLOBAL, content)
    cleanup_memories.append(memory.id)

    assert memory.id is not None
    assert memory.scope == SCOPE_GLOBAL
    assert memory.project is None
    assert memory.created_at is not None

    async with async_session() as session:
        stored = await session.get(Memory, memory.id)
        assert stored.content == content
        assert stored.embedding is not None
        assert len(stored.embedding) == EMBED_DIM
        assert list(stored.embedding) == pytest.approx(_unit_vector(0))


async def test_remember_drops_project_for_non_project_scopes(
    ensure_db, cleanup_memories, keyword_embed
):
    """`project` is only meaningful for scope="project"; it's nulled otherwise."""
    await init_models(engine)

    scoped = await memory_service.remember(
        SCOPE_PROJECT, f"project fact {uuid.uuid4().hex[:8]}", project="jarvis"
    )
    cleanup_memories.append(scoped.id)
    assert scoped.project == "jarvis"

    for scope in (SCOPE_GLOBAL, SCOPE_SESSION):
        memory = await memory_service.remember(
            scope, f"{scope} fact {uuid.uuid4().hex[:8]}", project="jarvis"
        )
        cleanup_memories.append(memory.id)
        assert memory.project is None


async def test_recall_ranks_by_cosine_similarity(
    ensure_db, cleanup_memories, keyword_embed
):
    """Closest-first ordering, with score = 1 - cosine_distance.

    The two rows are put in a throwaway project scope and recalled through
    that filter, so the assertion holds no matter what else already lives in
    this shared dev database.
    """
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    project = f"rank-{unique}"
    close_content = f"alpha memory {unique}"
    far_content = f"beta memory {unique}"

    for content in (far_content, close_content):  # inserted worst-match first
        memory = await memory_service.remember(
            SCOPE_PROJECT, content, project=project
        )
        cleanup_memories.append(memory.id)

    results = await memory_service.recall(
        "alpha query", limit=10, scope=SCOPE_PROJECT, project=project
    )

    assert [r["content"] for r in results] == [close_content, far_content]
    # identical direction -> distance 0 -> score 1; orthogonal -> distance 1 -> score 0
    assert results[0]["score"] == pytest.approx(1.0, abs=1e-4)
    assert results[1]["score"] == pytest.approx(0.0, abs=1e-4)
    assert results[0]["scope"] == SCOPE_PROJECT
    assert results[0]["project"] == project

    # Querying from the other side flips the ranking.
    flipped = await memory_service.recall(
        "beta query", limit=10, scope=SCOPE_PROJECT, project=project
    )
    assert [r["content"] for r in flipped] == [far_content, close_content]

    assert (
        len(
            await memory_service.recall(
                "alpha query", limit=1, scope=SCOPE_PROJECT, project=project
            )
        )
        == 1
    )
    assert await memory_service.recall("alpha query", limit=0) == []


async def test_recall_and_list_respect_scope_and_project_filters(
    ensure_db, cleanup_memories, keyword_embed
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    # All three embed identically (no "alpha"/"beta"), so only the filters can
    # separate them.
    global_memory = await memory_service.remember(
        SCOPE_GLOBAL, f"global fact {unique}"
    )
    jarvis_memory = await memory_service.remember(
        SCOPE_PROJECT, f"jarvis fact {unique}", project=f"jarvis-{unique}"
    )
    other_memory = await memory_service.remember(
        SCOPE_PROJECT, f"other fact {unique}", project=f"other-{unique}"
    )
    cleanup_memories.extend([global_memory.id, jarvis_memory.id, other_memory.id])

    mine = {global_memory.id, jarvis_memory.id, other_memory.id}

    recalled = await memory_service.recall(
        "anything", limit=100, scope=SCOPE_PROJECT, project=f"jarvis-{unique}"
    )
    assert [r["id"] for r in recalled if r["id"] in mine] == [jarvis_memory.id]

    # Filtering by scope alone must drop the global row (asserted as an
    # exclusion, since other project memories in this database may outrank it).
    project_only = await memory_service.recall(
        "anything", limit=100, scope=SCOPE_PROJECT
    )
    assert global_memory.id not in {r["id"] for r in project_only}

    listed = await memory_service.list_memories(
        scope=SCOPE_PROJECT, project=f"jarvis-{unique}"
    )
    assert [m.id for m in listed if m.id in mine] == [jarvis_memory.id]

    listed_global = await memory_service.list_memories(scope=SCOPE_GLOBAL)
    assert {m.id for m in listed_global} & mine == {global_memory.id}


async def test_forget_deletes_then_returns_false_for_missing_id(
    ensure_db, cleanup_memories, keyword_embed
):
    await init_models(engine)

    memory = await memory_service.remember(
        SCOPE_GLOBAL, f"forget me {uuid.uuid4().hex[:8]}"
    )
    cleanup_memories.append(memory.id)
    memory_id = memory.id

    assert await memory_service.forget(memory_id) is True

    async with async_session() as session:
        assert await session.get(Memory, memory_id) is None

    # Second delete of the same (now gone) row, and an id that never existed.
    assert await memory_service.forget(memory_id) is False
    assert await memory_service.forget(2147483000) is False


async def test_memory_routes_create_list_and_delete(
    ensure_db, cleanup_memories, api_client, keyword_embed
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    created = await api_client.post(
        "/memory",
        json={"scope": SCOPE_PROJECT, "project": f"api-{unique}", "content": f"api fact {unique}"},
    )
    assert created.status_code == 201
    body = created.json()
    cleanup_memories.append(body["id"])
    assert body["scope"] == SCOPE_PROJECT
    assert body["project"] == f"api-{unique}"
    assert "embedding" not in body  # 384 floats are useless to a client

    listed = await api_client.get("/memory", params={"project": f"api-{unique}"})
    assert listed.status_code == 200
    assert [m["id"] for m in listed.json()] == [body["id"]]

    # An unknown scope is a 422 from the Literal, not a stored row.
    rejected = await api_client.post(
        "/memory", json={"scope": "nonsense", "content": "nope"}
    )
    assert rejected.status_code == 422

    assert (await api_client.delete(f"/memory/{body['id']}")).status_code == 204
    assert (await api_client.delete(f"/memory/{body['id']}")).status_code == 404


async def test_extract_from_conversation_stores_facts_and_skips_duplicates(
    ensure_db, cleanup_conversations, cleanup_memories, keyword_embed, monkeypatch
):
    await init_models(engine)

    unique = uuid.uuid4().hex[:8]
    fact_one = f"The user works on Jarvis {unique}"
    fact_two = f"The user prefers concise replies {unique}"

    async with async_session() as session:
        conversation = Conversation(title=f"extract {unique}")
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        cleanup_conversations.append(conversation.id)

        session.add_all(
            [
                Message(
                    conversation_id=conversation.id,
                    role=ROLE_USER,
                    content=f"I work on Jarvis {unique} and I like short answers.",
                ),
                Message(
                    conversation_id=conversation.id,
                    role=ROLE_ASSISTANT,
                    content="Noted.",
                ),
            ]
        )
        await session.commit()

    # The real complete() is replaced on app.chat.llm because the memory
    # service imports it lazily from there, not from app.chat.service.
    async def _complete(system, messages, max_tokens=2048):
        # Surrounding prose and a code fence: _parse_facts must tolerate slop.
        return f'Sure!\n```json\n["{fact_one}", "{fact_two}", 7, "  "]\n```'

    monkeypatch.setattr(llm_module, "complete", _complete)

    extracted = await memory_service.extract_from_conversation(conversation.id)
    cleanup_memories.extend(m.id for m in extracted)

    assert [m.content for m in extracted] == [fact_one, fact_two]
    assert all(m.scope == SCOPE_GLOBAL for m in extracted)
    assert all(m.source_conversation_id == conversation.id for m in extracted)

    # Re-running is safe: facts already extracted from this conversation are skipped.
    again = await memory_service.extract_from_conversation(conversation.id)
    cleanup_memories.extend(m.id for m in again)
    assert again == []


async def test_extract_raises_for_missing_conversation(ensure_db):
    await init_models(engine)

    with pytest.raises(memory_service.ConversationNotFound):
        await memory_service.extract_from_conversation(2147483000)


async def test_extract_maps_unconfigured_llm_to_llm_unavailable(
    ensure_db, cleanup_conversations, keyword_embed, monkeypatch
):
    """A blank API key must surface as LLMUnavailable (503), not a 500 traceback."""
    await init_models(engine)

    async with async_session() as session:
        conversation = Conversation(title=f"no-key {uuid.uuid4().hex[:8]}")
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        cleanup_conversations.append(conversation.id)

        session.add(
            Message(
                conversation_id=conversation.id,
                role=ROLE_USER,
                content="Something worth remembering.",
            )
        )
        await session.commit()

    async def _complete(system, messages, max_tokens=2048):
        raise llm_module.LLMNotConfigured("LLM_API_KEY is not configured")

    monkeypatch.setattr(llm_module, "complete", _complete)

    with pytest.raises(memory_service.LLMUnavailable):
        await memory_service.extract_from_conversation(conversation.id)
