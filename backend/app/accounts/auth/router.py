from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import AuthenticationError, DuplicateIdentityError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
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


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    session: Session = Depends(get_session),
) -> TokenResponse:
    """Verify an email or username and password, then return tokens."""

    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        return service.login(payload)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
