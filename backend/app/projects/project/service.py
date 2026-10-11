import uuid

from app.projects.project.enums import ProjectStatus
from app.projects.project.exceptions import (
    CategoryNotFoundError,
    ProjectNotFoundError,
    ProjectNotOwnedError,
)
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, repository: ProjectRepository):
        self._repo = repository

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
        return self._repo.update(project)