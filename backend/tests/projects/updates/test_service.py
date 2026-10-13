import uuid
from unittest.mock import MagicMock

import pytest

from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.updates.models import Update
from app.projects.updates.repository import UpdateRepository
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


class TestListProjectUpdates:
    def test_returns_updates_and_total_from_repository(
        self, service, repository, project_repository, project_id, viewer_id
    ):
        project_repository.get.return_value = make_project(
            project_id, public=True, author_id=uuid.uuid4()
        )
        updates = [MagicMock(spec=Update), MagicMock(spec=Update)]
        repository.list_for_project.return_value = (updates, 45)

        result, total = service.list_project_updates(
            project_id, viewer_id, limit=2, offset=0
        )

        assert result == updates
        assert total == 45

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