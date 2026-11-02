import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.enums import UpdateType


class UpdateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str
    type: UpdateType = UpdateType.PROGRESS
    public: bool | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class UpdateEdit(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    type: UpdateType | None = None
    public: bool | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @model_validator(mode="after")
    def require_update_field(self) -> "UpdateEdit":
        if not self.model_fields_set:
            raise ValueError("at least one update field must be provided")
        return self


class UpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    title: str
    body: str
    type: UpdateType
    public: bool
    created_at: datetime
    updated_at: datetime
    author: ProjectAuthorRead


class UpdateHistoryPage(BaseModel):
    items: list[UpdateRead]
    total: int
    limit: int
    offset: int
