from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import DuplicateIdentityError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import RegisterRequest
from app.accounts.auth.service import AuthService
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserResponse
from app.core.database import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
) -> UserResponse:
    """Create an account and return the user without the password."""

    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        user = service.register(payload)
    except DuplicateIdentityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return user
