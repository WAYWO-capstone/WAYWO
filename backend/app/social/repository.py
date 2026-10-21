"""Data access for follows, bookmarks, and folders."""

import uuid

from sqlalchemy.orm import Session

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
