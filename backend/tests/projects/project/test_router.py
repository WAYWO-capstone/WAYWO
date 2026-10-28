"""API tests for changing a project's status (US 11).

Requests share one database session that is rolled back after each test,
so nothing written here persists.
"""
from collections.abc import Iterator
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_session
from app.main import app
from app.projects.project.models import Category


@pytest.fixture
def session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    def override_get_session() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def category(session: Session) -> Category:
    category = Category(name=f"category-{uuid.uuid4().hex[:8]}", description="")
    session.add(category)
    session.flush()
    return category


def _auth_headers(client: TestClient) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    account = {
        "username": f"user-{suffix}",
        "email": f"user-{suffix}@example.com",
        "password": "password123",
    }
    client.post("/auth/register", json=account)
    response = client.post(
        "/auth/login", json={"login": account["email"], "password": account["password"]}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_project(
    client: TestClient, headers: dict[str, str], category: Category, *, publish: bool
) -> str:
    response = client.post(
        "/projects",
        json={
            "title": "Crochet tote",
            "summary": "A sturdy bag",
            "description": "",
            "category_id": str(category.id),
        },
        headers=headers,
    )
    project_id = response.json()["id"]
    if publish:
        client.post(f"/projects/{project_id}/publish", headers=headers)
    return project_id


@pytest.fixture
def owner(client: TestClient) -> dict[str, str]:
    return _auth_headers(client)


@pytest.fixture
def published_project(client, owner, category) -> str:
    return _create_project(client, owner, category, publish=True)


def test_owner_can_mark_project_completed_and_it_is_persisted(
    client: TestClient, owner, published_project
) -> None:
    response = client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )

    assert response.status_code == 200
    reloaded = client.get(f"/projects/{published_project}", headers=owner).json()
    assert reloaded["status"] == "COMPLETED"
    assert reloaded["completed_at"] is not None


def test_owner_can_mark_completed_project_active_again(
    client: TestClient, owner, published_project
) -> None:
    client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )

    response = client.patch(
        f"/projects/{published_project}/status", json={"status": "ACTIVE"}, headers=owner
    )

    assert response.status_code == 200
    reloaded = client.get(f"/projects/{published_project}", headers=owner).json()
    assert reloaded["status"] == "ACTIVE"
    assert reloaded["completed_at"] is None


@pytest.mark.parametrize("value", ["ARCHIVED", "completed", "", "DRAFT"])
def test_rejects_invalid_status_values(
    client: TestClient, owner, published_project, value: str
) -> None:
    response = client.patch(
        f"/projects/{published_project}/status", json={"status": value}, headers=owner
    )

    assert response.status_code == 422
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ACTIVE"


def test_rejects_status_change_on_unpublished_draft(
    client: TestClient, owner, category
) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.patch(
        f"/projects/{project_id}/status", json={"status": "COMPLETED"}, headers=owner
    )

    assert response.status_code == 409
    assert client.get(f"/projects/{project_id}", headers=owner).json()["status"] == "DRAFT"


def test_rejects_status_change_by_another_user(
    client: TestClient, owner, published_project
) -> None:
    response = client.patch(
        f"/projects/{published_project}/status",
        json={"status": "COMPLETED"},
        headers=_auth_headers(client),
    )

    assert response.status_code == 403
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ACTIVE"


def test_rejects_status_change_without_login(
    client: TestClient, owner, published_project
) -> None:
    response = client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}
    )

    assert response.status_code == 401
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ACTIVE"


def test_completed_project_remains_accessible(
    client: TestClient, owner, published_project
) -> None:
    client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )

    as_other_user = client.get(f"/projects/{published_project}", headers=_auth_headers(client))
    anonymous = client.get(f"/projects/{published_project}")
    owner_published = client.get("/projects/mine/published", headers=owner).json()

    assert as_other_user.status_code == 200
    assert as_other_user.json()["status"] == "COMPLETED"
    assert anonymous.status_code == 200
    assert published_project in [project["id"] for project in owner_published]
