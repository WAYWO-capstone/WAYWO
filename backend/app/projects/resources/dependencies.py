from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.media.dependencies import get_upload_service
from app.media.service import UploadService
from app.projects.project.repository import ProjectRepository
from app.projects.resources.repository import ResourceLinkRepository, ResourceRepository
from app.projects.resources.service import ResourceLinkService, ResourceService


def get_resource_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
    upload_service: Annotated[UploadService, Depends(get_upload_service)],
) -> ResourceService:
    return ResourceService(
        ResourceRepository(session),
        ProjectRepository(session),
        upload_service,
    )


def get_resource_link_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> ResourceLinkService:
    return ResourceLinkService(
        ResourceLinkRepository(session),
        ProjectRepository(session),
    )
