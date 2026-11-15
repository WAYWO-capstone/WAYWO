import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.accounts.users.models import User
from app.projects.project.dependencies import get_current_user_id
from app.projects.project.models import Project
from app.projects.updates.models import Update, UpdateReference
from tests.projects.updates.helpers import delete_update, post_update, update_update


def test_update_can_have_multiple_outgoing_references_with_reciprocal_reasons(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    first_response = post_update(
        client,
        project.id,
        {**payload, "title": "A problem", "type": "PROBLEM"},
    )
    second_response = post_update(
        client,
        project.id,
        {**payload, "title": "A decision", "type": "DECISION"},
    )
    assert first_response.status_code == second_response.status_code == 201

    solution_response = post_update(
        client,
        project.id,
        {
            **payload,
            "title": "Use a replacement part",
            "type": "SOLUTION",
            "references": [
                {
                    "target_update_id": first_response.json()["id"],
                    "reason": "SOLVES",
                },
                {
                    "target_update_id": second_response.json()["id"],
                    "reason": "RELATED_TO",
                },
            ],
        },
    )

    assert solution_response.status_code == 201
    assert {
        reference["linked_update_id"]: reference
        for reference in solution_response.json()["outgoing_references"]
    } == {
        first_response.json()["id"]: {
            "linked_update_id": first_response.json()["id"],
            "title": "A problem",
            "type": "PROBLEM",
            "reason": "SOLVES",
        },
        second_response.json()["id"]: {
            "linked_update_id": second_response.json()["id"],
            "title": "A decision",
            "type": "DECISION",
            "reason": "RELATED_TO",
        },
    }
    with Session(engine) as session:
        saved = session.get(Update, uuid.UUID(solution_response.json()["id"]))
        assert saved is not None
        assert {
            (str(reference.referenced_update_id), reference.reason.value)
            for reference in saved.outgoing_references
        } == {
            (first_response.json()["id"], "SOLVES"),
            (second_response.json()["id"], "RELATED_TO"),
        }

    history = client.get(f"/projects/{project.id}/updates").json()
    problem = next(
        item
        for item in history["items"]
        if item["id"] == first_response.json()["id"]
    )
    assert problem["incoming_references"] == [
        {
            "linked_update_id": solution_response.json()["id"],
            "title": "Use a replacement part",
            "type": "SOLUTION",
            "reason": "SOLVED_BY",
        }
    ]
    decision = next(
        item
        for item in history["items"]
        if item["id"] == second_response.json()["id"]
    )
    assert decision["incoming_references"][0]["reason"] == "RELATED_TO"


@pytest.mark.parametrize(
    ("stored_reason", "display_reason"),
    [
        ("PARTIALLY_SOLVES", "PARTIALLY_SOLVED_BY"),
        ("RELATED_TO", "RELATED_TO"),
    ],
)
def test_update_reference_supports_distinct_inverse_reasons(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
    stored_reason: str,
    display_reason: str,
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": stored_reason}
            ],
        },
    ).json()

    assert source["outgoing_references"][0]["reason"] == stored_reason
    history = client.get(f"/projects/{project.id}/updates").json()
    target_read = next(item for item in history["items"] if item["id"] == target["id"])
    assert target_read["incoming_references"][0]["reason"] == display_reason


def test_update_allows_multiple_incoming_references(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    first_source = post_update(
        client,
        project.id,
        {
            **payload,
            "title": "First source",
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"}
            ],
        },
    ).json()
    second_source = post_update(
        client,
        project.id,
        {
            **payload,
            "title": "Second source",
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "PARTIALLY_SOLVES"}
            ],
        },
    ).json()

    history = client.get(f"/projects/{project.id}/updates").json()
    target_read = next(item for item in history["items"] if item["id"] == target["id"])
    assert {
        (link["linked_update_id"], link["reason"])
        for link in target_read["incoming_references"]
    } == {
        (first_source["id"], "SOLVED_BY"),
        (second_source["id"], "PARTIALLY_SOLVED_BY"),
    }


