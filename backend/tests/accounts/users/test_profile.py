from collections.abc import Iterator
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_session
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    session = SessionLocal()

    def override_get_session() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        session.rollback()
        session.close()
        app.dependency_overrides.clear()


def _account() -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    return {
        "username": f"user-{suffix}",
        "email": f"user-{suffix}@example.com",
        "password": "password123",
    }


def _register_and_login(client: TestClient) -> tuple[dict[str, str], str]:
    account = _account()
    client.post("/auth/register", json=account)
    login = client.post(
        "/auth/login",
        json={"login": account["email"], "password": account["password"]},
    )
    return account, login.json()["access_token"]


def test_get_my_profile_requires_a_token(client: TestClient) -> None:
    response = client.get("/users/me")

    assert response.status_code == 401


def test_get_my_profile_rejects_a_bad_token(client: TestClient) -> None:
    response = client.get("/users/me", headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401


def test_get_my_profile_returns_the_logged_in_user(client: TestClient) -> None:
    account, token = _register_and_login(client)

    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "username": account["username"],
        "bio": None,
        "profile_picture_link": None,
    }


def test_update_my_profile_changes_only_the_sent_field(client: TestClient) -> None:
    account, token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    bio_response = client.patch(
        "/users/me",
        headers=headers,
        json={"bio": "Making a table"},
    )
    picture_response = client.patch(
        "/users/me",
        headers=headers,
        json={"profile_picture_link": "https://example.com/me.png"},
    )

    assert bio_response.status_code == 200
    assert picture_response.status_code == 200
    assert picture_response.json() == {
        "username": account["username"],
        "bio": "Making a table",
        "profile_picture_link": "https://example.com/me.png",
    }


def test_update_my_profile_rejects_account_fields(client: TestClient) -> None:
    _, token = _register_and_login(client)

    response = client.patch(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "someone-else"},
    )

    assert response.status_code == 422


def test_public_profile_does_not_require_a_token(client: TestClient) -> None:
    account, token = _register_and_login(client)
    client.patch(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"bio": "Public bio"},
    )

    response = client.get(f"/users/{account['username']}")

    assert response.status_code == 200
    assert response.json()["username"] == account["username"]
    assert response.json()["bio"] == "Public bio"


def test_public_profile_returns_404_for_an_unknown_user(client: TestClient) -> None:
    response = client.get("/users/missing-user")

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
