from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.media.dependencies import get_upload_service
from app.media.service import UploadService
from app.projects.project.repository import ProjectRepository
from app.projects.updates.media.dependencies import get_update_media_service
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.service import UpdateService


def get_update_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
    upload_service: Annotated[UploadService, Depends(get_upload_service)],
) -> UpdateService:
    media_service = get_update_media_service(session, upload_service)
    return UpdateService(
        UpdateRepository(session),
        ProjectRepository(session),
        media_service,
    )
