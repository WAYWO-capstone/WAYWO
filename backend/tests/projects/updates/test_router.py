import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.accounts.users.models import User
from app.projects.project.dependencies import get_current_user_id
from app.projects.project.models import Project
from app.projects.updates.models import Update
from tests.projects.updates.helpers import (
    count_updates,
    delete_update,
    post_update,
    update_update,
)

# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------

def test_create_update_returns_created_update(
    client: TestClient,
    project: Project,
    owner: User,
    payload: dict[str, Any],
) -> None:
    response = post_update(client, project.id, payload)

    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == str(project.id)
    assert body["author_id"] == str(owner.id)
    assert body["title"] == payload["title"]
    assert body["body"] == payload["body"]
    assert body["type"] == payload["type"]
    assert body["public"] is False
    assert body["author"]["username"] == "owner"


def test_create_update_persists_to_database(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    response = post_update(client, project.id, payload)
    assert response.status_code == 201

    with Session(engine) as session:
        saved = session.get(Update, uuid.UUID(response.json()["id"]))

    assert saved is not None
    assert saved.project_id == project.id
    assert saved.title == payload["title"]
    assert saved.body == payload["body"]
    assert saved.public is False


def test_create_update_rejects_non_owner(
    intruder_client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    response = post_update(intruder_client, project.id, payload)

    assert response.status_code == 403
    assert count_updates(engine) == 0


def test_create_update_rejects_unauthenticated_request(
    api: FastAPI,
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    api.dependency_overrides.pop(get_current_user_id)

    response = post_update(client, project.id, payload)

    assert response.status_code == 401
    assert count_updates(engine) == 0


def test_create_update_for_unknown_project_returns_404(
    client: TestClient,
    engine: Engine,
    payload: dict[str, Any],
) -> None:
    response = post_update(client, uuid.uuid4(), payload)

    assert response.status_code == 404
    assert count_updates(engine) == 0


@pytest.mark.parametrize(
    "override",
    [
        pytest.param({"title": None}, id="missing-title"),
        pytest.param({"type": "NOT_A_REAL_TYPE"}, id="invalid-type"),
    ],
)
def test_create_update_rejects_invalid_payload(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
    override: dict[str, Any],
) -> None:
    for key, value in override.items():
        if value is None:
            payload.pop(key)
        else:
            payload[key] = value

    response = post_update(client, project.id, payload)

    assert response.status_code == 422
    assert count_updates(engine) == 0


def test_owner_can_edit_update(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    created = post_update(client, project.id, payload).json()

    response = update_update(
        client,
        project.id,
        created["id"],
        {"title": "Updated milestone", "body": "The frame is painted."},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated milestone"
    assert response.json()["body"] == "The frame is painted."


def test_non_owner_cannot_edit_or_delete_update(
    created_update: dict[str, Any],
    intruder_client: TestClient,
    engine: Engine,
    project: Project,
) -> None:
    edit_response = update_update(
        intruder_client, project.id, created_update["id"], {"title": "Hijacked"}
    )
    delete_response = delete_update(
        intruder_client, project.id, created_update["id"]
    )

    assert edit_response.status_code == 403
    assert delete_response.status_code == 403
    assert count_updates(engine) == 1


def test_owner_can_delete_update(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    created = post_update(client, project.id, payload).json()

    response = delete_update(client, project.id, created["id"])

    assert response.status_code == 204
    assert count_updates(engine) == 0


@pytest.mark.parametrize(
    "method",
    ["edit", "delete"],
)
def test_update_actions_return_404_for_unknown_update(
    client: TestClient,
    project: Project,
    method: str,
) -> None:
    if method == "edit":
        response = update_update(
            client, project.id, uuid.uuid4(), {"title": "Missing"}
        )
    else:
        response = delete_update(client, project.id, uuid.uuid4())

    assert response.status_code == 404


def test_edit_update_rejects_empty_payload(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    created = post_update(client, project.id, payload).json()

    response = update_update(client, project.id, created["id"], {})

    assert response.status_code == 422
