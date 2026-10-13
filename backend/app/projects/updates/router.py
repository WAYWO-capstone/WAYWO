import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.projects.project.dependencies import get_current_user_id
from app.projects.project.exceptions import ProjectNotFoundError
from app.projects.updates.dependencies import get_update_service
from app.projects.updates.schemas import UpdateHistoryPage
from app.projects.updates.service import UpdateService

router = APIRouter(tags=["project updates"])


@router.get("/{project_id}/history", response_model=UpdateHistoryPage)
def get_project_history(
    project_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UpdateService, Depends(get_update_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UpdateHistoryPage:
    try:
        updates, total = service.list_project_updates(
            project_id, user_id, limit=limit, offset=offset
        )
    except ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    return UpdateHistoryPage(
        items=updates, total=total, limit=limit, offset=offset
    )