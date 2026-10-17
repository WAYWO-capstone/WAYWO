import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import InvalidTokenError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.service import AuthService
from app.accounts.users.dependencies import get_current_user
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.core.database import get_session
from app.projects.project.repository import ProjectRepository
from app.projects.project.service import ProjectService

optional_bearer = HTTPBearer(auto_error=False)


def get_current_user_id(user: User = Depends(get_current_user)) -> uuid.UUID:
    return user.id


def get_optional_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    session: Session = Depends(get_session),
) -> uuid.UUID | None:
    if credentials is None:
        return None

    auth = AuthService(UserRepository(session), AuthRepository(session))
    try:
        return auth.get_user_from_access_token(credentials.credentials).id
    except (InvalidTokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_project_service(session: Session = Depends(get_session)) -> ProjectService:
    return ProjectService(ProjectRepository(session))
