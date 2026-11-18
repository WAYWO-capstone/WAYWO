"""Business logic for follows, bookmarks, and folders."""

from app.accounts.users.models import Profile, User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import PublicProfileResponse
from app.accounts.users.service import UserService
from app.social.exceptions import (
    AlreadyFollowingError,
    FollowNotFoundError,
    SelfFollowError,
)
from app.social.models import CreatorFollow
from app.social.repository import SocialRepository


class SocialService:
    """Follows and unfollows creators."""

    def __init__(self, social: SocialRepository) -> None:
        self._social = social

    def follow_creator(self, follower: User, followed: User) -> CreatorFollow:
        """Create a follow from one user to another."""

        if follower.id == followed.id:
            raise SelfFollowError("You cannot follow yourself")
        existing = self._social.get_creator_follow(follower.id, followed.id)
        if existing is not None:
            raise AlreadyFollowingError("You already follow this creator")
        return self._social.add_creator_follow(
            CreatorFollow(follower_id=follower.id, followed_id=followed.id)
        )

    def is_following(self, follower: User, followed: User) -> bool:
        """Return whether the follower already follows the creator."""

        if follower.id == followed.id:
            return False
        return (
            self._social.get_creator_follow(follower.id, followed.id) is not None
        )

    def unfollow_creator(self, follower: User, followed: User) -> None:
        """Remove a follow from one user to another."""

        follow = self._social.get_creator_follow(follower.id, followed.id)
        if follow is None:
            raise FollowNotFoundError("You do not follow this creator")
        self._social.delete_creator_follow(follow)

    def list_followed_creators(
        self,
        follower: User,
    ) -> list[tuple[User, Profile | None, CreatorFollow]]:
        """Return followed creators in a stable, username-sorted order."""

        return self._social.list_followed_creators(follower.id)

    def get_public_profile(
        self,
        user: User,
        users: UserRepository,
    ) -> PublicProfileResponse:
        """Return account profile data with social follow counts."""

        profile = UserService(users).get_profile(user)
        return PublicProfileResponse(
            username=profile.username,
            bio=profile.bio,
            profile_picture_link=profile.profile_picture_link,
            followers_count=self._social.get_follower_count(user.id),
            following_count=self._social.get_following_count(user.id),
        )
