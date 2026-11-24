import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.projects.updates.media.models import UpdateMedia


class UpdateMediaCreate(BaseModel):
    upload_id: uuid.UUID


class UpdateMediaRead(BaseModel):
    id: uuid.UUID
    update_id: uuid.UUID
    filename: str
    mime_type: str
    size: int
    created_at: datetime

    @classmethod
    def from_model(cls, media: "UpdateMedia") -> "UpdateMediaRead":
        asset = media.file_asset
        return cls(
            id=media.id,
            update_id=media.update_id,
            filename=asset.filename,
            mime_type=asset.mime_type,
            size=asset.size_bytes,
            created_at=media.created_at,
        )
