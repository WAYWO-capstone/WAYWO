import uuid
from collections.abc import Callable, Iterator
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from botocore.exceptions import ClientError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Registers every model so foreign keys to users resolve in create_all.
import app.core.models_registry  # noqa: F401  pylint: disable=unused-import
from app.accounts.users.models import User
from app.core.base import Base
from app.core.config import settings
from app.core.database import get_session
from app.media.enums import UploadStatus
from app.media.models import FileAsset
from app.media.repository import FileAssetRepository
from app.media.router import router as media_router
from app.media.service import (
    ObjectStorage,
    StoredObject,
    StoredObjectLocation,
    UploadService,
    get_object_storage,
)
from app.projects.project.dependencies import get_current_user_id


class FakeStorage:
    """Stands in for R2: records what was signed and holds 'uploaded' objects."""

    def __init__(self) -> None:
        self.signed: list[dict[str, str]] = []
        self.objects: dict[str, StoredObject] = {}
        self.deleted: list[tuple[str, str]] = []

    def presign_put(self, bucket: str, key: str, content_type: str) -> str:
        self.signed.append({"bucket": bucket, "key": key, "content_type": content_type})
        return f"https://r2.example/{bucket}/{key}?signature=fake"

    def head_object(self, bucket: str, key: str) -> StoredObject | None:
        return self.objects.get(f"{bucket}/{key}")

    def delete_object(self, bucket: str, key: str) -> None:
        self.deleted.append((bucket, key))
        self.objects.pop(f"{bucket}/{key}", None)

    def put(self, bucket: str, key: str, size: int, content_type: str) -> None:
        """What the browser's PUT to R2 would leave behind."""
        self.objects[f"{bucket}/{key}"] = StoredObject(size=size, content_type=content_type)


def test_stored_object_cleanup_retries_and_continues(db: Session) -> None:
    class FailingStorage(FakeStorage):
        def __init__(self) -> None:
            super().__init__()
            self.delete_attempts: list[tuple[str, str]] = []

        def delete_object(self, bucket: str, key: str) -> None:
            self.delete_attempts.append((bucket, key))
            if key == "first":
                raise ClientError(
                    {"Error": {"Code": "InternalError", "Message": "Try again"}},
                    "DeleteObject",
                )
            super().delete_object(bucket, key)

    storage = FailingStorage()
    service = UploadService(FileAssetRepository(db), storage)

    service.delete_stored_objects(
        [
            StoredObjectLocation(bucket="private", key="first"),
            StoredObjectLocation(bucket="private", key="second"),
        ]
    )

    assert storage.delete_attempts == [
        ("private", "first"),
        ("private", "first"),
        ("private", "first"),
        ("private", "second"),
    ]


def test_stored_object_cleanup_does_not_retry_non_retryable_errors(
    db: Session,
) -> None:
    class DeniedStorage(FakeStorage):
        def __init__(self) -> None:
            super().__init__()
            self.delete_attempts: list[tuple[str, str]] = []

        def delete_object(self, bucket: str, key: str) -> None:
            self.delete_attempts.append((bucket, key))
            if key == "denied":
                raise ClientError(
                    {
                        "Error": {"Code": "AccessDenied", "Message": "Denied"},
                        "ResponseMetadata": {"HTTPStatusCode": 403},
                    },
                    "DeleteObject",
                )
            super().delete_object(bucket, key)

    storage = DeniedStorage()
    service = UploadService(FileAssetRepository(db), storage)

    service.delete_stored_objects(
        [
            StoredObjectLocation(bucket="private", key="denied"),
            StoredObjectLocation(bucket="private", key="second"),
        ]
    )

    assert storage.delete_attempts == [
        ("private", "denied"),
        ("private", "second"),
    ]


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(
        engine,
        "connect",
        lambda dbapi_connection, _: dbapi_connection.execute("PRAGMA foreign_keys=ON"),
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    with Session(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def api(engine: Engine, storage: FakeStorage) -> Iterator[FastAPI]:
    app = FastAPI()
    app.include_router(media_router)

    def override_get_session() -> Iterator[Session]:
        with Session(engine, expire_on_commit=False) as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_object_storage] = lambda: storage
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db: Session) -> Callable[[str], User]:
    def _make_user(username: str) -> User:
        user = User(id=uuid.uuid4(), username=username, email=f"{username}@example.com")
        db.add(user)
        db.commit()
        return user

    return _make_user


