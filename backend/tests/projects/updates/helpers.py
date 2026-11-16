import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.projects.updates.models import Update

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def post_update(
    client: TestClient, project_id: uuid.UUID | str, payload: dict[str, Any]
):
    return client.post(f"/projects/{project_id}/updates", json=payload)


def update_update(
    client: TestClient,
    project_id: uuid.UUID | str,
    update_id: uuid.UUID | str,
    payload: dict[str, Any],
):
    return client.patch(
        f"/projects/{project_id}/updates/{update_id}", json=payload
    )


def delete_update(
    client: TestClient,
    project_id: uuid.UUID | str,
    update_id: uuid.UUID | str,
):
    return client.delete(f"/projects/{project_id}/updates/{update_id}")


def count_updates(engine: Engine) -> int:
    # A brand-new session, so we read what was actually committed.
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(Update)) or 0
