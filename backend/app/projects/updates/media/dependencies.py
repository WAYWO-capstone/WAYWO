from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.media.dependencies import get_upload_service
from app.media.service import UploadService
from app.projects.project.repository import ProjectRepository
from app.projects.updates.media.repository import UpdateMediaRepository
from app.projects.updates.media.service import UpdateMediaService
from app.projects.updates.repository import UpdateRepository


def get_update_media_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
    upload_service: Annotated[UploadService, Depends(get_upload_service)],
) -> UpdateMediaService:
    return UpdateMediaService(
        UpdateMediaRepository(session),
        UpdateRepository(session),
        ProjectRepository(session),
        upload_service,
    )