@pytest.mark.parametrize(
    "update_types",
    [
        ("PROGRESS", "PROBLEM", "SOLVES"),
        ("SOLUTION", "PROGRESS", "PARTIALLY_SOLVES"),
        ("PROBLEM", "PROBLEM", "SOLVES"),
        ("DECISION", "SOLUTION", "PARTIALLY_SOLVES"),
    ],
)
def test_solve_reasons_require_solution_to_problem_updates(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
    update_types: tuple[str, str, str],
) -> None:
    source_type, target_type, reason = update_types
    target = post_update(
        client, project.id, {**payload, "type": target_type}
    ).json()

    response = post_update(
        client,
        project.id,
        {
            **payload,
            "type": source_type,
            "references": [
                {"target_update_id": target["id"], "reason": reason}
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Solve references must link SOLUTION updates to PROBLEM updates"
    )


def test_update_references_must_belong_to_the_same_project(
    client: TestClient,
    project: Project,
    make_project: Callable[[User], Project],
    owner: User,
    payload: dict[str, Any],
) -> None:
    other_project = make_project(owner)
    other_update = post_update(client, other_project.id, payload)
    assert other_update.status_code == 201

    response = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {
                    "target_update_id": other_update.json()["id"],
                    "reason": "RELATED_TO",
                }
            ],
        },
    )

    assert response.status_code == 404


