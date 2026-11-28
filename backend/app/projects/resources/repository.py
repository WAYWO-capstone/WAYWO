import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.projects.resources.models import ProjectResource, ProjectResourceLink


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


class ResourceLinkRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, link: ProjectResourceLink) -> ProjectResourceLink:
        self._session.add(link)
        self._session.flush()
        return link

    def list_for_project(self, project_id: uuid.UUID) -> list[ProjectResourceLink]:
        return list(
            self._session.scalars(
                select(ProjectResourceLink)
                .where(ProjectResourceLink.project_id == project_id)
                .order_by(
                    ProjectResourceLink.created_at.desc(),
                    ProjectResourceLink.id.desc(),
                )
            ).all()
        )
