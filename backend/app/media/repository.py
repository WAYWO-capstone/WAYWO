"""Data access for media assets."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.media.models import FileAsset


class FileAssetRepository:
    """Only flushes: get_session commits at the end of the request."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, asset: FileAsset) -> FileAsset:
        self._session.add(asset)
        self._session.flush()
        return asset

    def get(self, upload_id: uuid.UUID) -> FileAsset | None:
        return self._session.get(FileAsset, upload_id)

    def get_for_update(self, upload_id: uuid.UUID) -> FileAsset | None:
        """Load the row locked until the transaction ends.

        Stops two requests from completing or attaching the same upload at once.
        """
        return self._session.scalars(
            select(FileAsset)
            .where(FileAsset.id == upload_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).one_or_none()

    def delete(self, asset: FileAsset) -> None:
        self._session.delete(asset)
        self._session.flush()

    def flush(self) -> None:
        self._session.flush()
