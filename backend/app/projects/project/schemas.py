import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.projects.project.enums import ProjectStatus

MAX_TAGS = 10
MAX_TAG_LENGTH = 50


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=500)
    description: str = ""
    category_id: uuid.UUID
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)

    @field_validator("title", "summary")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str]) -> list[str]:
        """Trim, lowercase, drop empties and duplicates (order preserved)."""
        seen: dict[str, None] = {}
        for raw in tags:
            tag = raw.strip().lower()
            if not tag:
                continue
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"tags must be at most {MAX_TAG_LENGTH} characters")
            seen.setdefault(tag)
        return list(seen)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    category_id: uuid.UUID | None = None
    tags: list[str] | None = Field(default=None, max_length=MAX_TAGS)

    @field_validator("title", "summary")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, tags: list[str] | None) -> list[str] | None:
        if tags is None:
            return tags
        seen: dict[str, None] = {}
        for raw in tags:
            tag = raw.strip().lower()
            if not tag:
                continue
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(f"tags must be at most {MAX_TAG_LENGTH} characters")
            seen.setdefault(tag)
        return list(seen)

    @model_validator(mode="after")
    def require_update_field(self) -> "ProjectUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one project field must be provided")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("project fields must not be null")
        return self


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    title: str
    summary: str
    description: str
    status: ProjectStatus
    public: bool
    category: CategoryRead
    tags: list[TagRead]
    created_at: datetime
    last_autosaved_at: datetime | None
    published_at: datetime | None
    completed_at: datetime | None