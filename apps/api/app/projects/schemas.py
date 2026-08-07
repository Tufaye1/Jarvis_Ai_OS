"""Pydantic schemas for the Projects volume's HTTP contract.

Field names/shapes here are a fixed contract shared with the frontend API
client and the tasks/planner volumes -- do not rename without coordinating.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.projects.models import STATUS_ACTIVE, STATUS_ARCHIVED

# Only these two statuses are accepted over HTTP; anything else 422s.
ProjectStatus = Literal[STATUS_ACTIVE, STATUS_ARCHIVED]


class ProjectOut(BaseModel):
    """A project as returned by list/create/patch endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class ProjectCounts(BaseModel):
    """Cheap aggregate counts attached to the detail response."""

    model_config = ConfigDict(from_attributes=True)

    tasks_open: int
    tasks_done: int
    memories: int


class ProjectDetailOut(ProjectOut):
    """Returned by GET /projects/{pid} -- adds cross-volume counts."""

    counts: ProjectCounts


class ProjectCreate(BaseModel):
    """Body of POST /projects."""

    model_config = ConfigDict(from_attributes=True)

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)


class ProjectUpdate(BaseModel):
    """Body of PATCH /projects/{pid} -- any subset of these fields is allowed."""

    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    status: ProjectStatus | None = None
