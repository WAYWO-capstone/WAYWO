import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.media.exceptions import MediaAttachmentUnavailableError
from app.projects.project.dependencies import (
    get_current_user_id,
    get_optional_current_user_id,
)
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.resources.dependencies import get_resource_service
from app.projects.resources.schemas import ResourceCreate, ResourceRead
from app.projects.resources.service import ResourceService

router = APIRouter(tags=["project resources"])


@router.post(
    "/{project_id}/resources",
    response_model=ResourceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_resource(
    project_id: uuid.UUID,
    payload: ResourceCreate,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[ResourceService, Depends(get_resource_service)],
) -> ResourceRead:
    try:
        return service.create(project_id, user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found") from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You do not own this project"
        ) from exc
    except MediaAttachmentUnavailableError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This file can't be added to the project. Try uploading it again.",
        ) from exc


@router.get("/{project_id}/resources", response_model=list[ResourceRead])
def list_project_resources(
    project_id: uuid.UUID,
    viewer_id: Annotated[uuid.UUID | None, Depends(get_optional_current_user_id)],
    service: Annotated[ResourceService, Depends(get_resource_service)],
) -> list[ResourceRead]:
    try:
        return service.list(project_id, viewer_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found") from exc
