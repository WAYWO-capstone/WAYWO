"""Authentication business logic."""

import uuid

from app.accounts.auth.exceptions import (
    AuthenticationError,
    DuplicateIdentityError,
    InvalidTokenError,
)
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import LoginRequest, RefreshRequest, TokenResponse
from app.accounts.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate
from app.core.config import settings


class AuthService:
    """Creates accounts and signs users in."""

    def __init__(self, users: UserRepository, auth: AuthRepository) -> None:
        self._users = users
        self._auth = auth

    def register(self, payload: UserCreate) -> User:
        """Create a user and store a hashed password."""

        if self._users.get_user_by_email(payload.email) is not None:
            raise DuplicateIdentityError("Email is already registered")
        if self._users.get_user_by_username(payload.username) is not None:
            raise DuplicateIdentityError("Username is already taken")

        user = self._users.add_user(
            User(username=payload.username, email=payload.email)
        )
        self._auth.add_credentials(user.id, hash_password(payload.password))
        return user

    def login(self, payload: LoginRequest) -> TokenResponse:
        """Verify a login and return access and refresh tokens."""

        user = self._users.get_user_by_email(payload.login)
        if user is None:
            user = self._users.get_user_by_username(payload.login)
        credentials = None if user is None else self._auth.get_credentials(user.id)
        password_matches = (
            credentials is not None
            and verify_password(payload.password, credentials.password_hash)
        )
        if user is None or not password_matches:
            raise AuthenticationError("Invalid login credentials")

        return self._tokens_for(user)

    def refresh(self, payload: RefreshRequest) -> TokenResponse:
        """Issue a new token pair from a valid refresh token."""

        token_payload = decode_token(
            payload.refresh_token,
            settings.jwt_secret_key,
            expected_type="refresh",
        )
        try:
            user_id = uuid.UUID(token_payload["sub"])
        except ValueError as exc:
            raise InvalidTokenError("Authentication token has no subject") from exc

        user = self._users.get_user_by_id(user_id)
        if user is None:
            raise AuthenticationError("Invalid login credentials")
        return self._tokens_for(user)

    def _tokens_for(self, user: User) -> TokenResponse:
        subject = str(user.id)
        return TokenResponse(
            access_token=create_access_token(subject, settings.jwt_secret_key),
            refresh_token=create_refresh_token(subject, settings.jwt_secret_key),
        )
