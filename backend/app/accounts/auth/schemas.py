"""Request and response schemas for authentication."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.accounts.users.schemas import UserCreate, UserResponse


RegisterRequest = UserCreate
AuthenticatedUser = UserResponse


class LoginRequest(BaseModel):
    """Credentials required to sign in."""

    login: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """Access and refresh tokens returned after authentication."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Refresh token payload."""

    refresh_token: str


class EmailChangeRequest(BaseModel):
    # require the current password before changing the email
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(min_length=3, max_length=255)
    current_password: str = Field(min_length=1, max_length=128, repr=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()
        