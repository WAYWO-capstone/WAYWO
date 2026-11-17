import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.media.dependencies import get_upload_service
from app.media.enums import UploadKind
from app.media.exceptions import (
    UploadNotFoundError,
    UploadNotReceivedError,
    UploadRejectedError,
)
from app.media.kinds import UPLOAD_KINDS
from app.media.schemas import (
    UploadCreate,
    UploadCreated,
    UploadKindConfigRead,
    UploadRead,
)
from app.media.service import UploadService
from app.projects.project.dependencies import get_current_user_id

router = APIRouter(tags=["media"])

_NOT_FOUND = "Upload not found"


# Declared before /uploads/{upload_id}, which would otherwise read "config" as an id.
@router.get("/uploads/config", response_model=dict[UploadKind, UploadKindConfigRead])
def get_upload_config() -> dict[UploadKind, UploadKindConfigRead]:
    """The upload rules per kind, so the browser can check files before sending."""
    return {
        kind: UploadKindConfigRead(
            max_size=rules.max_size,
            allowed_mime=list(rules.allowed_mime),
            allowed_extensions=list(rules.allowed_extensions),
        )
        for kind, rules in UPLOAD_KINDS.items()
    }


@router.post(
    "/uploads",
    response_model=UploadCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_upload(
    payload: UploadCreate,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UploadService, Depends(get_upload_service)],
) -> UploadCreated:
    try:
        return service.create(user_id, payload)
    except UploadRejectedError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/uploads/{upload_id}/complete", response_model=UploadRead)
def complete_upload(
    upload_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UploadService, Depends(get_upload_service)],
) -> UploadRead:
    try:
        return service.complete(user_id, upload_id)
    except UploadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND) from exc
    except UploadNotReceivedError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The file didn't reach storage. Try uploading it again.",
        ) from exc


@router.get("/uploads/{upload_id}", response_model=UploadRead)
def get_upload(
    upload_id: uuid.UUID,
    user_id: Annotated[uuid.UUID, Depends(get_current_user_id)],
    service: Annotated[UploadService, Depends(get_upload_service)],
) -> UploadRead:
    try:
        return service.get(user_id, upload_id)
    except UploadNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND) from exc
