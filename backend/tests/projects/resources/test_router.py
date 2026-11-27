import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Registers every model, so foreign keys resolve in create_all.
import app.core.models_registry  # noqa: F401  pylint: disable=unused-import
from app.accounts.users.models import User
from app.core.base import Base
from app.core.database import get_session
from app.media.enums import UploadKind, UploadStatus
from app.media.models import FileAsset
from app.projects.project.dependencies import (
    get_current_user_id,
    get_optional_current_user_id,
)
from app.projects.project.enums import ProjectStatus
from app.projects.project.models import Category, Project
from app.projects.resources.models import ProjectResourceLink
from app.projects.resources.router import router as resources_router

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
def api(engine: Engine) -> Iterator[FastAPI]:
    app = FastAPI()
    app.include_router(resources_router, prefix="/projects")

    def override_get_session() -> Iterator[Session]:
        with Session(engine, expire_on_commit=False) as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_optional_current_user_id] = lambda: None
    yield app
    app.dependency_overrides.clear()


def authenticate_as(api: FastAPI, user: User) -> None:
    api.dependency_overrides[get_current_user_id] = lambda: user.id
    api.dependency_overrides[get_optional_current_user_id] = lambda: user.id


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


@pytest.fixture
def make_project(db: Session) -> Callable[..., Project]:
    def _make_project(author: User, *, public: bool = False) -> Project:
        category = Category(name=f"category-{uuid.uuid4().hex[:8]}", description="")
        db.add(category)
        db.flush()
        project = Project(
            author_id=author.id,
            title="Project",
            body="",
            public=public,
            summary="A project",
            category=category,
            status=ProjectStatus.ACTIVE if public else ProjectStatus.DRAFT,
        )
        db.add(project)
        db.commit()
        return project

    return _make_project


@pytest.fixture
def project(make_project: Callable[..., Project], owner: User) -> Project:
    return make_project(owner)


@pytest.fixture
def make_asset(db: Session) -> Callable[..., FileAsset]:
    def _make_asset(
        owner: User,
        *,
        kind: UploadKind = UploadKind.RESOURCE,
        status: UploadStatus = UploadStatus.READY,
        attached: bool = False,
        filename: str = "Bracket.STL",
    ) -> FileAsset:
        asset = FileAsset(
            owner_id=owner.id,
            kind=kind,
            filename=filename,
            mime_type="application/octet-stream",
            size_bytes=2048,
            storage_key=f"resources/{owner.id}/{uuid.uuid4()}",
            status=status,
            attached=attached,
        )
        db.add(asset)
        db.commit()
        return asset

    return _make_asset


@pytest.fixture
def client(api: FastAPI, owner: User) -> Iterator[TestClient]:
    authenticate_as(api, owner)
    with TestClient(api) as test_client:
        yield test_client


def attach(
    client: TestClient, project_id: uuid.UUID, upload_id: uuid.UUID, **extra: Any
):
    return client.post(
        f"/projects/{project_id}/resources",
        json={"upload_id": str(upload_id), **extra},
    )


def create_link(
    client: TestClient,
    project_id: uuid.UUID,
    *,
    title: str = "Reference",
    url: str = "https://example.com/guide",
):
    return client.post(
        f"/projects/{project_id}/resources/links",
        json={"title": title, "url": url},
    )


# --------------------------------------------------------------------------
# POST /projects/{project_id}/resources
# --------------------------------------------------------------------------


def test_owner_attaches_a_ready_upload(
    client: TestClient, db: Session, project: Project, owner: User, make_asset
):
    asset = make_asset(owner)

    response = attach(client, project.id, asset.id)

    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == str(project.id)
    assert body["title"] == "Bracket.STL"
    assert body["filename"] == "Bracket.STL"
    assert body["mime_type"] == "application/octet-stream"
    assert body["size"] == 2048
    db.refresh(asset)
    assert asset.attached is True


def test_title_is_used_when_given(
    client: TestClient, project: Project, owner: User, make_asset
):
    response = attach(
        client, project.id, make_asset(owner).id, title="  Mounting bracket  "
    )

    assert response.json()["title"] == "Mounting bracket"


def test_non_owner_is_forbidden(api: FastAPI, project: Project, make_user, make_asset):
    intruder = make_user("intruder")
    authenticate_as(api, intruder)
    with TestClient(api) as intruder_client:
        response = attach(intruder_client, project.id, make_asset(intruder).id)

    assert response.status_code == 403


def test_unknown_project_is_not_found(client: TestClient, owner: User, make_asset):
    assert attach(client, uuid.uuid4(), make_asset(owner).id).status_code == 404


@pytest.mark.parametrize(
    "asset_options",
    [
        {"status": UploadStatus.PENDING},
        {"status": UploadStatus.FAILED},
        {"kind": UploadKind.PICTURE},
        {"attached": True},
    ],
)
def test_unavailable_upload_is_a_conflict(
    client: TestClient, project: Project, owner: User, make_asset, asset_options
):
    response = attach(client, project.id, make_asset(owner, **asset_options).id)

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "This file can't be added to the project. Try uploading it again."
    )


