from collections.abc import Iterator
import uuid

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
from sqlalchemy.orm import Session

from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.schemas import LoginRequest, PasswordChangeRequest
from app.accounts.auth.security import verify_password
from app.accounts.auth.service import AuthService
from app.accounts.users.models import Profile, User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate
from app.core.database import SessionLocal, get_session
from app.main import app


PASSWORD = "password123"
NEW_PASSWORD = "newPassword456!"


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    def override_session() -> Iterator[Session]:
        yield db

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_session] = override_session

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


def _service(db: Session) -> AuthService:
    return AuthService(UserRepository(db), AuthRepository(db))


def _register(db: Session) -> User:
    identity = uuid.uuid4().hex

    return _service(db).register(
        UserCreate(
            username=f"user-{identity}",
            email=f"user-{identity}@example.com",
            password=PASSWORD,
        )
    )


def _headers(db: Session, user: User) -> dict[str, str]:
    tokens = _service(db).login(
        LoginRequest(login=user.username, password=PASSWORD)
    )
    return {"Authorization": f"Bearer {tokens.access_token}"}


def test_password_change_saves_hashed_password(
    client: TestClient,
    db: Session,
) -> None:
    # saves a hash and returns an empty success response
    user = _register(db)

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 204
    assert response.content == b""

    db.expire_all()
    credentials = AuthRepository(db).get_credentials(user.id)

    assert credentials is not None
    assert credentials.password_hash != NEW_PASSWORD
    assert verify_password(NEW_PASSWORD, credentials.password_hash)
    assert not verify_password(PASSWORD, credentials.password_hash)


@pytest.mark.parametrize("login_field", ["username", "email"])
def test_password_change_updates_login(
    client: TestClient,
    db: Session,
    login_field: str,
) -> None:
    # accepts the new password and rejects the old one for both login options
    user = _register(db)
    login = getattr(user, login_field)

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 204

    old_login = client.post(
        "/auth/login",
        json={"login": login, "password": PASSWORD},
    )
    new_login = client.post(
        "/auth/login",
        json={"login": login, "password": NEW_PASSWORD},
    )

    assert old_login.status_code == 401
    assert new_login.status_code == 200
    assert new_login.json()["access_token"]


def test_password_change_rejects_wrong_current_password(
    client: TestClient,
    db: Session,
) -> None:
    # rejects an incorrect current password and keeps the original hash
    user = _register(db)
    credentials = AuthRepository(db).get_credentials(user.id)

    assert credentials is not None
    original_hash = credentials.password_hash

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": "wrongPassword123!",
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"

    db.expire_all()
    stored_credentials = AuthRepository(db).get_credentials(user.id)

    assert stored_credentials is not None
    assert stored_credentials.password_hash == original_hash


@pytest.mark.parametrize("authorization", [None, "Bearer invalid-token"])
def test_password_change_requires_authentication(
    client: TestClient,
    authorization: str | None,
) -> None:
    # rejects requests with a missing or invalid access token
    headers = (
        {"Authorization": authorization}
        if authorization is not None
        else {}
    )

    response = client.patch(
        "/auth/password",
        headers=headers,
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 401


def test_password_change_rejects_missing_credentials(
    client: TestClient,
    db: Session,
) -> None:
    # rejects accounts without password credentials without crashing
    user = _register(db)
    headers = _headers(db, user)
    credentials = AuthRepository(db).get_credentials(user.id)

    assert credentials is not None

    db.delete(credentials)
    db.flush()

    response = client.patch(
        "/auth/password",
        headers=headers,
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 400


def test_password_change_keeps_account_and_profile_details(
    client: TestClient,
    db: Session,
) -> None:
    # keeps account details profile details and another password unchanged
    user = _register(db)
    other_user = _register(db)
    original_identity = (user.id, user.username, user.email)

    other_credentials = AuthRepository(db).get_credentials(other_user.id)
    assert other_credentials is not None
    other_hash = other_credentials.password_hash

    db.add(
        Profile(
            user_id=user.id,
            bio="My original bio",
            profile_picture_link="https://example.com/avatar.png",
        )
    )
    db.flush()

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": PASSWORD,
            "new_password": NEW_PASSWORD,
        },
    )

    assert response.status_code == 204

    db.expire_all()
    profile = UserRepository(db).get_profile(user.id)
    stored_other_credentials = AuthRepository(db).get_credentials(other_user.id)

    assert (user.id, user.username, user.email) == original_identity
    assert profile is not None
    assert profile.bio == "My original bio"
    assert profile.profile_picture_link == "https://example.com/avatar.png"
    assert stored_other_credentials is not None
    assert stored_other_credentials.password_hash == other_hash


@pytest.mark.parametrize(
    "changes",
    [
        {"current_password": ""},
        {"current_password": None},
        {"current_password": "x" * 129},
        {"new_password": ""},
        {"new_password": None},
        {"new_password": "short"},
        {"new_password": "x" * 129},
        {"user_id": "another-user-id"},
        {"username": "another-user"},
        {"email": "another@example.com"},
    ],
)
def test_password_change_rejects_invalid_payload(
    changes: dict[str, object],
) -> None:
    # rejects invalid passwords and extra fields
    payload: dict[str, object] = {
        "current_password": PASSWORD,
        "new_password": NEW_PASSWORD,
    }
    payload.update(changes)

    with pytest.raises(ValidationError):
        PasswordChangeRequest.model_validate(payload)


@pytest.mark.parametrize("field", ["current_password", "new_password"])
def test_password_change_requires_both_passwords(field: str) -> None:
    # requires both the current password and the new password
    payload = {
        "current_password": PASSWORD,
        "new_password": NEW_PASSWORD,
    }
    payload.pop(field)

    with pytest.raises(ValidationError):
        PasswordChangeRequest.model_validate(payload)


@pytest.mark.parametrize(
    "new_password",
    [
        "abcdefgh",
        "x" * 128,
        "  mot de passe é  ",
    ],
)
def test_password_change_accepts_valid_passwords(
    client: TestClient,
    db: Session,
    new_password: str,
) -> None:
    # accepts the length limits and preserves spaces and unicode
    user = _register(db)

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": PASSWORD,
            "new_password": new_password,
        },
    )

    assert response.status_code == 204

    login = client.post(
        "/auth/login",
        json={
            "login": user.username,
            "password": new_password,
        },
    )

    assert login.status_code == 200


def test_password_change_returns_validation_error(
    client: TestClient,
    db: Session,
) -> None:
    # returns a validation error when the new password is too short
    user = _register(db)

    response = client.patch(
        "/auth/password",
        headers=_headers(db, user),
        json={
            "current_password": PASSWORD,
            "new_password": "short",
        },
    )

    assert response.status_code == 422