"""Persistence models for follows, bookmarks, and folders."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class CreatorFollow(Base):
    """One user following another user."""

    __tablename__ = "creator_follows"

    follower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    followed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    followed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=false(),
    )
