"""HTTP endpoints for the Content Studio volume.

Non-streaming JSON only. Unknown ids -> 404. LLM misconfiguration or all-
providers-failed -> 503 so the frontend can tell "broken" from "not set up".
"""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.chat.llm import AllProvidersFailed, LLMNotConfigured
from app.content.schemas import (
    ContentGenerateRequest,
    ContentKind,
    ContentOut,
    ContentStatus,
    ContentUpdate,
)
from app.content.service import (
    ConversationNotFound,
    ProjectNotFound,
    delete_content,
    generate_content,
    get_content,
    list_content,
    update_content,
)

router = APIRouter(prefix="/content", tags=["content"])


@router.post(
    "/generate",
    response_model=ContentOut,
    status_code=status.HTTP_201_CREATED,
)
async def generate_route(payload: ContentGenerateRequest) -> ContentOut:
    """Generate one draft, grounded on retrieved notes + memories."""
    try:
        draft = await generate_content(
            kind=payload.kind,
            prompt=payload.prompt,
            project_id=payload.project_id,
            tone=payload.tone,
            length=payload.length,
            source_conversation_id=payload.source_conversation_id,
            notes_query=payload.notes_query,
        )
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ConversationNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except LLMNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM_API_KEY is not configured",
        ) from exc
    except AllProvidersFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            # Don't include str(exc) — it enumerates the configured provider
            # model names. Static message keeps our provider chain private.
            detail="All LLM providers are currently unavailable",
        ) from exc
    return ContentOut.model_validate(draft)


@router.get("", response_model=list[ContentOut])
async def list_content_route(
    project_id: int | None = Query(default=None),
    kind: ContentKind | None = Query(default=None),
    status: ContentStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> list[ContentOut]:
    """All drafts, newest first, with optional filters."""
    drafts = await list_content(
        project_id=project_id, kind=kind, status=status, limit=limit
    )
    return [ContentOut.model_validate(draft) for draft in drafts]


@router.get("/{cid}", response_model=ContentOut)
async def get_content_route(cid: int) -> ContentOut:
    draft = await get_content(cid)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"content {cid} not found")
    return ContentOut.model_validate(draft)


@router.patch("/{cid}", response_model=ContentOut)
async def update_content_route(cid: int, payload: ContentUpdate) -> ContentOut:
    # exclude_unset -> only keys the caller sent are applied, so a status flip
    # doesn't wipe title/body.
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        draft = await get_content(cid)
        if draft is None:
            raise HTTPException(status_code=404, detail=f"content {cid} not found")
        return ContentOut.model_validate(draft)
    draft = await update_content(cid, patch)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"content {cid} not found")
    return ContentOut.model_validate(draft)


@router.delete("/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_route(cid: int) -> Response:
    if not await delete_content(cid):
        raise HTTPException(status_code=404, detail=f"content {cid} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
