import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.enums import (
    UpdateReferenceDisplayReason,
    UpdateReferenceReason,
    UpdateSort,
    UpdateType,
)
from app.projects.updates.media.schemas import UpdateMediaRead


class UpdateReferenceCreate(BaseModel):
    target_update_id: uuid.UUID
    reason: UpdateReferenceReason = UpdateReferenceReason.RELATED_TO


class UpdateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    body: str
    type: UpdateType = UpdateType.PROGRESS
    public: bool | None = None
    references: list[UpdateReferenceCreate] = Field(
        default_factory=list, max_length=50
    )
    media_upload_ids: list[uuid.UUID] = Field(
        default_factory=list,
        max_length=20,
    )

    @field_validator("media_upload_ids")
    @classmethod
    def remove_duplicate_media_upload_ids(
        cls, values: list[uuid.UUID]
    ) -> list[uuid.UUID]:
        return list(dict.fromkeys(values))

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

class UpdateEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    type: UpdateType | None = None
    public: bool | None = None
    references: list[UpdateReferenceCreate] | None = Field(
        default=None, max_length=50
    )

    @field_validator("title", "body", "type", "public")
    @classmethod
    def must_not_be_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("must not be null")
        return value

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @model_validator(mode="after")
    def require_update_field(self) -> "UpdateEdit":
        if not self.model_fields_set:
            raise ValueError("at least one update field must be provided")
        return self


class UpdateReferenceRead(BaseModel):
    linked_update_id: uuid.UUID
    title: str
    type: UpdateType
    reason: UpdateReferenceDisplayReason


class UpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    outgoing_references: list[UpdateReferenceRead] = Field(default_factory=list)
    incoming_references: list[UpdateReferenceRead] = Field(default_factory=list)
    media: list[UpdateMediaRead] = Field(default_factory=list)
    author_id: uuid.UUID
    title: str
    body: str
    type: UpdateType
    public: bool
    created_at: datetime
    updated_at: datetime
    author: ProjectAuthorRead


class UpdateListOptions(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    update_types: list[UpdateType] | None = Field(
        default=None,
        alias="filter",
    )
    sort: UpdateSort = UpdateSort.DATE_DESC


class UpdateHistoryPage(BaseModel):
    items: list[UpdateRead]
    total: int
    limit: int
    offset: int
