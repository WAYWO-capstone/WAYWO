from collections.abc import Iterator
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.accounts.auth.exceptions import AuthenticationError, DuplicateIdentityError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import EmailChangeRequest, LoginRequest
from app.accounts.auth.security import decode_token
from app.accounts.auth.service import AuthService
from app.accounts.users.models import Profile, User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate
from app.core.config import settings
from app.core.database import SessionLocal


PASSWORD = "password123"


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


def _register(db: Session) -> User:
    # use a new account so existing users are not changed
    identity = uuid.uuid4().hex
    return _service(db).register(
        UserCreate(
            username=f"user-{identity}",
            email=f"user-{identity}@example.com",
            password=PASSWORD,
        )
    )


def _new_email() -> str:
    return f"updated-{uuid.uuid4().hex}@example.com"


def test_email_change_saves_normalized_email(db: Session) -> None:
    # removes extra spaces and saves the lowercase email for the user
    user = _register(db)
    other_user = _register(db)
    user_id = user.id
    username = user.username
    other_user_id = other_user.id
    other_email = other_user.email
    new_email = _new_email()

    saved = _service(db).change_email(
        user,
        EmailChangeRequest(
            email=f"  {new_email.upper()}  ",
            current_password=PASSWORD,
        ),
    )

    assert saved.id == user_id
    assert saved.username == username
    assert saved.email == new_email

    # reload the users to check the values saved in the database
    db.expire_all()
    stored = UserRepository(db).get_user_by_id(user_id)
    stored_other = UserRepository(db).get_user_by_id(other_user_id)

    assert stored is not None
    assert stored.email == new_email
    assert stored_other is not None
    assert stored_other.email == other_email


def test_email_change_rejects_wrong_password(db: Session) -> None:
    # prevents email changes when the current password is wrong
    user = _register(db)
    original_email = user.email

    with pytest.raises(AuthenticationError, match="Current password is incorrect"):
        _service(db).change_email(
            user,
            EmailChangeRequest(
                email=_new_email(),
                current_password="wrong-password",
            ),
        )

    db.refresh(user)
    assert user.email == original_email


def test_email_change_rejects_duplicate_and_keeps_session_usable(db: Session) -> None:
    # rejects duplicate emails and allows another save afterward
    user = _register(db)
    other_user = _register(db)
    original_email = user.email
    other_email = other_user.email
    service = _service(db)

    with pytest.raises(DuplicateIdentityError, match="Email is already registered"):
        service.change_email(
            user,
            EmailChangeRequest(
                email=other_email.upper(),
                current_password=PASSWORD,
            ),
        )

    db.refresh(user)
    db.refresh(other_user)
    assert user.email == original_email
    assert other_user.email == other_email

    # a rejected address should not block the next save
    new_email = _new_email()
    saved = service.change_email(
        user,
        EmailChangeRequest(email=new_email, current_password=PASSWORD),
    )

    db.refresh(saved)
    assert saved.email == new_email


def test_email_change_allows_current_email(db: Session) -> None:
    # allows the existing email with different capitalization
    user = _register(db)
    original_email = user.email

    saved = _service(db).change_email(
        user,
        EmailChangeRequest(
            email=original_email.upper(),
            current_password=PASSWORD,
        ),
    )

    assert saved.email == original_email


def test_email_change_updates_login_email(db: Session) -> None:
    # accepts the new email and username for login and rejects the old email
    user = _register(db)
    original_email = user.email
    new_email = _new_email()
    service = _service(db)

    service.change_email(
        user,
        EmailChangeRequest(email=new_email, current_password=PASSWORD),
    )

    tokens = service.login(LoginRequest(login=new_email, password=PASSWORD))
    decoded = decode_token(
        tokens.access_token,
        settings.jwt_secret_key,
        expected_type="access",
    )
    assert decoded["sub"] == str(user.id)

    username_tokens = service.login(
        LoginRequest(login=user.username, password=PASSWORD)
    )
    assert username_tokens.access_token

    with pytest.raises(AuthenticationError, match="Invalid login credentials"):
        service.login(LoginRequest(login=original_email, password=PASSWORD))


def test_email_change_keeps_password_and_profile(db: Session) -> None:
    # keeps the password bio and photo unchanged
    user = _register(db)
    credentials = AuthRepository(db).get_credentials(user.id)
    assert credentials is not None
    original_hash = credentials.password_hash

    db.add(
        Profile(
            user_id=user.id,
            bio="My original bio",
            profile_picture_link="https://example.com/avatar.png",
        )
    )
    db.flush()

    _service(db).change_email(
        user,
        EmailChangeRequest(email=_new_email(), current_password=PASSWORD),
    )

    db.expire_all()
    profile = UserRepository(db).get_profile(user.id)
    stored_credentials = AuthRepository(db).get_credentials(user.id)

    assert profile is not None
    assert profile.bio == "My original bio"
    assert profile.profile_picture_link == "https://example.com/avatar.png"
    assert stored_credentials is not None
    assert stored_credentials.password_hash == original_hash


@pytest.mark.parametrize(
    "changes",
    [
        {"email": "not-an-email"},
        {"email": ""},
        {"email": None},
        {"current_password": ""},
        {"current_password": None},
        {"current_password": "x" * 129},
        {"user_id": "another-user-id"},
        {"username": "another-user"},
    ],
)
def test_email_change_rejects_invalid_input(changes: dict[str, object]) -> None:
    # rejects invalid values and unexpected fields
    payload: dict[str, object] = {
        "email": "valid@example.com",
        "current_password": PASSWORD,
    }
    payload.update(changes)

    with pytest.raises(ValidationError):
        EmailChangeRequest.model_validate(payload)


@pytest.mark.parametrize("missing_field", ["email", "current_password"])
def test_email_change_requires_both_fields(missing_field: str) -> None:
    # requires both the email and the current password
    payload = {"email": "valid@example.com", "current_password": PASSWORD}
    payload.pop(missing_field)

    with pytest.raises(ValidationError):
        EmailChangeRequest.model_validate(payload)
        