@pytest.fixture
def owner(make_user: Callable[[str], User]) -> User:
    return make_user("owner")


def authenticate_as(api: FastAPI, user: User) -> None:
    api.dependency_overrides[get_current_user_id] = lambda: user.id


@pytest.fixture
def client(api: FastAPI, owner: User) -> Iterator[TestClient]:
    authenticate_as(api, owner)
    with TestClient(api) as test_client:
        yield test_client


def stl_payload(**changes: Any) -> dict[str, Any]:
    return {"kind": "RESOURCE", "filename": "Bracket.STL", "size": 2048, "mime_type": ""} | changes


def create(client: TestClient, **changes: Any):
    return client.post("/uploads", json=stl_payload(**changes))


def stored(db: Session, upload_id: str) -> FileAsset:
    db.expire_all()
    asset = db.get(FileAsset, uuid.UUID(upload_id))
    assert asset is not None
    return asset


# --------------------------------------------------------------------------
# GET /uploads/config
# --------------------------------------------------------------------------


def test_config_is_public_and_not_caught_by_the_upload_id_route(api: FastAPI):
    with TestClient(api) as anonymous:
        response = anonymous.get("/uploads/config")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"PICTURE", "RESOURCE"}
    assert body["RESOURCE"]["max_size"] == 50 * 1024 * 1024
    assert ".stl" in body["RESOURCE"]["allowed_extensions"]
    assert body["PICTURE"]["allowed_extensions"] == []


# --------------------------------------------------------------------------
# POST /uploads
# --------------------------------------------------------------------------


def test_create_signs_a_pending_upload(
    client: TestClient, db: Session, storage: FakeStorage, owner: User
):
    response = create(client)

    assert response.status_code == 201
    body = response.json()
    assert body["headers"] == {
        "Content-Type": "application/octet-stream",
        "If-None-Match": "*",
    }
    assert body["url"].startswith("https://r2.example/")
    asset = stored(db, body["upload_id"])
    assert asset.status == UploadStatus.PENDING
    assert asset.owner_id == owner.id
    assert asset.mime_type == "application/octet-stream"
    assert storage.signed[0]["content_type"] == "application/octet-stream"


def test_signed_upload_link_cannot_replace_a_stored_file():
    # Signing is local, so this runs without reaching R2. R2 rejects a PUT whose
    # signed If-None-Match: * fails, so the link can't overwrite a verified file.
    url = ObjectStorage().presign_put("bucket", "resources/key", "application/pdf")

    signed = parse_qs(urlparse(url).query)["X-Amz-SignedHeaders"][0].split(";")
    assert "if-none-match" in signed
    assert "content-type" in signed


def test_storage_key_is_built_by_the_server_without_the_file_name(
    client: TestClient, storage: FakeStorage, owner: User
):
    create(client, filename="../../secret plans.STL")

    key = storage.signed[0]["key"]
    prefix, owner_id, random_part = key.split("/")
    assert prefix == "resources"
    assert owner_id == str(owner.id)
    uuid.UUID(random_part)
    assert "secret" not in key


def test_resources_are_signed_for_the_private_bucket(client: TestClient, storage: FakeStorage):
    create(client)
    assert storage.signed[0]["bucket"] == settings.r2_private_bucket_name


def test_pictures_are_signed_for_the_public_bucket(client: TestClient, storage: FakeStorage):
    response = client.post(
        "/uploads",
        json={"kind": "PICTURE", "filename": "me.png", "size": 1000, "mime_type": "image/png"},
    )

    assert response.status_code == 201
    assert storage.signed[0]["bucket"] == settings.r2_bucket_name
    assert storage.signed[0]["key"].startswith("pictures/")


def test_too_large_file_is_rejected_with_a_readable_message(client: TestClient, db: Session):
    response = create(client, size=50 * 1024 * 1024 + 1)

    assert response.status_code == 400
    assert response.json()["detail"] == "Bracket.STL is larger than 50 MB."
    assert db.query(FileAsset).count() == 0


