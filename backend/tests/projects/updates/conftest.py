import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.accounts.users.models import Profile, User
from app.core.base import Base
from app.core.database import get_session
from app.projects.project.dependencies import get_current_user_id
from app.projects.project.enums import ProjectStatus
from app.projects.project.models import Category, Project
from app.projects.updates.router import router as updates_router
from tests.projects.updates.helpers import post_update

# --------------------------------------------------------------------------
# Infrastructure fixtures
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
        lambda dbapi_connection, _: dbapi_connection.execute(
            "PRAGMA foreign_keys=ON"
        ),
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """Session used only to seed test data (the API gets its own sessions)."""
    with Session(engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
def api(engine: Engine) -> Iterator[FastAPI]:
    """A fresh app per test, so dependency overrides never leak between tests."""
    app = FastAPI()
    app.include_router(updates_router, prefix="/projects")

    def override_get_session() -> Iterator[Session]:
        with Session(engine, expire_on_commit=False) as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise

    app.dependency_overrides[get_session] = override_get_session
    yield app
    app.dependency_overrides.clear()


def authenticate_as(api: FastAPI, user: User) -> None:
    api.dependency_overrides[get_current_user_id] = lambda: user.id


@pytest.fixture
def client(api: FastAPI, owner: User) -> Iterator[TestClient]:
    """Test client authenticated as the project owner by default."""
    authenticate_as(api, owner)
    with TestClient(api) as test_client:
        yield test_client


@pytest.fixture
def intruder_client(
    api: FastAPI, make_user: Callable[[str], User]
) -> Iterator[TestClient]:
    """Test client authenticated as a user who does not own the project."""
    authenticate_as(api, make_user("intruder"))
    with TestClient(api) as test_client:
        yield test_client


# --------------------------------------------------------------------------
# Data factories
# --------------------------------------------------------------------------


@pytest.fixture
def make_user(db: Session) -> Callable[[str], User]:
    def _make_user(username: str) -> User:
        user = User(
            id=uuid.uuid4(),
            username=username,
            email=f"{username}@example.com",
        )
        db.add(user)
        db.flush()
        db.add(
            Profile(
                user_id=user.id,
                profile_picture_link=f"https://example.com/{username}.png",
            )
        )
        db.commit()
        return user

    return _make_user


@pytest.fixture
def make_project(db: Session) -> Callable[[User], Project]:
    def _make_project(author: User) -> Project:
        category = Category(
            name=f"category-{uuid.uuid4().hex[:8]}",
            description="",
        )
        db.add(category)
        db.flush()
        project = Project(
            author_id=author.id,
            title="Project",
            body="",
            public=False,
            summary="A project",
            category=category,
            status=ProjectStatus.DRAFT,
        )
        db.add(project)
        db.commit()
        return project

    return _make_project


@pytest.fixture
def owner(make_user: Callable[[str], User]) -> User:
    return make_user("owner")


@pytest.fixture
def project(make_project: Callable[[User], Project], owner: User) -> Project:
    return make_project(owner)


@pytest.fixture
def payload() -> dict[str, Any]:
    return {
        "title": "First milestone",
        "body": "The frame is assembled.",
        "type": "PROGRESS",
        "public": True,
    }


@pytest.fixture
def created_update(
    client: TestClient,
    project: Project,
    payload: dict[str, Any],
) -> dict[str, Any]:
    response = post_update(client, project.id, payload)
    assert response.status_code == 201
    return response.json()


