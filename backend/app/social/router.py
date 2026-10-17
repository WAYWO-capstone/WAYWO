from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.accounts.users.dependencies import get_current_user
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.core.database import get_session
from app.social.exceptions import (
    AlreadyFollowingError,
    FollowNotFoundError,
    SelfFollowError,
)
from app.social.repository import SocialRepository
from app.social.schemas import CreatorFollowResponse, FollowingStatusResponse
from app.social.service import SocialService

router = APIRouter(prefix="/follows", tags=["social"])


def _followed_user(username: str, session: Session) -> User:
    user = UserRepository(session).get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.get("/{username}", response_model=FollowingStatusResponse)
def get_following_status(
    username: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FollowingStatusResponse:
    """Return whether the logged-in user follows this creator."""

    followed = _followed_user(username, session)
    service = SocialService(SocialRepository(session))
    return FollowingStatusResponse(
        is_following=service.is_following(current_user, followed)
    )


@router.post(
    "/{username}",
    response_model=CreatorFollowResponse,
    status_code=status.HTTP_201_CREATED,
)
def follow_creator(
    username: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CreatorFollowResponse:
    """Follow a creator. Requires a logged-in user."""

    followed = _followed_user(username, session)
    service = SocialService(SocialRepository(session))
    try:
        return service.follow_creator(current_user, followed)
    except SelfFollowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AlreadyFollowingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.delete("/{username}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_creator(
    username: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """Unfollow a creator. Requires a logged-in user."""

    followed = _followed_user(username, session)
    service = SocialService(SocialRepository(session))
    try:
        service.unfollow_creator(current_user, followed)
    except FollowNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