def test_picture_limit_is_smaller(client: TestClient):
    response = client.post(
        "/uploads",
        json={
            "kind": "PICTURE",
            "filename": "me.png",
            "size": 6 * 1024 * 1024,
            "mime_type": "image/png",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "me.png is larger than 5 MB."


def test_type_not_allowed_is_rejected_with_a_readable_message(client: TestClient):
    response = create(client, filename="setup.exe", mime_type="application/x-msdownload")

    assert response.status_code == 400
    assert response.json()["detail"] == "setup.exe isn't a supported file type."


@pytest.mark.parametrize("payload_change", [{"size": 0}, {"filename": "   "}, {"kind": "VIDEO"}])
def test_invalid_payload_is_refused(client: TestClient, payload_change: dict[str, Any]):
    assert create(client, **payload_change).status_code == 422


def test_create_requires_login(api: FastAPI):
    with TestClient(api) as anonymous:
        response = create(anonymous)

    assert response.status_code == 401


# --------------------------------------------------------------------------
# POST /uploads/{upload_id}/complete and GET /uploads/{upload_id}
# --------------------------------------------------------------------------


@pytest.fixture
def created(client: TestClient, storage: FakeStorage) -> dict[str, Any]:
    body = create(client).json()
    body["signed"] = storage.signed[-1]
    return body


def upload_file(storage: FakeStorage, created: dict[str, Any], **changes: Any) -> None:
    signed = created["signed"]
    storage.put(
        signed["bucket"],
        signed["key"],
        changes.get("size", 2048),
        changes.get("content_type", signed["content_type"]),
    )


def complete(client: TestClient, upload_id: str):
    return client.post(f"/uploads/{upload_id}/complete")


def test_complete_before_the_file_arrives_is_a_conflict(
    client: TestClient, db: Session, created: dict[str, Any]
):
    response = complete(client, created["upload_id"])

    assert response.status_code == 409
    assert response.json()["detail"] == "The file didn't reach storage. Try uploading it again."
    assert stored(db, created["upload_id"]).status == UploadStatus.PENDING


def test_matching_file_becomes_ready(
    client: TestClient, db: Session, storage: FakeStorage, created: dict[str, Any]
):
    upload_file(storage, created)

    response = complete(client, created["upload_id"])

    assert response.status_code == 200
    assert response.json() == {
        "upload_id": created["upload_id"],
        "kind": "RESOURCE",
        "filename": "Bracket.STL",
        "size": 2048,
        "status": "READY",
    }
    asset = stored(db, created["upload_id"])
    assert asset.status == UploadStatus.READY
    assert asset.uploaded_at is not None


@pytest.mark.parametrize("mismatch", [{"size": 4096}, {"content_type": "text/html"}])
def test_mismatched_file_fails_and_is_deleted(
    client: TestClient,
    db: Session,
    storage: FakeStorage,
    created: dict[str, Any],
    mismatch: dict[str, Any],
):
    upload_file(storage, created, **mismatch)

    response = complete(client, created["upload_id"])

    assert response.status_code == 200
    assert response.json()["status"] == "FAILED"
    # Saved even though the request reported a failure.
    assert stored(db, created["upload_id"]).status == UploadStatus.FAILED
    assert storage.deleted == [(created["signed"]["bucket"], created["signed"]["key"])]


def test_repeating_complete_is_harmless(
    client: TestClient, storage: FakeStorage, created: dict[str, Any]
):
    upload_file(storage, created)
    complete(client, created["upload_id"])
    # Even if the object changed afterwards, the first decision stands.
    upload_file(storage, created, size=1)

    response = complete(client, created["upload_id"])

    assert response.status_code == 200
    assert response.json()["status"] == "READY"
    assert not storage.deleted


def test_get_returns_the_current_status(client: TestClient, created: dict[str, Any]):
    response = client.get(f"/uploads/{created['upload_id']}")

    assert response.status_code == 200
    assert response.json()["status"] == "PENDING"


def test_another_users_upload_is_not_found(
    api: FastAPI,
    make_user: Callable[[str], User],
    storage: FakeStorage,
    created: dict[str, Any],
):
    upload_file(storage, created)
    authenticate_as(api, make_user("intruder"))
    with TestClient(api) as intruder:
        assert complete(intruder, created["upload_id"]).status_code == 404
        assert intruder.get(f"/uploads/{created['upload_id']}").status_code == 404


def test_unknown_upload_is_not_found(client: TestClient):
    assert complete(client, str(uuid.uuid4())).status_code == 404
    assert client.get(f"/uploads/{uuid.uuid4()}").status_code == 404
