"""Abstract FeedItem base.

Per the domain model, Project (and later Update, Tutorial) are FeedItems.
Implemented as joined-table inheritance: shared columns live in `feed_items`,
subclass columns in their own table keyed by the same id.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.feed_items.feed_item.enums import FeedItemType

from app.core.common import utcnow

class FeedItem(Base):
    __tablename__ = "feed_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    type: Mapped[FeedItemType] = mapped_column(
        Enum(FeedItemType, native_enum=False, length=30)
    )
    # "User creates FeedItem" -- for a Project this is the owner.
    # TODO: add ForeignKey("users.id", ondelete="CASCADE") once the Accounts
    # module (owned by another team) provides the users table.
    author_id: Mapped[uuid.UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(200))
    public: Mapped[bool] = mapped_column(Boolean, default=False)
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    __mapper_args__ = {"polymorphic_on": "type"}