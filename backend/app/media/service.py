"""Business logic for media assets."""

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from io import BytesIO
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image, UnidentifiedImageError

from app.core.common import utcnow
from app.core.config import settings
from app.media.enums import UploadKind, UploadStatus
from app.media.exceptions import (
    MediaAttachmentUnavailableError,
    UnsupportedImageError,
    UploadNotFoundError,
    UploadNotReceivedError,
    UploadRejectedError,
)
from app.media.kinds import UPLOAD_KINDS, format_megabytes, resolve_mime
from app.media.models import FileAsset
from app.media.repository import FileAssetRepository
from app.media.schemas import UploadCreate, UploadCreated, UploadRead

# How long a signed upload or download link stays valid.
SIGNED_URL_TTL = timedelta(minutes=15)

_IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
_IMAGE_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def _require_real_image(content: bytes, content_type: str) -> None:
    """Reject bytes that are not the image type named by the content type."""

    try:
        with Image.open(BytesIO(content)) as image:
            if image.format != _IMAGE_FORMATS[content_type]:
                raise UnsupportedImageError(
                    "Profile picture must be a JPEG, PNG, or WebP image"
                )
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise UnsupportedImageError(
            "Profile picture must be a JPEG, PNG, or WebP image"
        ) from exc


@dataclass(frozen=True)
class StoredObject:
    size: int
    content_type: str


