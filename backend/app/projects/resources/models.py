import uuid
from datetime import datetime

# Pylint does not recognize SQLAlchemy's generic mapped annotations.
# pylint: disable=unsubscriptable-object
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.core.common import utcnow
from app.media.models import FileAsset


class ProjectResource(Base):
    """A verified file attached to a project. A plain table, not a FeedItem."""

    __tablename__ = "project_resources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    file_asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("file_assets.id", ondelete="CASCADE"), unique=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    file_asset: Mapped[FileAsset] = relationship(lazy="joined")