def test_update_cannot_reference_itself(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    created = post_update(client, project.id, payload).json()

    response = update_update(
        client,
        project.id,
        created["id"],
        {
            "references": [
                {"target_update_id": created["id"], "reason": "SOLVES"}
            ]
        },
    )

    assert response.status_code == 422


def test_update_can_be_relinked_to_different_updates(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    first = post_update(client, project.id, payload).json()
    second = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    update = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": first["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()

    response = update_update(
        client,
        project.id,
        update["id"],
        {
            "references": [
                {"target_update_id": second["id"], "reason": "SOLVES"}
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["outgoing_references"][0]["linked_update_id"] == second["id"]
    assert response.json()["outgoing_references"][0]["reason"] == "SOLVES"


def test_update_type_cannot_change_if_outgoing_solve_reference_becomes_invalid(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"}
            ],
        },
    ).json()

    response = update_update(
        client, project.id, source["id"], {"type": "PROGRESS"}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Solve references must link SOLUTION updates to PROBLEM updates"
    )


def test_update_type_cannot_change_if_incoming_solve_reference_becomes_invalid(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"}
            ],
        },
    )

    response = update_update(
        client, project.id, target["id"], {"type": "DECISION"}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Solve references must link SOLUTION updates to PROBLEM updates"
    )


def test_update_type_can_change_when_outgoing_references_are_updated(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"}
            ],
        },
    ).json()

    response = update_update(
        client,
        project.id,
        source["id"],
        {
            "type": "PROGRESS",
            "references": [
                {"target_update_id": target["id"], "reason": "RELATED_TO"}
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["type"] == "PROGRESS"
    assert response.json()["outgoing_references"][0]["reason"] == "RELATED_TO"


def test_update_can_change_reference_reason_without_changing_target(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()

    response = update_update(
        client,
        project.id,
        source["id"],
        {
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"}
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["outgoing_references"] == [
        {
            "linked_update_id": target["id"],
            "title": payload["title"],
            "type": "PROBLEM",
            "reason": "SOLVES",
        }
    ]
    history = client.get(f"/projects/{project.id}/updates").json()
    target_read = next(item for item in history["items"] if item["id"] == target["id"])
    assert target_read["incoming_references"][0]["reason"] == "SOLVED_BY"


def test_update_reference_defaults_to_related_to(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(client, project.id, payload).json()

    response = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [{"target_update_id": target["id"]}],
        },
    )

    assert response.status_code == 201
    assert response.json()["outgoing_references"][0]["reason"] == "RELATED_TO"


def test_update_cannot_reference_an_update_that_already_references_it(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    first = post_update(client, project.id, payload).json()
    second = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": first["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()

    response = update_update(
        client,
        project.id,
        first["id"],
        {
            "references": [
                {"target_update_id": second["id"], "reason": "RELATED_TO"}
            ]
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Duplicate update reference"


def test_update_reference_can_be_cleared(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(client, project.id, payload).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": target["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()
    response = update_update(client, project.id, source["id"], {"references": []})

    assert response.status_code == 200
    assert response.json()["outgoing_references"] == []


def test_update_rejects_reference_ids_without_reasons(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(client, project.id, payload).json()
    response = post_update(
        client,
        project.id,
        {**payload, "references": [target["id"]]},
    )

    assert response.status_code == 422
    assert "references" in str(response.json()["detail"])


def test_update_rejects_unknown_reference_reason(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(client, project.id, payload).json()
    response = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": target["id"], "reason": "FIXES"}
            ],
        },
    )

    assert response.status_code == 422


def test_update_rejects_duplicate_outgoing_references(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> None:
    target = post_update(
        client, project.id, {**payload, "type": "PROBLEM"}
    ).json()
    response = post_update(
        client,
        project.id,
        {
            **payload,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": target["id"], "reason": "SOLVES"},
                {"target_update_id": target["id"], "reason": "RELATED_TO"},
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Duplicate update reference"


def test_history_hides_private_references_from_other_viewers(
    client: TestClient,
    api: FastAPI,
    db: Session,
    project: Project,
    payload: dict[str, Any],
) -> None:
    project.public = True
    db.commit()
    private_update = post_update(
        client,
        project.id,
        {**payload, "public": False},
    ).json()
    public_target = post_update(
        client,
        project.id,
        {**payload, "title": "Public target", "type": "PROBLEM"},
    ).json()
    public_update = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": private_update["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()
    private_source = post_update(
        client,
        project.id,
        {
            **payload,
            "public": False,
            "type": "SOLUTION",
            "references": [
                {"target_update_id": public_target["id"], "reason": "SOLVES"}
            ],
        },
    ).json()

    viewer_id = uuid.uuid4()

    def get_viewer_id() -> uuid.UUID:
        return viewer_id

    api.dependency_overrides[get_current_user_id] = get_viewer_id
    response = client.get(f"/projects/{project.id}/updates")

    assert response.status_code == 200
    visible_update = next(
        item
        for item in response.json()["items"]
        if item["id"] == public_update["id"]
    )
    assert visible_update["outgoing_references"] == []
    visible_target = next(
        item
        for item in response.json()["items"]
        if item["id"] == public_target["id"]
    )
    assert all(
        link["linked_update_id"] != private_source["id"]
        for link in visible_target["incoming_references"]
    )


def test_deleting_an_update_cascades_only_its_references(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    referenced = post_update(client, project.id, payload).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": referenced["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()

    response = delete_update(client, project.id, referenced["id"])

    assert response.status_code == 204
    with Session(engine) as session:
        remaining_source = session.get(Update, uuid.UUID(source["id"]))
        assert remaining_source is not None
        assert remaining_source.outgoing_references == []
        assert session.get(Update, uuid.UUID(referenced["id"])) is None
        assert session.scalar(select(UpdateReference).limit(1)) is None


def test_deleting_an_update_removes_outgoing_references_only(
    client: TestClient,
    engine: Engine,
    project: Project,
    payload: dict[str, Any],
) -> None:
    referenced = post_update(client, project.id, payload).json()
    source = post_update(
        client,
        project.id,
        {
            **payload,
            "references": [
                {"target_update_id": referenced["id"], "reason": "RELATED_TO"}
            ],
        },
    ).json()

    response = delete_update(client, project.id, source["id"])

    assert response.status_code == 204
    with Session(engine) as session:
        assert session.get(Update, uuid.UUID(referenced["id"])) is not None
        assert session.scalar(select(UpdateReference).limit(1)) is None
