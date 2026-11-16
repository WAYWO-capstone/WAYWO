import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.projects.resources.models import ProjectResource


class ResourceRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, resource: ProjectResource) -> ProjectResource:
        self._session.add(resource)
        self._session.flush()
        return resource

    def list_for_project(self, project_id: uuid.UUID) -> list[ProjectResource]:
        """A project's resources, newest first."""
        return list(
            self._session.scalars(
                select(ProjectResource)
                .where(ProjectResource.project_id == project_id)
                # id is a tie-breaker so the order stays stable for equal timestamps
                .order_by(ProjectResource.created_at.desc(), ProjectResource.id.desc())
            ).all()
        )
