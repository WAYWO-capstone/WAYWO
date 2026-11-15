"""Request and response schemas for media assets."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.media.enums import UploadKind, UploadStatus


class UploadCreate(BaseModel):
    kind: UploadKind
    filename: str = Field(min_length=1, max_length=255)
    # R2's HEAD in /complete is what proves the size.
    size: int = Field(gt=0)
    # Often empty since browsers send no type for most maker files (.stl, .step...).
    mime_type: str = Field(default="", max_length=255)

    @field_validator("filename")
    @classmethod
    def filename_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("filename must not be blank")
        return value


class UploadCreated(BaseModel):
    upload_id: uuid.UUID
    url: str
    headers: dict[str, str]
    expires_at: datetime


class UploadRead(BaseModel):
    upload_id: uuid.UUID
    kind: UploadKind
    filename: str
    size: int
    status: UploadStatus


class UploadKindConfigRead(BaseModel):
    max_size: int
    allowed_mime: list[str]
    allowed_extensions: list[str]
