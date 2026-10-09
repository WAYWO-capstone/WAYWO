import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.feed_items.feed_item.models import FeedItem
from app.feed_items.feed_item.enums import FeedItemType
from app.projects.project.enums import ProjectStatus

project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True)


class Project(FeedItem):
    __tablename__ = "projects"

    # Shares its primary key with feed_items (joined-table inheritance).
    # title, public, body, created_at and the owner (author_id) are inherited.
    id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("feed_items.id", ondelete="CASCADE"), primary_key=True
    )
    summary: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status"), default=ProjectStatus.DRAFT
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id"), index=True
    )
    last_autosaved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    category: Mapped[Category] = relationship(lazy="selectin")
    tags: Mapped[list[Tag]] = relationship(secondary=project_tags, lazy="selectin")

    __mapper_args__ = {"polymorphic_identity": "project"}
    __mapper_args__ = {"polymorphic_identity": FeedItemType.PROJECT}