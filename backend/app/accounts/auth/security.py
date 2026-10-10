"""Password hashing and token helpers; this module has no FastAPI dependencies."""

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash

PASSWORD_HASH = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30


class InvalidTokenError(ValueError):
    """Raised when a token is invalid or cannot be decoded."""


def hash_password(password: str) -> str:
    """Hash a plaintext password using the recommended password hasher."""

    return PASSWORD_HASH.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return whether a plaintext password matches a stored hash."""

    return PASSWORD_HASH.verify(password, password_hash)


def create_access_token(
    subject: str,
    secret_key: str,
    *,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed short-lived access token for a user."""

    return _create_token(
        subject,
        secret_key,
        token_type="access",
        expires_delta=expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(
    subject: str,
    secret_key: str,
    *,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed long-lived refresh token for a user."""

    return _create_token(
        subject,
        secret_key,
        token_type="refresh",
        expires_delta=expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, secret_key: str, *, expected_type: str | None = None) -> dict[str, Any]:
    """Decode and validate a signed token."""

    try:
        payload = jwt.decode(token, secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError("Invalid authentication token") from exc

    subject = payload.get("sub")
    token_type = payload.get("type")
    if not isinstance(subject, str) or not subject:
        raise InvalidTokenError("Authentication token has no subject")
    if expected_type is not None and token_type != expected_type:
        raise InvalidTokenError("Authentication token has an unexpected type")

    return payload


def _create_token(
    subject: str,
    secret_key: str,
    *,
    token_type: str,
    expires_delta: timedelta,
) -> str:
    if not subject:
        raise ValueError("Token subject must not be empty")
    if not secret_key:
        raise ValueError("Token secret key must not be empty")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, secret_key, algorithm=JWT_ALGORITHM)
