import uuid
from datetime import datetime
from typing import TYPE_CHECKING

# Pylint does not recognize SQLAlchemy's generic mapped annotations.
# pylint: disable=unsubscriptable-object
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base
from app.core.common import utcnow
from app.media.models import FileAsset

if TYPE_CHECKING:
    from app.projects.updates.models import Update


class UpdateMedia(Base):
    """A verified file attached to an update."""

    __tablename__ = "update_media"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    update_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("updates.id", ondelete="CASCADE"), index=True
    )
    file_asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("file_assets.id", ondelete="CASCADE"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    update: Mapped["Update"] = relationship(back_populates="media")
    file_asset: Mapped[FileAsset] = relationship(lazy="joined")
