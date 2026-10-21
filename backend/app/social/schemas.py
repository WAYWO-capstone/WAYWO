"""Request and response schemas for social features."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FollowingStatusResponse(BaseModel):
    """Whether the logged-in user follows a creator."""

    is_following: bool


class CreatorFollowResponse(BaseModel):
    """A creator follow returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    follower_id: uuid.UUID
    followed_id: uuid.UUID
    followed_at: datetime
    notifications_enabled: bool
