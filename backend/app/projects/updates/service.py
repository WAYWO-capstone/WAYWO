import uuid

from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.models import Update
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.schemas import UpdateCreate, UpdateRead


class UpdateService:
    def __init__(
        self,
        repository: UpdateRepository,
        project_repository: ProjectRepository,
    ):
        self._repo = repository
        self._project_repo = project_repository

    def create_project_update(
        self,
        project_id: uuid.UUID,
        author_id: uuid.UUID,
        data: UpdateCreate,
    ) -> UpdateRead:
        project = self._project_repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != author_id:
            raise ProjectNotOwnedError(project_id)

        update = Update(
            project_id=project_id,
            author_id=author_id,
            title=data.title,
            body=data.body,
            update_type=data.type,
            public=data.public,
        )
        row = self._repo.add(update)
        return self._to_read(row)

    def list_project_updates(
        self,
        project_id: uuid.UUID,
        viewer_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[UpdateRead], int]:
        """Return one page of a project's updates (newest first) and the total.

        A project the viewer may not see is reported as not found, so its
        existence isn't leaked.
        """
        project = self._project_repo.get(project_id)
        if project is None or not (
            project.public or project.author_id == viewer_id
        ):
            raise ProjectNotFoundError(project_id)

        rows, total = self._repo.list_for_project(
            project_id, viewer_id, limit=limit, offset=offset
        )
        items = [self._to_read(row) for row in rows]
        return items, total

    @staticmethod
    def _to_read(row: tuple[Update, str | None, str | None]) -> UpdateRead:
        update, username, profile_picture_link = row
        return UpdateRead(
            id=update.id,
            project_id=update.project_id,
            author_id=update.author_id,
            title=update.title,
            body=update.body,
            type=update.update_type,
            public=update.public,
            created_at=update.created_at,
            updated_at=update.updated_at,
            author=ProjectAuthorRead(
                username=username or "Unknown creator",
                profile_picture_link=profile_picture_link,
            ),
        )
