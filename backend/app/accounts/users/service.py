"""Business logic for users and profiles."""

from app.accounts.users.exceptions import ProfilePictureNotFoundError
from app.accounts.users.models import Profile, User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import (
    AccountProfileResponse,
    ProfileResponse,
    ProfileUpdate,
)
from app.media.exceptions import ImageTooLargeError
from app.media.service import ObjectStorage

MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024


class UserService:
    """Reads and updates a user's profile."""

    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def get_profile(self, user: User) -> ProfileResponse:
        """Return the profile for a user, with empty details when none is saved."""

        profile = self._users.get_profile(user.id)
        return self._response(user, profile)

    def get_account_profile(self, user: User) -> AccountProfileResponse:
        """Return the signed-in user's profile, including their email."""

        profile = self.get_profile(user)
        return AccountProfileResponse(
            username=profile.username,
            bio=profile.bio,
            profile_picture_link=profile.profile_picture_link,
            email=user.email,
        )

    def update_profile(self, user: User, payload: ProfileUpdate) -> ProfileResponse:
        """Change bio or picture link. Leave out a field to keep its current value."""

        profile = self._users.get_profile(user.id)
        if profile is None:
            profile = Profile(user_id=user.id)
        if "bio" in payload.model_fields_set:
            profile.bio = payload.bio
        if "profile_picture_link" in payload.model_fields_set:
            profile.profile_picture_link = payload.profile_picture_link
        saved = self._users.save_profile(profile)
        return self._response(user, saved)

    def set_profile_picture(
        self,
        user: User,
        content: bytes,
        content_type: str,
        storage: ObjectStorage,
    ) -> ProfileResponse:
        """Upload a profile picture and save its public link."""

        if len(content) > MAX_PROFILE_PICTURE_BYTES:
            raise ImageTooLargeError("Profile picture must be 5 MB or smaller")
        link = storage.upload_profile_picture(user.id, content, content_type)
        profile = self._users.get_profile(user.id)
        if profile is None:
            profile = Profile(user_id=user.id)
        profile.profile_picture_link = link
        saved = self._users.save_profile(profile)
        return self._response(user, saved)

    def delete_profile_picture(self, user: User, storage: ObjectStorage) -> None:
        """Remove the profile picture and clear its link."""

        profile = self._users.get_profile(user.id)
        if profile is None or profile.profile_picture_link is None:
            raise ProfilePictureNotFoundError("You do not have a profile picture")
        storage.delete_profile_picture(user.id)
        profile.profile_picture_link = None
        self._users.save_profile(profile)

    def _response(self, user: User, profile: Profile | None) -> ProfileResponse:
        return ProfileResponse(
            username=user.username,
            bio=None if profile is None else profile.bio,
            profile_picture_link=(
                None if profile is None else profile.profile_picture_link
            ),
        )
