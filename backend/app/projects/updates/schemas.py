import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
