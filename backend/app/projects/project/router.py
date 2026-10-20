import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.projects.project.dependencies import (
    get_current_user_id,
    get_project_service,
)
from app.projects.project.exceptions import (
    CategoryNotFoundError,
    InvalidProjectStatusTransitionError,
    ProjectNotFoundError,
    ProjectNotOwnedError,
)
from app.projects.project.schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectStatusUpdate,
    ProjectUpdate,
)
from app.projects.project.service import ProjectService

router = APIRouter(tags=["projects"])

@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.create_project(current_user_id, payload)
    except CategoryNotFoundError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.update_project(project_id, current_user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except CategoryNotFoundError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        service.delete_project(project_id, current_user_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{project_id}/draft", response_model=ProjectRead)
def save_draft(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.save_draft(project_id, current_user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except CategoryNotFoundError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except InvalidProjectStatusTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.patch("/{project_id}/autosave", response_model=ProjectRead)
def autosave_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.autosave_project(project_id, current_user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except CategoryNotFoundError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except InvalidProjectStatusTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.post("/{project_id}/publish", response_model=ProjectRead)
def publish_project(
    project_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.publish_project(project_id, current_user_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except InvalidProjectStatusTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.post("/{project_id}/unpublish", response_model=ProjectRead)
def unpublish_project(
    project_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.unpublish_project(project_id, current_user_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except InvalidProjectStatusTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.patch("/{project_id}/status", response_model=ProjectRead)
def update_project_status(
    project_id: uuid.UUID,
    payload: ProjectStatusUpdate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    service: ProjectService = Depends(get_project_service),
):
    try:
        return service.update_status(project_id, current_user_id, payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ProjectNotOwnedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except InvalidProjectStatusTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
