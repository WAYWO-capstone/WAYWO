import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Response,
    status,
)

from app.media.exceptions import MediaAttachmentUnavailableError
from app.projects.project.dependencies import (
    get_current_user_id,
    get_optional_current_user_id,
)
from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.updates.exceptions import (
    UpdateMediaNotFoundError,
    UpdateNotFoundError,
    UpdateNotOwnedError,
)
from app.projects.updates.media.dependencies import get_update_media_service
from app.projects.updates.media.schemas import UpdateMediaCreate, UpdateMediaRead
from app.projects.updates.media.service import UpdateMediaService

router = APIRouter(tags=["update media"])


@dataclass
class DeleteUpdateMediaContext:
    user_id: uuid.UUID
    background_tasks: BackgroundTasks
    service: UpdateMediaService


def get_delete_update_media_context(
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    background_tasks: BackgroundTasks,
    service: Annotated[
        UpdateMediaService,
        Depends(get_update_media_service),
    ],
) -> DeleteUpdateMediaContext:
    return DeleteUpdateMediaContext(user_id, background_tasks, service)


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


@router.delete(
    "/{project_id}/updates/{update_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_update_media(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
    context: Annotated[
        DeleteUpdateMediaContext,
        Depends(get_delete_update_media_context),
    ],
) -> Response:
    try:
        location = context.service.delete(
            project_id,
            update_id,
            media_id,
            context.user_id,
        )
    except UpdateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found") from exc
    except UpdateMediaNotFoundError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Update media not found",
        ) from exc
    except UpdateNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You do not own this update",
        ) from exc
    context.service.schedule_asset_cleanup(context.background_tasks, [location])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
