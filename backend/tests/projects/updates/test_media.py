import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.users.models import User
from app.media.enums import UploadKind, UploadStatus
from app.media.kinds import UPLOAD_KINDS
from app.media.models import FileAsset
from app.projects.project.dependencies import (
    get_current_user_id,
    get_optional_current_user_id,
)
from app.projects.project.models import Project
from app.projects.updates.media.models import UpdateMedia
from app.projects.updates.models import Update


def attach_media(
    client: TestClient,
    project: Project,
    update: dict,
    upload_id: uuid.UUID,
):
    return client.post(
        f"/projects/{project.id}/updates/{update['id']}/media",
        json={"upload_id": str(upload_id)},
    )


def test_create_update_with_media_upload_ids(
    client: TestClient,
    engine,
    project: Project,
    make_owned_asset,
    payload,
):
    asset = make_owned_asset(filename="first.pdf")

    response = client.post(
        f"/projects/{project.id}/updates",
        json={**payload, "media_upload_ids": [str(asset.id)]},
    )

    assert response.status_code == 201
    body = response.json()
    assert len(body["media"]) == 1
    assert body["media"][0]["filename"] == "first.pdf"

    with Session(engine) as session:
        saved_asset = session.get(FileAsset, asset.id)
        media_row = session.scalar(select(UpdateMedia))
        saved_update = session.get(Update, uuid.UUID(body["id"]))

    assert saved_asset is not None
    assert saved_asset.attached is True
    assert media_row is not None
    assert saved_update is not None
    assert media_row.update_id == saved_update.id


