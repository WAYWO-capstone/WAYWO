"""User identity dependencies used by other modules."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.security import InvalidTokenError
from app.accounts.auth.service import AuthService
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.core.database import get_session

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Resolve the authenticated user from a bearer access token."""

    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        return service.get_user_from_access_token(credentials.credentials)
    except (InvalidTokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
