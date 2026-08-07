"""Pydantic v2 request/response models for the Research volume."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResearchQueryRequest(BaseModel):
    """POST /research/query body."""

    model_config = ConfigDict(extra="ignore")

    query: str = Field(min_length=3, max_length=4000)
    project_id: int | None = None
    save_to_vault: bool = False


class ResearchOut(BaseModel):
    """Response shape for every /research endpoint that returns a row."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    query: str
    summary: str | None = None
    status: str
    sources: list[dict] | None = None
    project_id: int | None = None
    saved_as_note_id: int | None = None
    model: str | None = None
    created_at: datetime
    updated_at: datetime
