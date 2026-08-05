"""HTTP endpoints for the Memory volume."""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.memory.schemas import (
    MemoryCreate,
    MemoryExtractOut,
    MemoryExtractRequest,
    MemoryOut,
)
from app.memory.service import (
    ConversationNotFound,
    LLMUnavailable,
    extract_from_conversation,
    forget,
    list_memories,
    remember,
)

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=list[MemoryOut])
async def list_memories_route(
    scope: str | None = Query(default=None),
    project: str | None = Query(default=None),
) -> list[MemoryOut]:
    """All memories, newest first, optionally filtered by scope and/or project."""
    memories = await list_memories(scope=scope, project=project)
    return [MemoryOut.model_validate(memory) for memory in memories]


@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory_route(payload: MemoryCreate) -> MemoryOut:
    """Store a memory by hand (the UI's "remember this" affordance)."""
    memory = await remember(
        scope=payload.scope, content=payload.content, project=payload.project
    )
    return MemoryOut.model_validate(memory)


@router.delete("/{mid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory_route(mid: int) -> Response:
    if not await forget(mid):
        raise HTTPException(status_code=404, detail=f"memory {mid} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/extract", response_model=MemoryExtractOut)
async def extract_route(payload: MemoryExtractRequest) -> MemoryExtractOut:
    """Mine a conversation for durable facts and persist them as memories."""
    try:
        extracted = await extract_from_conversation(payload.conversation_id)
    except ConversationNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except LLMUnavailable as exc:
        # The LLM backend is missing or has no API key -- retryable, not a bug
        # in the request.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    memories = [MemoryOut.model_validate(memory) for memory in extracted]
    return MemoryExtractOut(extracted=memories, count=len(memories))
