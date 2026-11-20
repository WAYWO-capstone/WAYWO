import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.core.common import utcnow
from app.feed_items.feed_item.enums import FeedItemType
from app.feed_items.feed_item.models import FeedItem
from app.projects.updates.enums import UpdateReferenceReason, UpdateType
from app.projects.updates.media.models import UpdateMedia


class UpdateReference(Base):
    __tablename__ = "update_references"
    __table_args__ = (
        CheckConstraint(
            "update_id != referenced_update_id",
            name="ck_update_references_not_self",
        ),
    )

    update_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("updates.id", ondelete="CASCADE"), primary_key=True
    )
    referenced_update_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("updates.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    reason: Mapped[UpdateReferenceReason] = mapped_column(
        Enum(
            UpdateReferenceReason,
            name="update_reference_reason",
            native_enum=False,
            create_constraint=True,
            length=30,
        ),
        default=UpdateReferenceReason.RELATED_TO,
        server_default=UpdateReferenceReason.RELATED_TO.value,
    )

    source: Mapped["Update"] = relationship(
        back_populates="outgoing_references",
        foreign_keys=[update_id],
    )
    target: Mapped["Update"] = relationship(
        back_populates="incoming_references",
        foreign_keys=[referenced_update_id],
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

    outgoing_references: Mapped[list[UpdateReference]] = relationship(
        back_populates="source",
        foreign_keys=[UpdateReference.update_id],
        order_by=UpdateReference.referenced_update_id,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    incoming_references: Mapped[list[UpdateReference]] = relationship(
        back_populates="target",
        foreign_keys=[UpdateReference.referenced_update_id],
        order_by=UpdateReference.update_id,
        passive_deletes=True,
    )
    media: Mapped[list["UpdateMedia"]] = relationship(
        back_populates="update",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __mapper_args__ = {"polymorphic_identity": FeedItemType.UPDATE}