class ObjectStorage:
    """Talks to Cloudflare R2: profile pictures and signed upload links."""

    def __init__(self) -> None:
        self._client = boto3.client(
            service_name="s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            # Presigned URLs must use SigV4 for R2.
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, bucket: str, key: str, content_type: str) -> str:
        """A link the browser can PUT one file to, with exactly this Content-Type.

        If-None-Match: * is signed too, so the link only works while nothing is
        stored at the key: a verified file can't be replaced before it expires.
        """

        return self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": key,
                "ContentType": content_type,
                "IfNoneMatch": "*",
            },
            ExpiresIn=int(SIGNED_URL_TTL.total_seconds()),
        )

    def presign_get(self, bucket: str, key: str, filename: str) -> str:
        """A download link that always saves the file under its original name."""

        disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
        return self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket,
                "Key": key,
                "ResponseContentDisposition": disposition,
            },
            ExpiresIn=int(SIGNED_URL_TTL.total_seconds()),
        )

    def head_object(self, bucket: str, key: str) -> StoredObject | None:
        """Size and type of a stored object, or None when it isn't there."""

        try:
            response = self._client.head_object(Bucket=bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        return StoredObject(
            size=response["ContentLength"],
            content_type=response.get("ContentType", ""),
        )

    def delete_object(self, bucket: str, key: str) -> None:
        self._client.delete_object(Bucket=bucket, Key=key)

    def upload_profile_picture(
        self,
        user_id: uuid.UUID,
        content: bytes,
        content_type: str,
    ) -> str:
        """Store a profile picture and return its public link."""

        extension = _IMAGE_EXTENSIONS.get(content_type)
        if extension is None:
            raise UnsupportedImageError(
                "Profile picture must be a JPEG, PNG, or WebP image"
            )
        _require_real_image(content, content_type)
        key = f"profile-pictures/{user_id}.{extension}"
        self._client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        for other in _IMAGE_EXTENSIONS.values():
            if other == extension:
                continue
            self._client.delete_object(
                Bucket=settings.r2_bucket_name,
                Key=f"profile-pictures/{user_id}.{other}",
            )
        base = settings.r2_public_base_url.rstrip("/")
        return f"{base}/{key}?v={int(time.time())}"

    def delete_profile_picture(self, user_id: uuid.UUID) -> None:
        """Remove every stored profile picture for this user."""

        for extension in _IMAGE_EXTENSIONS.values():
            self._client.delete_object(
                Bucket=settings.r2_bucket_name,
                Key=f"profile-pictures/{user_id}.{extension}",
            )


def _bare_type(content_type: str) -> str:
    return content_type.split(";", 1)[0].strip().lower()


class UploadService:
    """Signs uploads, checks what reached R2 and tracks each file's status."""

    def __init__(self, repository: FileAssetRepository, storage: ObjectStorage):
        self._repo = repository
        self._storage = storage

    def create(self, owner_id: uuid.UUID, data: UploadCreate) -> UploadCreated:
        rules = UPLOAD_KINDS[data.kind]
        if data.size > rules.max_size:
            raise UploadRejectedError(
                f"{data.filename} is larger than {format_megabytes(rules.max_size)}."
            )
        mime_type = resolve_mime(rules, data.filename, data.mime_type)
        if mime_type is None:
            raise UploadRejectedError(f"{data.filename} isn't a supported file type.")

        # Built here, never from the file name, so users can't pick or guess keys.
        asset = self._repo.add(
            FileAsset(
                owner_id=owner_id,
                kind=data.kind,
                filename=data.filename,
                mime_type=mime_type,
                size_bytes=data.size,
                storage_key=f"{rules.storage_prefix}/{owner_id}/{uuid.uuid4()}",
                status=UploadStatus.PENDING,
            )
        )
        # Taken before signing, so the link is never reported as living longer than it does.
        expires_at: datetime = utcnow() + SIGNED_URL_TTL
        url = self._storage.presign_put(rules.bucket, asset.storage_key, mime_type)
        return UploadCreated(
            upload_id=asset.id,
            url=url,
            headers={"Content-Type": mime_type, "If-None-Match": "*"},
            expires_at=expires_at,
        )

    def complete(self, owner_id: uuid.UUID, upload_id: uuid.UUID) -> UploadRead:
        """Check the stored file against what was declared.

        A mismatch is returned as FAILED instead of raised: raising would roll
        back the session, and the FAILED status with it.
        """
        asset = self._repo.get_for_update(upload_id)
        if asset is None or asset.owner_id != owner_id:
            raise UploadNotFoundError(upload_id)
        # Repeated calls are harmless: the first one decided the status.
        if asset.status != UploadStatus.PENDING:
            return self._to_read(asset)

        bucket = UPLOAD_KINDS[asset.kind].bucket
        stored = self._storage.head_object(bucket, asset.storage_key)
        if stored is None:
            raise UploadNotReceivedError(upload_id)

        if (
            stored.size != asset.size_bytes
            or _bare_type(stored.content_type) != asset.mime_type
        ):
            self._storage.delete_object(bucket, asset.storage_key)
            asset.status = UploadStatus.FAILED
        else:
            asset.status = UploadStatus.READY
            asset.uploaded_at = utcnow()
        self._repo.flush()
        return self._to_read(asset)

    def get(self, owner_id: uuid.UUID, upload_id: uuid.UUID) -> UploadRead:
        asset = self._repo.get(upload_id)
        if asset is None or asset.owner_id != owner_id:
            raise UploadNotFoundError(upload_id)
        return self._to_read(asset)

    @staticmethod
    def _to_read(asset: FileAsset) -> UploadRead:
        return UploadRead(
            upload_id=asset.id,
            kind=asset.kind,
            filename=asset.filename,
            size=asset.size_bytes,
            status=asset.status,
        )

    def claim_attachable_asset(
        self,
        owner_id: uuid.UUID,
        upload_id: uuid.UUID,
    ) -> FileAsset:
        """Lock and claim a verified resource upload for a project or update."""
        asset = self._repo.get_for_update(upload_id)
        if (
            asset is None
            or asset.owner_id != owner_id
            or asset.kind != UploadKind.RESOURCE
            or asset.status != UploadStatus.READY
            or asset.attached
        ):
            raise MediaAttachmentUnavailableError(upload_id)

        asset.attached = True
        return asset



@lru_cache
def get_object_storage() -> ObjectStorage:
    """Return the shared Cloudflare client."""

    return ObjectStorage()
