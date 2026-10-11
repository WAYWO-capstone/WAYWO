import uuid
from unittest.mock import MagicMock

import pytest

from app.projects.project.enums import ProjectStatus
from app.projects.project.exceptions import CategoryNotFoundError
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectCreate, ProjectUpdate
from app.projects.project.service import ProjectService


@pytest.fixture
def repository() -> MagicMock:
    repo = MagicMock(spec=ProjectRepository)
    # By default, the repository persists and returns whatever it is given.
    repo.add.side_effect = lambda project: project
    return repo


@pytest.fixture
def service(repository: MagicMock) -> ProjectService:
    return ProjectService(repository)


@pytest.fixture
def author_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def project_data() -> ProjectCreate:
    return ProjectCreate(
        title="My Project",
        summary="A short summary",
        description="A much longer description of the project.",
        category_id=uuid.uuid4(),
        tags=["python", "fastapi"],
    )


class TestCreateProject:
    def test_returns_project_with_provided_fields(
        self, service, repository, author_id, project_data
    ):
        category = MagicMock(name="category")
        tags = [MagicMock(name="tag1"), MagicMock(name="tag2")]
        repository.get_category.return_value = category
        repository.get_or_create_tags.return_value = tags

        project = service.create_project(author_id, project_data)

        assert isinstance(project, Project)
        assert project.author_id == author_id
        assert project.title == project_data.title
        assert project.summary == project_data.summary
        assert project.description == project_data.description
        assert project.category is category
        assert project.tags == tags

    def test_new_project_is_private_draft(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = MagicMock()
        repository.get_or_create_tags.return_value = []

        project = service.create_project(author_id, project_data)

        assert project.status == ProjectStatus.DRAFT
        assert project.public is False

    def test_looks_up_category_by_id(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = MagicMock()
        repository.get_or_create_tags.return_value = []

        service.create_project(author_id, project_data)

        repository.get_category.assert_called_once_with(project_data.category_id)

    def test_gets_or_creates_tags_from_data(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = MagicMock()
        repository.get_or_create_tags.return_value = []

        service.create_project(author_id, project_data)

        repository.get_or_create_tags.assert_called_once_with(project_data.tags)

    def test_persists_project_and_returns_repository_result(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = MagicMock()
        repository.get_or_create_tags.return_value = []
        persisted = MagicMock(name="persisted_project")
        repository.add.side_effect = None
        repository.add.return_value = persisted

        result = service.create_project(author_id, project_data)

        repository.add.assert_called_once()
        added = repository.add.call_args.args[0]
        assert isinstance(added, Project)
        assert added.author_id == author_id
        assert result is persisted

    def test_raises_when_category_not_found(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = None

        with pytest.raises(CategoryNotFoundError):
            service.create_project(author_id, project_data)

    def test_does_not_create_tags_or_persist_when_category_missing(
        self, service, repository, author_id, project_data
    ):
        repository.get_category.return_value = None

        with pytest.raises(CategoryNotFoundError):
            service.create_project(author_id, project_data)

        repository.get_or_create_tags.assert_not_called()
        repository.add.assert_not_called()

    def test_handles_empty_tags(self, service, repository, author_id, project_data):
        project_data.tags = []
        repository.get_category.return_value = MagicMock()
        repository.get_or_create_tags.return_value = []

        project = service.create_project(author_id, project_data)

        repository.get_or_create_tags.assert_called_once_with([])
        assert project.tags == []


class TestUpdateProject:
    @pytest.fixture
    def project(self, author_id):
        return Project(
            author_id=author_id,
            title="Original title",
            summary="Original summary",
            description="Original description",
            category_id=uuid.uuid4(),
        )

    def test_updates_owned_project_fields(
        self, service, repository, project, author_id
    ):
        repository.get.return_value = project
        repository.update.side_effect = lambda value: value
        data = ProjectUpdate(
            title="Updated title",
            summary="Updated summary",
            description="Updated description",
        )

        result = service.update_project(project.id, author_id, data)

        assert result is project
        assert project.title == "Updated title"
        assert project.summary == "Updated summary"
        assert project.description == "Updated description"
        repository.update.assert_called_once_with(project)

    def test_rejects_missing_project(self, service, repository, author_id):
        project_id = uuid.uuid4()
        repository.get.return_value = None

        with pytest.raises(Exception, match="does not exist"):
            service.update_project(project_id, author_id, ProjectUpdate(title="New"))

        repository.update.assert_not_called()

    def test_rejects_project_owned_by_another_user(
        self, service, repository, project, author_id
    ):
        repository.get.return_value = project

        with pytest.raises(Exception, match="does not own"):
            service.update_project(project.id, uuid.uuid4(), ProjectUpdate(title="New"))

        repository.update.assert_not_called()

    def test_validates_replacement_category(
        self, service, repository, project, author_id
    ):
        repository.get.return_value = project
        repository.get_category.return_value = None
        category_id = uuid.uuid4()

        with pytest.raises(CategoryNotFoundError):
            service.update_project(
                project.id, author_id, ProjectUpdate(category_id=category_id)
            )

        repository.update.assert_not_called()