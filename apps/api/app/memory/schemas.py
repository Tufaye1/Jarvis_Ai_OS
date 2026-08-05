"""Pydantic schemas for the Memory volume's HTTP contract.

Field names/shapes here are a fixed contract shared with the frontend API
client -- do not rename without coordinating.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.memory.models import SCOPE_GLOBAL, SCOPE_PROJECT, SCOPE_SESSION

# Only these three scopes are accepted over HTTP; anything else is a 422.
Scope = Literal[SCOPE_GLOBAL, SCOPE_PROJECT, SCOPE_SESSION]


class MemoryOut(BaseModel):
    """A stored memory as returned by every /memory endpoint.

    `embedding` is deliberately omitted -- 384 floats are useless to a client.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    scope: str
    project: str | None = None
    content: str
    source_conversation_id: int | None = None
    created_at: datetime
    updated_at: datetime


class MemoryCreate(BaseModel):
    """Body of POST /memory."""

    model_config = ConfigDict(from_attributes=True)

    scope: Scope
    # Only meaningful for scope="project"; the service nulls it otherwise.
    project: str | None = None
    content: str = Field(min_length=1)


class MemoryExtractRequest(BaseModel):
    """Body of POST /memory/extract."""

    model_config = ConfigDict(from_attributes=True)

    conversation_id: int


class MemoryExtractOut(BaseModel):
    """Response of POST /memory/extract: the memories that were just created."""

    model_config = ConfigDict(from_attributes=True)

    extracted: list[MemoryOut]
    count: int
