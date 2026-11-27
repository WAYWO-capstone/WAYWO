import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.projects.updates.media.models import UpdateMedia


class UpdateMediaRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, media: UpdateMedia) -> UpdateMedia:
        self._session.add(media)
        self._session.flush()
        return media

    def get_for_update(
        self,
        update_id: uuid.UUID,
        media_id: uuid.UUID,
    ) -> UpdateMedia | None:
        return self._session.scalars(
            select(UpdateMedia)
            .where(
                UpdateMedia.update_id == update_id,
                UpdateMedia.id == media_id,
            )
            .with_for_update()
        ).one_or_none()

    def list_for_update(self, update_id: uuid.UUID) -> list[UpdateMedia]:
        return list(
            self._session.scalars(
                select(UpdateMedia)
                .where(UpdateMedia.update_id == update_id)
                .order_by(UpdateMedia.created_at.asc(), UpdateMedia.id.asc())
            ).all()
        )
