import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.projects.project.dependencies import (
    get_current_user_id,
    get_project_service,
)
from app.projects.project.exceptions import CategoryNotFoundError
from app.projects.project.schemas import ProjectCreate, ProjectRead
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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))