def test_duplicate_media_upload_ids_are_attached_once(
    client: TestClient,
    project: Project,
    make_owned_asset,
    payload,
):
    asset = make_owned_asset(filename="duplicate.pdf")

    response = client.post(
        f"/projects/{project.id}/updates",
        json={
            **payload,
            "media_upload_ids": [str(asset.id), str(asset.id)],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert len(body["media"]) == 1


def test_owner_can_attach_media_to_existing_update(
    client: TestClient,
    engine,
    project: Project,
    make_owned_asset,
    payload,
):
    created = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    asset = make_owned_asset(filename="bracket.pdf")

    response = attach_media(client, project, created, asset.id)

    assert response.status_code == 201
    body = response.json()
    assert body["update_id"] == created["id"]
    assert body["filename"] == "bracket.pdf"

    with Session(engine) as session:
        assert session.get(FileAsset, asset.id).attached is True
        assert session.scalar(
            select(UpdateMedia).where(
                UpdateMedia.update_id == uuid.UUID(created["id"])
            )
        ) is not None


def test_owner_lists_update_media(
    client: TestClient,
    project: Project,
    owner: User,
    make_asset,
    payload,
):
    created = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    asset = make_asset(owner, filename="notes.pdf")
    attach_media(client, project, created, asset.id)

    response = client.get(
        f"/projects/{project.id}/updates/{created['id']}/media"
    )

    assert response.status_code == 200
    assert [item["filename"] for item in response.json()] == ["notes.pdf"]


def test_media_is_in_update_read(
    client: TestClient,
    project: Project,
    owner: User,
    make_asset,
    payload,
):
    asset = make_asset(owner, filename="timeline.pdf")

    response = client.post(
        f"/projects/{project.id}/updates",
        json={**payload, "media_upload_ids": [str(asset.id)]},
    )

    assert response.status_code == 201
    assert response.json()["media"][0]["size"] == 2048


def test_another_users_upload_is_a_conflict(
    client: TestClient,
    project: Project,
    make_user,
    make_asset,
    payload,
):
    created = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    someone_else = make_user("someone")
    asset = make_asset(someone_else)

    response = attach_media(client, project, created, asset.id)

    assert response.status_code == 409
    assert "can't be added" in response.json()["detail"]


def test_unavailable_upload_is_a_conflict(
    client: TestClient,
    project: Project,
    owner: User,
    make_asset,
    payload,
):
    created = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    asset = make_asset(owner, status=UploadStatus.PENDING)

    response = attach_media(client, project, created, asset.id)

    assert response.status_code == 409


def test_wrong_resource_kind_is_a_conflict(
    client: TestClient,
    project: Project,
    owner: User,
    make_asset,
    payload,
):
    created = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    asset = make_asset(owner, kind=UploadKind.PICTURE)

    response = attach_media(client, project, created, asset.id)

    assert response.status_code == 409


def test_an_upload_can_only_be_attached_once(
    client: TestClient,
    project: Project,
    owner: User,
    make_asset,
    payload,
):
    first = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    asset = make_asset(owner)

    assert attach_media(client, project, first, asset.id).status_code == 201

    second = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()
    assert attach_media(client, project, second, asset.id).status_code == 409


def test_owner_can_delete_update_media_and_stored_asset(
    client: TestClient,
    engine,
    project: Project,
    make_owned_asset,
    payload,
):
    asset = make_owned_asset(filename="remove-me.pdf")
    created = client.post(
        f"/projects/{project.id}/updates",
        json={**payload, "media_upload_ids": [str(asset.id)]},
    ).json()
    media_id = created["media"][0]["id"]

    response = client.delete(
        f"/projects/{project.id}/updates/{created['id']}/media/{media_id}"
    )

    assert response.status_code == 204
    client.app.state.object_storage.delete_object.assert_called_once_with(
        UPLOAD_KINDS[asset.kind].bucket,
        asset.storage_key,
    )
    with Session(engine) as session:
        assert session.get(FileAsset, asset.id) is None
        assert session.get(UpdateMedia, uuid.UUID(media_id)) is None


def test_media_cannot_be_deleted_through_another_update(
    client: TestClient,
    project: Project,
    make_owned_asset,
    payload,
):
    asset = make_owned_asset()
    first = client.post(
        f"/projects/{project.id}/updates",
        json={**payload, "media_upload_ids": [str(asset.id)]},
    ).json()
    second = client.post(
        f"/projects/{project.id}/updates",
        json=payload,
    ).json()

    response = client.delete(
        f"/projects/{project.id}/updates/{second['id']}"
        f"/media/{first['media'][0]['id']}"
    )

    assert response.status_code == 404


def test_non_owner_cannot_delete_update_media(
    api,
    project: Project,
    make_owned_asset,
    make_user,
    payload,
):
    api.dependency_overrides[get_current_user_id] = lambda: project.author_id
    api.dependency_overrides[get_optional_current_user_id] = (
        lambda: project.author_id
    )
    with TestClient(api) as owner_client:
        asset = make_owned_asset()
        created = owner_client.post(
            f"/projects/{project.id}/updates",
            json={**payload, "media_upload_ids": [str(asset.id)]},
        ).json()

    intruder = make_user("media-delete-intruder")
    api.dependency_overrides[get_current_user_id] = lambda: intruder.id
    api.dependency_overrides[get_optional_current_user_id] = lambda: intruder.id
    with TestClient(api) as intruder_client:
        response = intruder_client.delete(
            f"/projects/{project.id}/updates/{created['id']}"
            f"/media/{created['media'][0]['id']}"
        )

    assert response.status_code == 403


def test_unauthenticated_user_cannot_delete_update_media(
    api,
    project: Project,
    owner: User,
    make_owned_asset,
    payload,
):
    api.dependency_overrides[get_current_user_id] = lambda: owner.id
    api.dependency_overrides[get_optional_current_user_id] = lambda: owner.id
    with TestClient(api) as owner_client:
        asset = make_owned_asset()
        created = owner_client.post(
            f"/projects/{project.id}/updates",
            json={**payload, "media_upload_ids": [str(asset.id)]},
        ).json()

    api.dependency_overrides.pop(get_current_user_id)
    with TestClient(api) as anonymous_client:
        response = anonymous_client.delete(
            f"/projects/{project.id}/updates/{created['id']}"
            f"/media/{created['media'][0]['id']}"
        )

    assert response.status_code == 401


def test_non_owner_cannot_attach_media(
    api,
    project: Project,
    make_user,
    make_owned_asset,
    payload,
):
    api.dependency_overrides[get_current_user_id] = lambda: project.author_id
    api.dependency_overrides[get_optional_current_user_id] = (
        lambda: project.author_id
    )
    with TestClient(api) as owner_client:
        create_response = owner_client.post(
            f"/projects/{project.id}/updates",
            json=payload,
        )
        assert create_response.status_code == 201
        created = create_response.json()

    asset = make_owned_asset()
    intruder = make_user("intruder")
    api.dependency_overrides[get_current_user_id] = lambda: intruder.id
    api.dependency_overrides[get_optional_current_user_id] = lambda: intruder.id

    with TestClient(api) as intruder_client:
        response = intruder_client.post(
            f"/projects/{project.id}/updates/{created['id']}/media",
            json={"upload_id": str(asset.id)},
        )

    assert response.status_code == 403


def test_deleting_update_cascades_media(
    client: TestClient,
    engine,
    project: Project,
    make_owned_asset,
    payload,
):
    assets = [
        make_owned_asset(filename="first.pdf"),
        make_owned_asset(filename="second.pdf"),
    ]
    created = client.post(
        f"/projects/{project.id}/updates",
        json={
            **payload,
            "media_upload_ids": [str(asset.id) for asset in assets],
        },
    ).json()

    response = client.delete(
        f"/projects/{project.id}/updates/{created['id']}"
    )

    assert response.status_code == 204
    update_id = uuid.UUID(created["id"])
    storage = client.app.state.object_storage
    assert storage.delete_object.call_count == len(assets)
    assert {
        call.args
        for call in storage.delete_object.call_args_list
    } == {
        (UPLOAD_KINDS[asset.kind].bucket, asset.storage_key)
        for asset in assets
    }
    with Session(engine) as session:
        assert session.get(Update, update_id) is None
        assert session.scalar(select(UpdateMedia)) is None
        assert all(session.get(FileAsset, asset.id) is None for asset in assets)
