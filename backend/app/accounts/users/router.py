from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.accounts.users.dependencies import get_current_user
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import ProfileResponse, ProfileUpdate
from app.accounts.users.service import UserService
from app.core.database import get_session

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProfileResponse:
    """Return the logged-in user's profile."""

    return UserService(UserRepository(session)).get_profile(current_user)


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProfileResponse:
    """Update the logged-in user's bio or picture link."""

    return UserService(UserRepository(session)).update_profile(current_user, payload)


@router.get("/{username}", response_model=ProfileResponse)
def get_profile(
    username: str,
    session: Session = Depends(get_session),
) -> ProfileResponse:
    """Return a user's public profile."""

    users = UserRepository(session)
    user = users.get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserService(users).get_profile(user)
