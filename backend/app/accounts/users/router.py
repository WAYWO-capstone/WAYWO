from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.accounts.users.dependencies import get_current_user
from app.accounts.users.exceptions import ProfilePictureNotFoundError
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import ProfileResponse, ProfileUpdate
from app.accounts.users.service import MAX_PROFILE_PICTURE_BYTES, UserService
from app.core.database import get_session
from app.media.exceptions import ImageTooLargeError, UnsupportedImageError
from app.media.service import ObjectStorage

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
    """Update the logged-in user's bio."""

    return UserService(UserRepository(session)).update_profile(current_user, payload)


@router.post("/me/picture", response_model=ProfileResponse)
def upload_my_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProfileResponse:
    """Upload the logged-in user's profile picture."""

    content = file.file.read(MAX_PROFILE_PICTURE_BYTES + 1)
    try:
        return UserService(UserRepository(session)).set_profile_picture(
            current_user,
            content,
            file.content_type or "",
            ObjectStorage(),
        )
    except (UnsupportedImageError, ImageTooLargeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.delete("/me/picture", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_profile_picture(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """Delete the logged-in user's profile picture."""

    try:
        UserService(UserRepository(session)).delete_profile_picture(
            current_user,
            ObjectStorage(),
        )
    except ProfilePictureNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{username}", response_model=ProfileResponse)
def get_profile(
    username: str,
    session: Session = Depends(get_session),
) -> ProfileResponse:
    """Return a user's public profile."""

    if "/" in username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot contain '/'",
        )
    users = UserRepository(session)
    user = users.get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserService(users).get_profile(user)
