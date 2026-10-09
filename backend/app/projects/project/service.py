import uuid

from app.projects.project.enums import ProjectStatus
from app.projects.project.exceptions import CategoryNotFoundError
from app.projects.project.models import Project
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectCreate


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