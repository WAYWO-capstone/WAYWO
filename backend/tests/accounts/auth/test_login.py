from collections.abc import Iterator
import uuid

import pytest
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import AuthenticationError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import LoginRequest
from app.accounts.auth.security import decode_token
from app.accounts.auth.service import AuthService
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate
from app.core.config import settings
from app.core.database import SessionLocal


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _service(db: Session) -> AuthService:
    return AuthService(UserRepository(db), AuthRepository(db))


def _register(db: Session) -> UserCreate:
    payload = UserCreate(
        username=f"user-{uuid.uuid4().hex[:8]}",
        email=f"user-{uuid.uuid4().hex[:8]}@example.com",
        password="password123",
    )
    _service(db).register(payload)
    return payload


def test_login_with_email_returns_tokens(db: Session) -> None:
    payload = _register(db)

    tokens = _service(db).login(
        LoginRequest(login=payload.email, password=payload.password)
    )
    decoded = decode_token(
        tokens.access_token,
        settings.jwt_secret_key,
        expected_type="access",
    )
    user = UserRepository(db).get_user_by_email(payload.email)

    assert tokens.token_type == "bearer"
    assert tokens.refresh_token
    assert user is not None
    assert decoded["sub"] == str(user.id)


def test_login_with_username_returns_tokens(db: Session) -> None:
    payload = _register(db)

    tokens = _service(db).login(
        LoginRequest(login=payload.username, password=payload.password)
    )

    decode_token(
        tokens.access_token,
        settings.jwt_secret_key,
        expected_type="access",
    )


def test_login_rejects_wrong_password(db: Session) -> None:
    payload = _register(db)

    with pytest.raises(AuthenticationError, match="Invalid login credentials"):
        _service(db).login(
            LoginRequest(login=payload.email, password="wrong-password")
        )


def test_login_rejects_unknown_user(db: Session) -> None:
    with pytest.raises(AuthenticationError, match="Invalid login credentials"):
        _service(db).login(
            LoginRequest(login="missing-user@example.com", password="password123")
        )
