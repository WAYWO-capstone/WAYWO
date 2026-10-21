from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.projects.project.repository import ProjectRepository
from app.projects.updates.repository import UpdateRepository
from app.projects.updates.service import UpdateService


def get_update_service(
    session: Annotated[Session, Depends(get_session)],
) -> UpdateService:
    return UpdateService(
        UpdateRepository(session),
        ProjectRepository(session),
    )
