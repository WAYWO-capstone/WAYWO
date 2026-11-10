import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.common import utcnow
from app.feed_items.feed_item.enums import FeedItemType
from app.feed_items.feed_item.models import FeedItem
from app.projects.updates.enums import UpdateType


update_references = Table(
    "update_references",
    FeedItem.metadata,
    Column(
        "update_id",
        ForeignKey("updates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "referenced_update_id",
        ForeignKey("updates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Update(FeedItem):
    __tablename__ = "updates"

    # Shares its primary key with feed_items (joined-table inheritance).
    # title, public, body, created_at and the owner (author_id) are inherited.
    id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("feed_items.id", ondelete="CASCADE"), primary_key=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    update_type: Mapped[UpdateType] = mapped_column(
        "type",
        Enum(
            UpdateType,
            name="update_type",
            native_enum=False,
            create_constraint=True,
            length=20,
        ),
        default=UpdateType.PROGRESS,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    references: Mapped[list["Update"]] = relationship(
        secondary=update_references,
        primaryjoin=id == update_references.c.update_id,
        secondaryjoin=id == update_references.c.referenced_update_id,
        foreign_keys=(
            update_references.c.update_id,
            update_references.c.referenced_update_id,
        ),
        passive_deletes=True,
    )

    __mapper_args__ = {"polymorphic_identity": FeedItemType.UPDATE}
