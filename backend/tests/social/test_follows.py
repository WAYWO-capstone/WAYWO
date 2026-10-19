from collections.abc import Iterator
import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_session
from app.main import app
from app.social.router import _followed_user


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


def _register(client: TestClient) -> dict[str, str]:
    account = _account()
    client.post("/auth/register", json=account)
    return account


def _login(client: TestClient, account: dict[str, str]) -> str:
    login = client.post(
        "/auth/login",
        json={"login": account["email"], "password": account["password"]},
    )
    return login.json()["access_token"]


def test_follow_rejects_a_slash_in_the_username() -> None:
    session = SessionLocal()
    try:
        with pytest.raises(HTTPException) as exc:
            _followed_user("ada/lovelace", session)
    finally:
        session.close()

    assert exc.value.status_code == 400
    assert exc.value.detail == "Username cannot contain '/'"


def test_follow_requires_a_token(client: TestClient) -> None:
    creator = _register(client)

    response = client.post(f"/follows/{creator['username']}")

    assert response.status_code == 401


def test_follow_creates_a_creator_follow(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)

    response = client.post(
        f"/follows/{creator['username']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["followed_at"]
    assert body["notifications_enabled"] is False


def test_follow_rejects_following_yourself(client: TestClient) -> None:
    account = _register(client)
    token = _login(client, account)

    response = client.post(
        f"/follows/{account['username']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "You cannot follow yourself"


def test_follow_rejects_a_duplicate(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/follows/{creator['username']}", headers=headers)

    response = client.post(f"/follows/{creator['username']}", headers=headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "You already follow this creator"


def test_follow_returns_404_for_an_unknown_user(client: TestClient) -> None:
    account = _register(client)
    token = _login(client, account)

    response = client.post(
        "/follows/missing-user",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_unfollow_removes_the_follow(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/follows/{creator['username']}", headers=headers)

    response = client.delete(f"/follows/{creator['username']}", headers=headers)

    assert response.status_code == 204
    assert response.content == b""


def test_unfollow_returns_404_when_not_following(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)

    response = client.delete(
        f"/follows/{creator['username']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "You do not follow this creator"


def test_following_status_is_false_before_a_follow(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)

    response = client.get(
        f"/follows/{creator['username']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"is_following": False}


def test_following_status_is_true_after_a_follow(client: TestClient) -> None:
    follower = _register(client)
    creator = _register(client)
    token = _login(client, follower)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(f"/follows/{creator['username']}", headers=headers)

    response = client.get(f"/follows/{creator['username']}", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"is_following": True}


def test_following_status_requires_a_token(client: TestClient) -> None:
    creator = _register(client)

    response = client.get(f"/follows/{creator['username']}")

    assert response.status_code == 401


def test_following_status_returns_404_for_an_unknown_user(client: TestClient) -> None:
    account = _register(client)
    token = _login(client, account)

    response = client.get(
        "/follows/missing-user",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
