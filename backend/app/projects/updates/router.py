import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.projects.project.dependencies import get_current_user_id
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.updates.dependencies import get_update_service
from app.projects.updates.exceptions import (
    InvalidUpdateReferenceError,
    ReferencedUpdateNotFoundError,
    UpdateNotFoundError,
    UpdateNotOwnedError,
)
from app.projects.updates.schemas import (
    UpdateCreate,
    UpdateEdit,
    UpdateHistoryPage,
    UpdateRead,
)
from app.projects.updates.service import UpdateService

router = APIRouter(tags=["project updates"])


def _reference_http_exception(
    exc: ReferencedUpdateNotFoundError | InvalidUpdateReferenceError,
) -> HTTPException:
    if isinstance(exc, ReferencedUpdateNotFoundError):
        return HTTPException(
            status.HTTP_404_NOT_FOUND, "Referenced update not found"
        )
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid update reference"
    )


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
    except (ReferencedUpdateNotFoundError, InvalidUpdateReferenceError) as exc:
        raise _reference_http_exception(exc) from exc


@router.get("/{project_id}/updates", response_model=UpdateHistoryPage)
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


@router.patch(
    "/{project_id}/updates/{update_id}",
    response_model=UpdateRead,
)
def edit_project_update(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: UpdateEdit,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UpdateService, Depends(get_update_service)],
) -> UpdateRead:
    try:
        return service.edit_project_update(project_id, update_id, user_id, payload)
    except UpdateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found") from exc
    except UpdateNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You do not own this update"
        ) from exc
    except (ReferencedUpdateNotFoundError, InvalidUpdateReferenceError) as exc:
        raise _reference_http_exception(exc) from exc


@router.delete(
    "/{project_id}/updates/{update_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_update(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UpdateService, Depends(get_update_service)],
) -> Response:
    try:
        service.delete_project_update(project_id, update_id, user_id)
    except UpdateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Update not found") from exc
    except UpdateNotOwnedError as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You do not own this update"
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
