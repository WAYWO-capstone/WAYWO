from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import (
    AuthenticationError,
    DuplicateIdentityError,
    InvalidTokenError,
)
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import (
    EmailChangeRequest,
    LoginRequest,
    PasswordChangeRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.accounts.auth.service import AuthService
from app.accounts.users.dependencies import get_current_user
from app.accounts.users.models import User
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
    session: Session = Depends(get_session, scope="function"),
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
    session: Session = Depends(get_session, scope="function"),
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


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    session: Session = Depends(get_session, scope="function"),
) -> TokenResponse:
    """Issue a new token pair from a refresh token."""

    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        return service.refresh(payload)
    except (AuthenticationError, InvalidTokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.patch("/email", response_model=UserResponse)
def change_email(
    payload: EmailChangeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session, scope="function"),
) -> UserResponse:
    # use the signed in account instead of taking a user id from the request
    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        user = service.change_email(current_user, payload)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except DuplicateIdentityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return UserResponse.model_validate(user)

@router.patch(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session, scope="function"),
) -> Response:
    # change the password for the signed in account
    service = AuthService(UserRepository(session), AuthRepository(session))
    try:
        service.change_password(current_user, payload)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
