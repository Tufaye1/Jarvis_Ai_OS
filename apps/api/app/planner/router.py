"""HTTP endpoints for the Planner volume."""

from datetime import date
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from app.planner.service import today
from app.tasks.schemas import TaskOut

router = APIRouter(prefix="/planner", tags=["planner"])


class PlannerToday(BaseModel):
    """Response shape for GET /planner/today."""

    model_config = ConfigDict(from_attributes=True)

    date: date
    priorities: list[TaskOut]
    overdue: list[TaskOut]
    due_today: list[TaskOut]
    in_progress: list[TaskOut]
    completed_today: list[TaskOut]


@router.get("/today", response_model=PlannerToday)
async def get_today() -> dict[str, Any]:
    """Today's dashboard: priorities + the four bucketed task lists."""
    return await today()
