import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.updates.enums import UpdateType
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.schemas import UpdateCreate
from app.projects.updates.service import UpdateService


@pytest.fixture
def repository() -> MagicMock:
    repo = MagicMock(spec=UpdateRepository)
    repo.list_for_project.return_value = ([], 0)
    return repo


@pytest.fixture
def project_repository() -> MagicMock:
    return MagicMock(spec=ProjectRepository)


@pytest.fixture
def service(
    repository: MagicMock, project_repository: MagicMock
) -> UpdateService:
    return UpdateService(repository, project_repository)


@pytest.fixture
def project_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def viewer_id() -> uuid.UUID:
    return uuid.uuid4()


def make_project(project_id: uuid.UUID, *, public: bool, author_id: uuid.UUID):
    project = MagicMock(spec=Project)
    project.id = project_id
    project.public = public
    project.author_id = author_id
    return project


def make_update(project_id: uuid.UUID, title: str = "First cut"):
    now = datetime(2026, 10, 1, tzinfo=timezone.utc)
    return SimpleNamespace(
        id=uuid.uuid4(),
        project_id=project_id,
        author_id=uuid.uuid4(),
        title=title,
        body="Cut the panels.",
        update_type=UpdateType.PROGRESS,
        public=True,
        created_at=now,
        updated_at=now,
    )


class TestCreateProjectUpdate:
    def test_creates_update_for_project_owner(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=viewer_id
        )
        update = make_update(project_id)
        repository.add.return_value = (update, "anna", "https://pics/anna.png")

        result = service.create_project_update(
            project_id,
            viewer_id,
            UpdateCreate(
                title="First cut",
                body="Cut the panels.",
                type=UpdateType.DECISION,
                public=True,
            ),
        )

        created = repository.add.call_args.args[0]
        assert created.project_id == project_id
        assert created.author_id == viewer_id
        assert created.title == "First cut"
        assert created.body == "Cut the panels."
        assert created.update_type == UpdateType.DECISION
        assert created.public is True
        assert result.id == update.id
        assert result.author.username == "anna"
        assert result.author.profile_picture_link == "https://pics/anna.png"

    def test_private_project_cannot_have_public_update(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=False, author_id=viewer_id
        )
        update = make_update(project_id)
        repository.add.return_value = (update, "anna", None)

        service.create_project_update(
            project_id,
            viewer_id,
            UpdateCreate(
                title="First cut",
                body="Cut the panels.",
                public=True,
            ),
        )

        assert repository.add.call_args.args[0].public is False

    def test_omitted_visibility_inherits_project_visibility(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=viewer_id
        )
        update = make_update(project_id)
        repository.add.return_value = (update, "anna", None)

        service.create_project_update(
            project_id,
            viewer_id,
            UpdateCreate(title="First cut", body="Cut the panels."),
        )

        assert repository.add.call_args.args[0].public is True

    def test_rejects_update_by_non_owner(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )

        with pytest.raises(ProjectNotOwnedError):
            service.create_project_update(
                project_id,
                viewer_id,
                UpdateCreate(title="First cut", body="Cut the panels."),
            )

        repository.add.assert_not_called()

    def test_rejects_update_for_missing_project(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = None

        with pytest.raises(ProjectNotFoundError):
            service.create_project_update(
                project_id,
                viewer_id,
                UpdateCreate(title="First cut", body="Cut the panels."),
            )

        repository.add.assert_not_called()


class TestListProjectUpdates:
    def test_returns_updates_with_their_author_and_total(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )
        first, second = make_update(project_id, "A"), make_update(project_id, "B")
        repository.list_for_project.return_value = (
            [(first, "anna", "https://pics/anna.png"), (second, "ben", None)],
            45,
        )

        result, total = service.list_project_updates(
            project_id, viewer_id, limit=2, offset=0
        )

        assert total == 45
        assert [item.id for item in result] == [first.id, second.id]
        assert result[0].type == UpdateType.PROGRESS
        assert result[0].author.username == "anna"
        assert result[0].author.profile_picture_link == "https://pics/anna.png"
        assert result[1].author.username == "ben"
        assert result[1].author.profile_picture_link is None

    def test_missing_author_falls_back_to_unknown_creator(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )
        repository.list_for_project.return_value = (
            [(make_update(project_id), None, None)],
            1,
        )

        result, _ = service.list_project_updates(
            project_id, viewer_id, limit=20, offset=0
        )

        assert result[0].author.username == "Unknown creator"

    def test_passes_viewer_and_paging_to_repository(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )

        service.list_project_updates(project_id, viewer_id, limit=5, offset=10)

        repository.list_for_project.assert_called_once_with(
            project_id, viewer_id, limit=5, offset=10
        )

    def test_empty_history_returns_empty_list_and_zero_total(
        self, service, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )

        result, total = service.list_project_updates(
            project_id, viewer_id, limit=20, offset=0
        )

        assert result == []
        assert total == 0


class TestListProjectUpdatesVisibility:
    def test_public_project_is_visible_to_any_viewer(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )

        service.list_project_updates(project_id, viewer_id, limit=20, offset=0)

        repository.list_for_project.assert_called_once()

    def test_private_project_is_visible_to_its_author(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=False, author_id=viewer_id
        )

        service.list_project_updates(project_id, viewer_id, limit=20, offset=0)

        repository.list_for_project.assert_called_once()

    def test_private_project_is_hidden_from_other_viewers(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=False, author_id=uuid.uuid4()
        )

        with pytest.raises(ProjectNotFoundError):
            service.list_project_updates(
                project_id, viewer_id, limit=20, offset=0
            )

        # A project the viewer can't see must not have its updates queried.
        repository.list_for_project.assert_not_called()

    def test_missing_project_raises_not_found(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = None

        with pytest.raises(ProjectNotFoundError):
            service.list_project_updates(
                project_id, viewer_id, limit=20, offset=0
            )

        project_repository.get.assert_called_once_with(project_id)
        repository.list_for_project.assert_not_called()
