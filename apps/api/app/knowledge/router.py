"""HTTP endpoints for the Knowledge volume's vault-ingestion slice."""

from fastapi import APIRouter

from app.knowledge.ingest import scan_vault

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/reindex")
async def reindex() -> dict:
    """Rescan the vault and sync notes/links into Postgres."""
    return await scan_vault()
