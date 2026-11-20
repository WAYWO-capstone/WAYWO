import uuid

from app.media.service import UploadService
from app.projects.project.exceptions import ProjectNotFoundError, ProjectNotOwnedError
from app.projects.project.repository import ProjectRepository
from app.projects.resources.models import ProjectResource
from app.projects.resources.repository import ResourceRepository
from app.projects.resources.schemas import ResourceCreate, ResourceRead


class ResourceService:
    def __init__(
        self,
        repository: ResourceRepository,
        project_repository: ProjectRepository,
        upload_service: UploadService,
    ):
        self._repo = repository
        self._project_repo = project_repository
        self._upload_service = upload_service

    def create(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        data: ResourceCreate,
    ) -> ResourceRead:
        """Attach a verified upload to a project the user owns."""
        project = self._project_repo.get(project_id)
        if project is None:
            raise ProjectNotFoundError(project_id)
        if project.author_id != user_id:
            raise ProjectNotOwnedError(project_id)

        asset = self._upload_service.claim_attachable_asset(user_id, data.upload_id)
        resource = self._repo.add(
            ProjectResource(
                project_id=project_id,
                file_asset=asset,
                title=data.title or asset.filename,
                description="",
            )
        )
        return self._to_read(resource)

    def list(
        self, project_id: uuid.UUID, viewer_id: uuid.UUID | None
    ) -> list[ResourceRead]:
        """A project's resources, with the same visibility rule as its updates.

        A project the viewer may not see is reported as not found, so its
        existence isn't leaked.
        """
        project = self._project_repo.get(project_id)
        if project is None or not (
            project.public or project.author_id == viewer_id
        ):
            raise ProjectNotFoundError(project_id)
        return [self._to_read(resource) for resource in self._repo.list_for_project(project_id)]

    @staticmethod
    def _to_read(resource: ProjectResource) -> ResourceRead:
        asset = resource.file_asset
        return ResourceRead(
            id=resource.id,
            project_id=resource.project_id,
            title=resource.title,
            description=resource.description,
            created_at=resource.created_at,
            filename=asset.filename,
            mime_type=asset.mime_type,
            size=asset.size_bytes,
        )
