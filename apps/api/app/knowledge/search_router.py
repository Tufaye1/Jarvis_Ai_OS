"""Routes for embedding backfill and semantic search over notes."""

from fastapi import APIRouter, Query

from app.knowledge.embeddings import backfill_embeddings
from app.knowledge.search import semantic_search

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/backfill-embeddings")
async def backfill_embeddings_route() -> dict:
    return await backfill_embeddings()


@router.get("/search")
async def search_route(q: str = Query(...), limit: int = 10) -> list[dict]:
    return await semantic_search(q, limit=limit)
