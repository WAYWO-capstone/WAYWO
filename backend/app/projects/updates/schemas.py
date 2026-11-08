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
    problem_id: uuid.UUID | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @model_validator(mode="after")
    def validate_problem_link(self) -> "UpdateCreate":
        if self.type is not UpdateType.SOLUTION and self.problem_id is not None:
            raise ValueError("only solution updates may reference a problem")
        if self.type is UpdateType.SOLUTION and self.problem_id is None:
            raise ValueError("solution updates must reference a problem")
        return self


class UpdateEdit(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    type: UpdateType | None = None
    public: bool | None = None
    problem_id: uuid.UUID | None = None

    @field_validator("title", "body", "type", "public", "problem_id")
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


class UpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    problem_id: uuid.UUID | None
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
