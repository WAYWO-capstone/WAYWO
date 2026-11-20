import uuid
from typing import TYPE_CHECKING

from app.media.service import UploadService
from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.project.repository import ProjectRepository
from app.projects.updates.exceptions import UpdateNotFoundError, UpdateNotOwnedError
from app.projects.updates.media.models import UpdateMedia
from app.projects.updates.media.repository import UpdateMediaRepository
from app.projects.updates.media.schemas import UpdateMediaRead
from app.projects.updates.repository import UpdateRepository

if TYPE_CHECKING:
    from app.projects.updates.models import Update


class UpdateMediaService:
    def __init__(
        self,
        repository: UpdateMediaRepository,
        update_repository: UpdateRepository,
        project_repository: ProjectRepository,
        upload_service: UploadService,
    ) -> None:
        self._repo = repository
        self._update_repo = update_repository
        self._project_repo = project_repository
        self._upload_service = upload_service

    def attach_to_update(
        self,
        update: "Update",
        owner_id: uuid.UUID,
        upload_id: uuid.UUID,
    ) -> UpdateMediaRead:
        asset = self._upload_service.claim_attachable_asset(owner_id, upload_id)
        media = UpdateMedia(update_id=update.id, file_asset=asset)
        update.media.append(media)
        media = self._repo.add(media)
        return self._to_read(media)

    def attach(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        owner_id: uuid.UUID,
        upload_id: uuid.UUID,
    ) -> UpdateMediaRead:
        update = self._get_owned_update(project_id, update_id, owner_id)
        return self.attach_to_update(update, owner_id, upload_id)

    def list(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        viewer_id: uuid.UUID | None,
    ) -> list[UpdateMediaRead]:
        update = self._get_visible_update(project_id, update_id, viewer_id)
        return [self._to_read(media) for media in self._repo.list_for_update(update.id)]

    def release_for_update(self, update: "Update") -> None:
        for media in self._repo.list_for_update(update.id):
            media.file_asset.attached = False

    def _get_owned_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> "Update":
        update = self._update_repo.get(update_id)
        if update is None or update.project_id != project_id:
            raise UpdateNotFoundError(update_id)
        if update.author_id != owner_id:
            raise UpdateNotOwnedError(update_id)
        return update

    def _get_visible_update(
        self,
        project_id: uuid.UUID,
        update_id: uuid.UUID,
        viewer_id: uuid.UUID | None,
    ) -> "Update":
        project = self._project_repo.get(project_id)
        if project is None or not (
            project.public or project.author_id == viewer_id
        ):
            raise ProjectNotFoundError(project_id)
        update = self._update_repo.get(update_id)
        if (
            update is None
            or update.project_id != project_id
            or (not update.public and update.author_id != viewer_id)
        ):
            raise UpdateNotFoundError(update_id)
        return update

    @staticmethod
    def _to_read(media: UpdateMedia) -> UpdateMediaRead:
        asset = media.file_asset
        return UpdateMediaRead(
            id=media.id,
            update_id=media.update_id,
            filename=asset.filename,
            mime_type=asset.mime_type,
            size=asset.size_bytes,
            created_at=media.created_at,
        )
