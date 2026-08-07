"""Pydantic schemas for the Tasks volume's HTTP contract.

Field names/shapes here are a fixed contract shared with the frontend API
client and the planner service -- do not rename without coordinating.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.tasks.models import STATUS_DOING, STATUS_DONE, STATUS_TODO

# Only these three statuses are accepted over HTTP; anything else is a 422.
Status = Literal[STATUS_TODO, STATUS_DOING, STATUS_DONE]


class TaskOut(BaseModel):
    """A stored task as returned by every /tasks endpoint (and the planner)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    project_id: int | None = None
    status: str
    due_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    """Body of POST /tasks."""

    model_config = ConfigDict(from_attributes=True)

    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10_000)
    project_id: int | None = None
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    """Body of PATCH /tasks/{tid}. Every field optional -- any subset patches."""

    model_config = ConfigDict(from_attributes=True)

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=10_000)
    project_id: int | None = None
    status: Status | None = None
    due_at: datetime | None = None
