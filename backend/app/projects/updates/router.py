import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.projects.project.dependencies import get_current_user_id
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.updates.dependencies import get_update_service
from app.projects.updates.schemas import UpdateCreate, UpdateHistoryPage, UpdateRead
from app.projects.updates.service import UpdateService

router = APIRouter(tags=["project updates"])


@router.post(
    "/{project_id}/updates",
    response_model=UpdateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_update(
    project_id: uuid.UUID,
    payload: UpdateCreate,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UpdateService, Depends(get_update_service)],
) -> UpdateRead:
    try:
        return service.create_project_update(project_id, user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Project not found"
        ) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You do not own this project"
        ) from exc


@router.get("/{project_id}/history", response_model=UpdateHistoryPage)
def get_project_history(
    project_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UpdateService, Depends(get_update_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UpdateHistoryPage:
    try:
        updates, total = service.list_project_updates(
            project_id, user_id, limit=limit, offset=offset
        )
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Project not found"
        ) from exc

    return UpdateHistoryPage(
        items=updates, total=total, limit=limit, offset=offset
    )
