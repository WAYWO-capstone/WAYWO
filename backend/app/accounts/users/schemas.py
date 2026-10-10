"""Request and response schemas for users and profiles."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    """Payload used to create a user account."""

    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Payload used to update a user's editable account fields."""

    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: str | None = Field(default=None, min_length=3, max_length=255)


class UserResponse(BaseModel):
    """Public representation of a user."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    created_at: datetime
