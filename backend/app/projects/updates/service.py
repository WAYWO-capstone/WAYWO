import uuid

from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.project.repository import ProjectRepository
from app.projects.updates.models import Update
from app.projects.updates.repository import UpdateRepository

class UpdateService:
    def __init__(
        self,
        repository: UpdateRepository,
        project_repository: ProjectRepository,
    ):
        self._repo = repository
        self._project_repo = project_repository

    def list_project_updates(
        self,
        project_id: uuid.UUID,
        viewer_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[Update], int]:
        """Return one page of a project's updates (newest first) and the total.

        A project the viewer may not see is reported as not found, so its
        existence isn't leaked.
        """
        project = self._project_repo.get(project_id)
        if project is None or not (
            project.public or project.author_id == viewer_id
        ):
            raise ProjectNotFoundError(project_id)

        return self._repo.list_for_project(
            project_id, viewer_id, limit=limit, offset=offset
        )