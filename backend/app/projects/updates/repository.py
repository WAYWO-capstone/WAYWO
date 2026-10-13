import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.projects.updates.models import Update


class UpdateRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_project(
        self,
        project_id: uuid.UUID,
        viewer_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[Update], int]:
        """One page of a project's updates, newest first, plus the total count.

        Non-public updates are included only when the viewer is their author.
        """
        conditions = (
            Update.project_id == project_id,
            or_(Update.public.is_(True), Update.author_id == viewer_id),
        )

        total = self._session.scalar(
            select(func.count()).select_from(Update).where(*conditions)
        ) or 0

        updates = self._session.scalars(
            select(Update)
            .where(*conditions)
            # id is a tie-breaker so pagination stays stable for equal timestamps
            .order_by(Update.created_at.desc(), Update.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()

        return list(updates), total