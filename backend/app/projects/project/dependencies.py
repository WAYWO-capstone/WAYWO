import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.projects.project.repository import ProjectRepository
from app.projects.project.service import ProjectService


def get_current_user_id() -> uuid.UUID:
    """Seam for the authenticated user's id.

    The Accounts module is owned by another team and doesn't exist yet, so
    this fails closed (401) rather than faking authentication. When Accounts
    ships its auth dependency, replace this function with an import of it
    (it only needs to return the caller's user id). Until then, tests can
    use `app.dependency_overrides[get_current_user_id]`.
    """
    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Authentication is required"
    )


def get_project_service(session: Session = Depends(get_session)) -> ProjectService:
    return ProjectService(ProjectRepository(session))