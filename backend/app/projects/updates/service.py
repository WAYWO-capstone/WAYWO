import uuid

from app.core.common import utcnow
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.project.repository import ProjectRepository
from app.projects.project.schemas import ProjectAuthorRead
from app.projects.updates.enums import UpdateType
from app.projects.updates.exceptions import (
    InvalidProblemLinkError,
    ProblemLinkRequiredError,
    ProblemNotFoundError,
    UpdateNotFoundError,
    UpdateNotOwnedError,
)
from app.projects.updates.models import Update
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.schemas import UpdateCreate, UpdateEdit, UpdateRead


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
        problem = self._validate_problem_link(
            project_id, data.type, data.problem_id
        )

        update = Update(
            project_id=project_id,
            author_id=author_id,
            title=data.title,
            body=data.body,
            update_type=data.type,
            public=project.public and data.public is not False,
            problem_id=problem.id if problem is not None else None,
        )
        row = self._repo.add(update)
        return self._to_read(row)

    def edit_project_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
        data: UpdateEdit,
    ) -> UpdateRead:
        update = self._get_owned_update(project_id, update_id, author_id)
        values = data.model_dump(exclude_unset=True)
        update_type = values.get("type", update.update_type)
        problem_id = values.get("problem_id", getattr(update, "problem_id", None))
        if update_type is not UpdateType.SOLUTION and "problem_id" not in values:
            problem_id = None
        problem = self._validate_problem_link(project_id, update_type, problem_id)
        for field, value in values.items():
            setattr(update, "update_type" if field == "type" else field, value)
        update.problem_id = problem.id if problem is not None else None
        update.updated_at = utcnow()
        return self._to_read(self._repo.update(update))

    def delete_project_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
    ) -> None:
        update = self._get_owned_update(project_id, update_id, author_id)
        self._repo.delete(update)

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

    def _get_owned_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        author_id: uuid.UUID,
    ) -> Update:
        update = self._repo.get(update_id)
        if update is None or update.project_id != project_id:
            raise UpdateNotFoundError(update_id)
        if update.author_id != author_id:
            raise UpdateNotOwnedError(update_id)
        return update

    def _validate_problem_link(
        self,
        project_id: uuid.UUID,
        update_type: UpdateType,
        problem_id: uuid.UUID | None,
    ) -> Update | None:
        if update_type is not UpdateType.SOLUTION:
            if problem_id is not None:
                raise InvalidProblemLinkError(problem_id)
            return None
        if problem_id is None:
            raise ProblemLinkRequiredError
        problem = self._repo.get(problem_id)
        if problem is None or problem.project_id != project_id:
            raise ProblemNotFoundError(problem_id)
        if problem.update_type is not UpdateType.PROBLEM:
            raise InvalidProblemLinkError(problem_id)
        return problem

    @staticmethod
    def _to_read(row: tuple[Update, str | None, str | None]) -> UpdateRead:
        update, username, profile_picture_link = row
        return UpdateRead(
            id=update.id,
            project_id=update.project_id,
            problem_id=getattr(update, "problem_id", None),
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
