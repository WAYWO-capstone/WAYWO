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


def test_register_returns_the_created_user(client: TestClient) -> None:
    account = _account()

    response = client.post("/auth/register", json=account)

    assert response.status_code == 201
    body = response.json()
    assert body["username"] == account["username"]
    assert body["email"] == account["email"]
    assert "password" not in body
    assert "password_hash" not in body


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)
    duplicate = _account()
    duplicate["email"] = account["email"]

    response = client.post("/auth/register", json=duplicate)

    assert response.status_code == 409
    assert response.json()["detail"] == "Email is already registered"


def test_register_rejects_duplicate_username(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)
    duplicate = _account()
    duplicate["username"] = account["username"]

    response = client.post("/auth/register", json=duplicate)

    assert response.status_code == 409
    assert response.json()["detail"] == "Username is already taken"


def test_login_returns_tokens(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)

    response = client.post(
        "/auth/login",
        json={"login": account["email"], "password": account["password"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)

    response = client.post(
        "/auth/login",
        json={"login": account["email"], "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid login credentials"


def test_refresh_returns_a_new_token_pair(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)
    login = client.post(
        "/auth/login",
        json={"login": account["username"], "password": account["password"]},
    )

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": login.json()["refresh_token"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_refresh_rejects_an_access_token(client: TestClient) -> None:
    account = _account()
    client.post("/auth/register", json=account)
    login = client.post(
        "/auth/login",
        json={"login": account["email"], "password": account["password"]},
    )

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": login.json()["access_token"]},
    )

    assert response.status_code == 401
