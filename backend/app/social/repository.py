"""Data access for follows, bookmarks, and folders."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.users.models import Profile, User
from app.social.models import CreatorFollow


class SocialRepository:
    """Data access only. Flushes but never commits."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_creator_follow(
        self,
        follower_id: uuid.UUID,
        followed_id: uuid.UUID,
    ) -> CreatorFollow | None:
        return self._session.get(CreatorFollow, (follower_id, followed_id))

    def add_creator_follow(self, follow: CreatorFollow) -> CreatorFollow:
        self._session.add(follow)
        self._session.flush()
        return follow

    def delete_creator_follow(self, follow: CreatorFollow) -> None:
        self._session.delete(follow)
        self._session.flush()

    def list_followed_creators(
        self,
        follower_id: uuid.UUID,
    ) -> list[tuple[User, Profile | None, CreatorFollow]]:
        statement = (
            select(User, Profile, CreatorFollow)
            .join(CreatorFollow, CreatorFollow.followed_id == User.id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(CreatorFollow.follower_id == follower_id)
            .order_by(User.username)
        )
        return list(self._session.execute(statement).all())
