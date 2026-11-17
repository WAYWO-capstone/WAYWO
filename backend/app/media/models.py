"""Persistence models for media assets."""

import uuid
from datetime import datetime

# Pylint does not recognize SQLAlchemy's generic mapped annotations.
# pylint: disable=unsubscriptable-object

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base
from app.core.common import utcnow
from app.media.enums import UploadKind, UploadStatus


class FileAsset(Base):
    """A file uploaded straight to R2, tracked from signing to verification."""

    __tablename__ = "file_assets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[UploadKind] = mapped_column(
        Enum(UploadKind, name="upload_kind",
             native_enum=False, create_constraint=True, length=20)
    )
    filename: Mapped[str] = mapped_column(String(255))
    # The resolved type, which R2 holds the object to.
    mime_type: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    status: Mapped[UploadStatus] = mapped_column(
        Enum(UploadStatus, name="upload_status",
             native_enum=False, create_constraint=True, length=20),
        default=UploadStatus.PENDING,
        index=True,
    )
    attached: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
