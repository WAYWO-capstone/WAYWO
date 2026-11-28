import uuid
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, field_validator


class ResourceCreate(BaseModel):
    upload_id: uuid.UUID
    # Defaults to the file name when left out or blank.
    title: str | None = Field(default=None, max_length=200)

    @field_validator("title")
    @classmethod
    def blank_title_means_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ResourceRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str
    created_at: datetime
    filename: str
    mime_type: str
    size: int


class ResourceLinkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: HttpUrl = Field(max_length=2048)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Enter a title for this link.")
        return title


class ResourceLinkRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    url: HttpUrl
    created_at: datetime
