"""HTTP endpoints for the Projects volume."""

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.projects.schemas import (
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectStatus,
    ProjectUpdate,
)
from app.projects.service import (
    create_project,
    delete_project,
    get_project,
    get_project_detail,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects_route(
    status: ProjectStatus = Query(default="active"),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[ProjectOut]:
    """List projects, newest first. Defaults to active; pass status=archived
    for the archive drawer."""
    projects = await list_projects(status=status, limit=limit)
    return [ProjectOut.model_validate(project) for project in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project_route(payload: ProjectCreate) -> ProjectOut:
    project = await create_project(
        name=payload.name, description=payload.description
    )
    return ProjectOut.model_validate(project)


@router.get("/{pid}", response_model=ProjectDetailOut)
async def get_project_route(pid: int) -> ProjectDetailOut:
    detail = await get_project_detail(pid)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"project {pid} not found")
    return ProjectDetailOut.model_validate(detail)


@router.patch("/{pid}", response_model=ProjectOut)
async def update_project_route(pid: int, payload: ProjectUpdate) -> ProjectOut:
    # exclude_unset -> only the keys the caller actually sent are applied,
    # so PATCH with {"status": "archived"} doesn't wipe description.
    patch = payload.model_dump(exclude_unset=True)
    # No-op patch: still confirm the project exists so the caller sees 404
    # rather than silently getting a stale-looking 200.
    if not patch:
        project = await get_project(pid)
        if project is None:
            raise HTTPException(status_code=404, detail=f"project {pid} not found")
        return ProjectOut.model_validate(project)

    project = await update_project(pid, patch)
    if project is None:
        raise HTTPException(status_code=404, detail=f"project {pid} not found")
    return ProjectOut.model_validate(project)


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_route(pid: int) -> Response:
    if not await delete_project(pid):
        raise HTTPException(status_code=404, detail=f"project {pid} not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
