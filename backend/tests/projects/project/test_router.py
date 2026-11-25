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


def test_owner_can_update_project_and_changes_are_persisted(
    client: TestClient, owner, category
) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.patch(
        f"/projects/{project_id}",
        json={
            "title": "Updated crochet tote",
            "summary": "A stronger everyday bag",
            "description": "Reinforced handles and a lined interior.",
            "category_id": str(category.id),
        },
        headers=owner,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated crochet tote"
    reloaded = client.get(f"/projects/{project_id}", headers=owner)
    assert reloaded.status_code == 200
    assert reloaded.json()["title"] == "Updated crochet tote"
    assert reloaded.json()["summary"] == "A stronger everyday bag"
    assert reloaded.json()["description"] == "Reinforced handles and a lined interior."
    assert reloaded.json()["category"]["id"] == str(category.id)


def test_rejects_invalid_project_update_without_changing_saved_data(
    client: TestClient, owner, category
) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.patch(
        f"/projects/{project_id}", json={"title": "   "}, headers=owner
    )

    assert response.status_code == 422
    reloaded = client.get(f"/projects/{project_id}", headers=owner)
    assert reloaded.json()["title"] == "Crochet tote"


def test_rejects_project_update_by_another_user(
    client: TestClient, owner, category
) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.patch(
        f"/projects/{project_id}",
        json={"title": "Not my project"},
        headers=_auth_headers(client),
    )

    assert response.status_code == 403
    reloaded = client.get(f"/projects/{project_id}", headers=owner)
    assert reloaded.json()["title"] == "Crochet tote"


def test_rejects_unauthenticated_project_update(
    client: TestClient, owner, category
) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.patch(
        f"/projects/{project_id}", json={"title": "Anonymous edit"}
    )

    assert response.status_code == 401
    reloaded = client.get(f"/projects/{project_id}", headers=owner)
    assert reloaded.json()["title"] == "Crochet tote"


def test_archived_project_is_hidden_from_others_and_keeps_its_history(
    client: TestClient, owner, published_project
) -> None:
    client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )
    before = client.get(f"/projects/{published_project}", headers=owner).json()

    response = client.post(f"/projects/{published_project}/archive", headers=owner)

    assert response.status_code == 200
    archived = response.json()
    assert archived["status"] == "ARCHIVED"
    assert archived["public"] is False
    assert archived["archived_at"] is not None
    assert archived["published_at"] == before["published_at"]
    assert archived["completed_at"] == before["completed_at"]
    assert client.get(f"/projects/{published_project}", headers=owner).status_code == 200
    assert client.get(
        f"/projects/{published_project}", headers=_auth_headers(client)
    ).status_code == 404
    assert client.get(f"/projects/{published_project}").status_code == 404

    published_ids = [p["id"] for p in client.get("/projects/mine/published", headers=owner).json()]
    archived_ids = [p["id"] for p in client.get("/projects/mine/archived", headers=owner).json()]
    draft_ids = [p["id"] for p in client.get("/projects/mine/drafts", headers=owner).json()]
    assert published_project not in published_ids
    assert published_project in archived_ids
    assert published_project not in draft_ids


def test_restoring_archived_project_publishes_it_with_its_previous_status(
    client: TestClient, owner, published_project
) -> None:
    client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )
    client.post(f"/projects/{published_project}/archive", headers=owner)

    response = client.post(f"/projects/{published_project}/restore", headers=owner)

    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"
    assert response.json()["public"] is True
    assert response.json()["archived_at"] is None
    as_other_user = client.get(f"/projects/{published_project}", headers=_auth_headers(client))
    assert as_other_user.status_code == 200


def test_owner_edits_and_updates_on_archived_project_are_hidden_until_restored(
    client: TestClient, owner, published_project
) -> None:
    client.post(f"/projects/{published_project}/archive", headers=owner)
    edit = client.patch(
        f"/projects/{published_project}", json={"title": "Reworked tote"}, headers=owner
    )
    update = client.post(
        f"/projects/{published_project}/updates",
        json={"title": "New strap", "body": "Sewn on.", "type": "PROGRESS"},
        headers=owner,
    )
    other_user = _auth_headers(client)

    assert edit.status_code == 200
    assert update.status_code == 201
    assert client.get(f"/projects/{published_project}", headers=other_user).status_code == 404
    assert client.get(
        f"/projects/{published_project}/updates", headers=other_user
    ).status_code == 404

    client.post(f"/projects/{published_project}/restore", headers=owner)

    project = client.get(f"/projects/{published_project}", headers=other_user).json()
    history = client.get(f"/projects/{published_project}/updates", headers=other_user).json()
    assert project["title"] == "Reworked tote"
    assert update.json()["id"] in [item["id"] for item in history["items"]]


def test_draft_cannot_be_archived(client: TestClient, owner, category) -> None:
    project_id = _create_project(client, owner, category, publish=False)

    response = client.post(f"/projects/{project_id}/archive", headers=owner)

    assert response.status_code == 409
    assert client.get(f"/projects/{project_id}", headers=owner).json()["status"] == "DRAFT"


def test_published_project_cannot_go_back_to_draft(
    client: TestClient, owner, published_project
) -> None:
    unpublish = client.post(f"/projects/{published_project}/unpublish", headers=owner)
    restore = client.post(f"/projects/{published_project}/restore", headers=owner)

    assert unpublish.status_code == 404
    assert restore.status_code == 409
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ACTIVE"


def test_archived_project_status_cannot_change_until_restored(
    client: TestClient, owner, published_project
) -> None:
    client.post(f"/projects/{published_project}/archive", headers=owner)

    response = client.patch(
        f"/projects/{published_project}/status", json={"status": "COMPLETED"}, headers=owner
    )

    assert response.status_code == 409
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ARCHIVED"


def test_rejects_archiving_another_users_project(
    client: TestClient, owner, published_project
) -> None:
    response = client.post(
        f"/projects/{published_project}/archive", headers=_auth_headers(client)
    )

    assert response.status_code == 403
    assert client.get(f"/projects/{published_project}", headers=owner).json()["status"] == "ACTIVE"
