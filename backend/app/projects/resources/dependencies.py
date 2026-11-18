from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.media.repository import FileAssetRepository
from app.projects.project.repository import ProjectRepository
from app.projects.resources.repository import ResourceRepository
from app.projects.resources.service import ResourceService


def get_resource_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
) -> ResourceService:
    return ResourceService(
        ResourceRepository(session),
        ProjectRepository(session),
        FileAssetRepository(session),
    )
