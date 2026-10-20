import uuid
from datetime import datetime, timezone

from app.projects.project.enums import ProjectStatus
from app.projects.project.exceptions import (
    CategoryNotFoundError,
    InvalidProjectStatusTransitionError,
    ProjectNotFoundError,
    ProjectNotOwnedError,
)
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectStatusUpdate,
    ProjectUpdate,
)


class ProjectService:
    def __init__(self, repository: ProjectRepository):
        self._repo = repository

    def list_categories(self):
        return self._repo.list_categories()

    def get_project_for_view(
        self, project_id: uuid.UUID, viewer_id: uuid.UUID | None = None
    ):
        result = self._repo.get_with_author(project_id)
        if result is None:
            raise ProjectNotFoundError(project_id)

        project, username, profile_picture_link = result
        if not project.public and project.author_id != viewer_id:
            raise ProjectNotFoundError(project_id)

        project_data = ProjectRead.model_validate(project).model_dump()
        project_data["author"] = {
            "username": username or "Unknown creator",
            "profile_picture_link": profile_picture_link,
        }
        return project_data

    def list_private_drafts(self, author_id: uuid.UUID) -> list[Project]:
        return self._repo.list_private_drafts(author_id)

    def list_published_by_author(self, author_id: uuid.UUID) -> list[Project]:
        return self._repo.list_published_by_author(author_id)

    def create_project(self, author_id: uuid.UUID, data: ProjectCreate) -> Project:
        category = self._repo.get_category(data.category_id)
        if category is None:
            raise CategoryNotFoundError(data.category_id)

        tags = self._repo.get_or_create_tags(data.tags)

        # New projects always start as private drafts; publishing is a later step.
        project = Project(
            author_id=author_id,
            title=data.title,
            summary=data.summary,
            description=data.description,
            status=ProjectStatus.DRAFT,
            public=False,
            category=category,
            tags=tags,
        )
        return self._repo.add(project)

    def update_project(
        self, project_id: uuid.UUID, author_id: uuid.UUID, data: ProjectUpdate
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)

        self._apply_project_changes(project, data)
        return self._repo.update(project)

    def autosave_project(
        self, project_id: uuid.UUID, author_id: uuid.UUID, data: ProjectUpdate
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        if project.status != ProjectStatus.DRAFT or project.public:
            raise InvalidProjectStatusTransitionError(
                project_id, "must be a private draft to autosave"
            )

        self._apply_project_changes(project, data)
        project.last_autosaved_at = datetime.now(timezone.utc)
        return self._repo.update(project)

    def _apply_project_changes(self, project: Project, data: ProjectUpdate) -> None:
        changes = data.model_dump(exclude_unset=True)
        if "category_id" in changes:
            category = self._repo.get_category(changes["category_id"])
            if category is None:
                raise CategoryNotFoundError(changes["category_id"])
            project.category = category
            changes.pop("category_id")
        if "tags" in changes:
            project.tags = self._repo.get_or_create_tags(changes.pop("tags"))
        for field, value in changes.items():
            setattr(project, field, value)
            setattr(project, field, value)

    def save_draft(
        self, project_id: uuid.UUID, author_id: uuid.UUID, data: ProjectUpdate
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        if project.status != ProjectStatus.DRAFT or project.public:
            raise InvalidProjectStatusTransitionError(
                project_id, "must be a private draft to save as a draft"
            )

        self._apply_project_changes(project, data)
        return self._repo.update(project)

    def update_status(
        self,
        project_id: uuid.UUID,
        author_id: uuid.UUID,
        data: ProjectStatusUpdate,
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        if project.status == ProjectStatus.DRAFT or not project.public:
            raise InvalidProjectStatusTransitionError(
                project_id, "must be published before its status can change"
            )

        project.status = data.status
        project.completed_at = (
            datetime.now(timezone.utc)
            if data.status == ProjectStatus.COMPLETED
            else None
        )
        return self._repo.update(project)

    def publish_project(
        self, project_id: uuid.UUID, author_id: uuid.UUID
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        if project.status != ProjectStatus.DRAFT or project.public:
            raise InvalidProjectStatusTransitionError(
                project_id, "is already published"
            )

        now = datetime.now(timezone.utc)
        project.status = ProjectStatus.ACTIVE
        project.public = True
        project.published_at = now
        project.completed_at = None
        return self._repo.update(project)

    def unpublish_project(
        self, project_id: uuid.UUID, author_id: uuid.UUID
    ) -> Project:
        project = self._repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)
        if project.status not in (
            ProjectStatus.ACTIVE,
            ProjectStatus.COMPLETED,
        ) or not project.public:
            raise InvalidProjectStatusTransitionError(
                project_id,
                "only active or completed published projects can be unpublished",
            )

        project.status = ProjectStatus.DRAFT
        project.public = False
        project.published_at = None
        project.completed_at = None
        return self._repo.update(project)