def test_another_users_upload_is_a_conflict(
    client: TestClient, project: Project, make_user, make_asset
):
    someone_else = make_user("someone")
    assert attach(client, project.id, make_asset(someone_else).id).status_code == 409


def test_unknown_upload_is_a_conflict(client: TestClient, project: Project):
    assert attach(client, project.id, uuid.uuid4()).status_code == 409


def test_an_upload_can_only_be_attached_once(
    client: TestClient, project: Project, owner: User, make_asset, make_project
):
    asset = make_asset(owner)
    assert attach(client, project.id, asset.id).status_code == 201

    other_project = make_project(owner)
    assert attach(client, other_project.id, asset.id).status_code == 409


# --------------------------------------------------------------------------
# GET /projects/{project_id}/resources
# --------------------------------------------------------------------------


def test_owner_lists_resources_newest_first(
    client: TestClient, project: Project, owner: User, make_asset
):
    attach(client, project.id, make_asset(owner, filename="first.pdf").id)
    attach(client, project.id, make_asset(owner, filename="second.pdf").id)

    response = client.get(f"/projects/{project.id}/resources")

    assert response.status_code == 200
    assert [item["filename"] for item in response.json()] == ["second.pdf", "first.pdf"]


def test_anyone_can_list_a_public_projects_resources(
    api: FastAPI, make_project, owner: User
):
    public_project = make_project(owner, public=True)
    with TestClient(api) as anonymous:
        response = anonymous.get(f"/projects/{public_project.id}/resources")

    assert response.status_code == 200
    assert response.json() == []


def test_private_project_is_hidden_from_others(
    api: FastAPI, project: Project, make_user
):
    with TestClient(api) as anonymous:
        assert anonymous.get(f"/projects/{project.id}/resources").status_code == 404

    authenticate_as(api, make_user("intruder"))
    with TestClient(api) as intruder:
        assert intruder.get(f"/projects/{project.id}/resources").status_code == 404


# --------------------------------------------------------------------------
# POST /projects/{project_id}/resources/links
# --------------------------------------------------------------------------


def test_owner_adds_an_external_link(client: TestClient, project: Project, db: Session):
    response = create_link(client, project.id, title="Setup guide")

    assert response.status_code == 201
    body = response.json()
    assert body["project_id"] == str(project.id)
    assert body["title"] == "Setup guide"
    assert body["url"] == "https://example.com/guide"
    assert body["id"]
    assert body["created_at"]
    assert db.query(ProjectResourceLink).count() == 1


def test_resource_link_title_is_trimmed(client: TestClient, project: Project):
    response = create_link(client, project.id, title="  Setup guide  ")

    assert response.status_code == 201
    assert response.json()["title"] == "Setup guide"


@pytest.mark.parametrize(
    ("title", "url"),
    [
        ("Guide", "javascript:alert(1)"),
        ("Guide", "ftp://example.com/file"),
        ("Guide", "not a URL"),
        ("   ", "https://example.com"),
    ],
)
def test_invalid_resource_link_is_rejected(
    client: TestClient, project: Project, title: str, url: str
):
    response = create_link(client, project.id, title=title, url=url)

    assert response.status_code == 422


def test_non_owner_cannot_add_a_resource_link(
    api: FastAPI, project: Project, make_user
):
    authenticate_as(api, make_user("intruder"))
    with TestClient(api) as intruder:
        response = create_link(intruder, project.id)

    assert response.status_code == 403
    assert response.json()["detail"] == "You do not own this project"


def test_unknown_project_cannot_receive_a_resource_link(
    client: TestClient,
):
    response = create_link(client, uuid.uuid4())

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


# --------------------------------------------------------------------------
# GET /projects/{project_id}/resources/links
# --------------------------------------------------------------------------


def test_owner_lists_resource_links_newest_first(client: TestClient, project: Project):
    create_link(client, project.id, title="First", url="https://example.com/first")
    create_link(client, project.id, title="Second", url="https://example.com/second")

    response = client.get(f"/projects/{project.id}/resources/links")

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["Second", "First"]


def test_anonymous_users_can_list_public_project_links(
    api: FastAPI, make_project, owner: User
):
    public_project = make_project(owner, public=True)
    authenticate_as(api, owner)
    with TestClient(api) as owner_client:
        assert create_link(owner_client, public_project.id).status_code == 201

    api.dependency_overrides[get_optional_current_user_id] = lambda: None
    with TestClient(api) as anonymous:
        response = anonymous.get(f"/projects/{public_project.id}/resources/links")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_private_project_links_are_hidden_from_others(
    api: FastAPI, project: Project, make_user
):
    with TestClient(api) as anonymous:
        response = anonymous.get(f"/projects/{project.id}/resources/links")

    assert response.status_code == 404

    authenticate_as(api, make_user("link-intruder"))
    with TestClient(api) as intruder:
        response = intruder.get(f"/projects/{project.id}/resources/links")

    assert response.status_code == 404


def test_unknown_project_links_are_not_found(client: TestClient):
    response = client.get(f"/projects/{uuid.uuid4()}/resources/links")

    assert response.status_code == 404
