import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.models import UpdateType


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
