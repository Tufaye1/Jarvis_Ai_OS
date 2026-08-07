"""HTTP endpoints for the Research volume.

Synchronous execution — POST /research/query blocks until the LLM answers or
fails. LLM outages surface as 503 with the same static message used elsewhere.
"""

from fastapi import APIRouter, HTTPException, Query, status

from app.chat.llm import AllProvidersFailed, LLMNotConfigured
from app.research.models import ResearchQuery
from app.research.schemas import ResearchOut, ResearchQueryRequest
from app.research.service import (
    ProjectNotFound,
    ResearchNotReady,
    create_research,
    delete_research,
    get_research,
    list_research,
    save_to_vault,
)

router = APIRouter(prefix="/research", tags=["research"])

_LLM_UNAVAILABLE_DETAIL = "All LLM providers are currently unavailable"


def _map_llm_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=_LLM_UNAVAILABLE_DETAIL,
    )


@router.post(
    "/query",
    response_model=ResearchOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_query(payload: ResearchQueryRequest) -> ResearchQuery:
    """Run a research pass synchronously and return the finished row."""
    try:
        return await create_research(
            query=payload.query,
            project_id=payload.project_id,
            save_to_vault=payload.save_to_vault,
        )
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except (LLMNotConfigured, AllProvidersFailed) as exc:
        raise _map_llm_error(exc) from exc


@router.get("", response_model=list[ResearchOut])
async def list_queries(
    project_id: int | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[ResearchQuery]:
    """All research rows, newest first, with optional project/status filters."""
    return await list_research(project_id=project_id, status=status, limit=limit)


@router.get("/{rid}", response_model=ResearchOut)
async def get_query(rid: int) -> ResearchQuery:
    row = await get_research(rid)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research {rid} not found",
        )
    return row


@router.post("/{rid}/save-to-vault", response_model=ResearchOut)
async def save_query_to_vault(rid: int) -> ResearchQuery:
    """Persist a ready research row as a Note in the vault. Idempotent."""
    try:
        return await save_to_vault(rid)
    except ResearchNotReady as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.delete("/{rid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_query(rid: int) -> None:
    deleted = await delete_research(rid)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research {rid} not found",
        )
