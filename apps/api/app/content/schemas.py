"""Pydantic v2 request/response models for the Content Studio volume.

Mirrors the fixed HTTP contract the frontend builds against. ORM ContentDraft
instances are serialized directly via ``from_attributes``.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ContentKind = Literal[
    "linkedin",
    "blog",
    "email",
    "proposal",
    "report",
    "deck_outline",
    "tweet",
]
ContentLength = Literal["short", "medium", "long"]
ContentStatus = Literal["draft", "final", "archived"]


class ContentOut(BaseModel):
    """One content draft row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str | None = None
    body: str | None = None
    prompt: str
    tone: str | None = None
    length: str | None = None
    status: str
    project_id: int | None = None
    source_conversation_id: int | None = None
    # [{"note_id": int, "title": str, "vault_path": str, "score": float}, ...]
    sources: list[dict] | None = None
    model: str | None = None
    created_at: datetime
    updated_at: datetime


class ContentGenerateRequest(BaseModel):
    """POST /content/generate body."""

    kind: ContentKind
    prompt: str = Field(min_length=3, max_length=4000)
    project_id: int | None = None
    tone: str | None = Field(default=None, max_length=100)
    length: ContentLength | None = None
    source_conversation_id: int | None = None
    notes_query: str | None = Field(default=None, max_length=4000)


class ContentUpdate(BaseModel):
    """PATCH /content/{cid} body. Every field is optional; only sent keys apply."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, max_length=200_000)
    tone: str | None = Field(default=None, max_length=100)
    length: ContentLength | None = None
    status: ContentStatus | None = None
