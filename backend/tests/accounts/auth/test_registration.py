from collections.abc import Iterator
import uuid

import pytest
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import DuplicateIdentityError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.security import verify_password
from app.accounts.auth.service import AuthService
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate
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


def _payload(suffix: str) -> UserCreate:
    return UserCreate(
        username=f"user-{suffix}",
        email=f"user-{suffix}@example.com",
        password="password123",
    )


def test_register_creates_user_and_hashes_password(db: Session) -> None:
    payload = _payload(uuid.uuid4().hex[:8])

    user = _service(db).register(payload)
    credentials = AuthRepository(db).get_credentials(user.id)

    assert user.username == payload.username
    assert user.email == payload.email
    assert credentials is not None
    assert credentials.password_hash != payload.password
    assert verify_password(payload.password, credentials.password_hash)


def test_register_rejects_duplicate_email(db: Session) -> None:
    first = _payload(uuid.uuid4().hex[:8])
    _service(db).register(first)
    duplicate = UserCreate(
        username=f"other-{uuid.uuid4().hex[:8]}",
        email=first.email,
        password="password123",
    )

    with pytest.raises(DuplicateIdentityError):
        _service(db).register(duplicate)


def test_register_rejects_duplicate_username(db: Session) -> None:
    first = _payload(uuid.uuid4().hex[:8])
    _service(db).register(first)
    duplicate = UserCreate(
        username=first.username,
        email=f"other-{uuid.uuid4().hex[:8]}@example.com",
        password="password123",
    )

    with pytest.raises(DuplicateIdentityError):
        _service(db).register(duplicate)
