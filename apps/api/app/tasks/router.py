"""HTTP endpoints for the Tasks volume."""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.tasks.schemas import Status, TaskCreate, TaskOut, TaskUpdate
from app.tasks.service import (
    create_task,
    delete_task,
    get_task,
    list_tasks,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task_route(payload: TaskCreate) -> TaskOut:
    task = await create_task(
        title=payload.title,
        description=payload.description,
        project_id=payload.project_id,
        due_at=payload.due_at,
    )
    return TaskOut.model_validate(task)


@router.get("", response_model=list[TaskOut])
async def list_tasks_route(
    project_id: int | None = Query(default=None),
    status: Status | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=500),
) -> list[TaskOut]:
    tasks = await list_tasks(project_id=project_id, status=status, limit=limit)
    return [TaskOut.model_validate(task) for task in tasks]


@router.get("/{tid}", response_model=TaskOut)
async def get_task_route(tid: int) -> TaskOut:
    task = await get_task(tid)
    if task is None:
        raise HTTPException(status_code=404, detail=f"task {tid} not found")
    return TaskOut.model_validate(task)


@router.patch("/{tid}", response_model=TaskOut)
async def update_task_route(tid: int, payload: TaskUpdate) -> TaskOut:
    # exclude_unset=True is the PATCH contract: only touch fields the client
    # actually sent, so `description: null` stays distinguishable from omit.
    patch = payload.model_dump(exclude_unset=True)
    task = await update_task(tid, patch)
    if task is None:
        raise HTTPException(status_code=404, detail=f"task {tid} not found")
    return TaskOut.model_validate(task)


@router.delete("/{tid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_route(tid: int) -> Response:
    if not await delete_task(tid):
        raise HTTPException(status_code=404, detail=f"task {tid} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
