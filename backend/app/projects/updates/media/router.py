import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.media.exceptions import MediaAttachmentUnavailableError
from app.projects.project.dependencies import (
    get_current_user_id,
    get_optional_current_user_id,
)
from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.updates.exceptions import UpdateNotFoundError, UpdateNotOwnedError
from app.projects.updates.media.dependencies import get_update_media_service
from app.projects.updates.media.schemas import UpdateMediaCreate, UpdateMediaRead
from app.projects.updates.media.service import UpdateMediaService

router = APIRouter(tags=["update media"])


@router.get(
    "/{project_id}/updates/{update_id}/media",
    response_model=list[UpdateMediaRead],
)
def list_update_media(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    viewer_id: Annotated[
        uuid.UUID | None,
        Depends(get_optional_current_user_id),
    ],
    service: Annotated[
        UpdateMediaService,
        Depends(get_update_media_service),
    ],
) -> list[UpdateMediaRead]:
    try:
        return service.list(project_id, update_id, viewer_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found") from exc
    except UpdateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found") from exc


@router.post(
    "/{project_id}/updates/{update_id}/media",
    response_model=UpdateMediaRead,
    status_code=status.HTTP_201_CREATED,
)
def attach_update_media(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: UpdateMediaCreate,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[
        UpdateMediaService,
        Depends(get_update_media_service),
    ],
) -> UpdateMediaRead:
    try:
        return service.attach(
            project_id,
            update_id,
            user_id,
            payload.upload_id,
        )
    except UpdateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found") from exc
    except UpdateNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not own this update",
        ) from exc
    except MediaAttachmentUnavailableError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This file can't be added to the update. Try uploading it again.",
        ) from exc
