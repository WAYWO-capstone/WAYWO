from collections.abc import Iterator
import uuid

import pytest
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import InvalidTokenError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import LoginRequest, RefreshRequest
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


def _registered_user(db: Session) -> UserCreate:
    payload = UserCreate(
        username=f"user-{uuid.uuid4().hex[:8]}",
        email=f"user-{uuid.uuid4().hex[:8]}@example.com",
        password="password123",
    )
    _service(db).register(payload)
    return payload


def test_refresh_returns_a_new_access_token(db: Session) -> None:
    payload = _registered_user(db)
    service = _service(db)
    tokens = service.login(
        LoginRequest(login=payload.email, password=payload.password)
    )

    refreshed = service.refresh(RefreshRequest(refresh_token=tokens.refresh_token))
    decoded = decode_token(
        refreshed.access_token,
        settings.jwt_secret_key,
        expected_type="access",
    )
    user = UserRepository(db).get_user_by_email(payload.email)

    assert user is not None
    assert decoded["sub"] == str(user.id)


def test_refresh_rejects_an_access_token(db: Session) -> None:
    payload = _registered_user(db)
    service = _service(db)
    tokens = service.login(
        LoginRequest(login=payload.email, password=payload.password)
    )

    with pytest.raises(InvalidTokenError):
        service.refresh(RefreshRequest(refresh_token=tokens.access_token))


def test_access_token_resolves_the_user(db: Session) -> None:
    payload = _registered_user(db)
    service = _service(db)
    tokens = service.login(
        LoginRequest(login=payload.email, password=payload.password)
    )

    user = service.get_user_from_access_token(tokens.access_token)

    assert user.email == payload.email
    assert user.username == payload.username


def test_access_token_lookup_rejects_a_refresh_token(db: Session) -> None:
    payload = _registered_user(db)
    service = _service(db)
    tokens = service.login(
        LoginRequest(login=payload.email, password=payload.password)
    )

    with pytest.raises(InvalidTokenError):
        service.get_user_from_access_token(tokens.refresh_token)
