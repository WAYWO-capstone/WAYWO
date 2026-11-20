import uuid
from datetime import datetime

from pydantic import BaseModel


class UpdateMediaCreate(BaseModel):
    upload_id: uuid.UUID


class UpdateMediaRead(BaseModel):
    id: uuid.UUID
    update_id: uuid.UUID
    filename: str
    mime_type: str
    size: int
    created_at: datetime
