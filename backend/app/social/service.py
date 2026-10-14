"""Business logic for follows, bookmarks, and folders."""

from app.accounts.users.models import User
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

    def unfollow_creator(self, follower: User, followed: User) -> None:
        """Remove a follow from one user to another."""

        follow = self._social.get_creator_follow(follower.id, followed.id)
        if follow is None:
            raise FollowNotFoundError("You do not follow this creator")
        self._social.delete_creator_follow(follow)
