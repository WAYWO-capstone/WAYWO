from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.media.repository import FileAssetRepository
from app.media.service import ObjectStorage, UploadService, get_object_storage


def get_upload_service(
    session: Annotated[Session, Depends(get_session, scope="function")],
    storage: Annotated[ObjectStorage, Depends(get_object_storage)],
) -> UploadService:
    return UploadService(FileAssetRepository(session), storage)
