"""Business logic for media assets."""

import time
import uuid
from functools import lru_cache
from io import BytesIO

import boto3
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.media.exceptions import UnsupportedImageError

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


class ObjectStorage:
    """Uploads profile pictures to Cloudflare R2."""

    def __init__(self) -> None:
        self._client = boto3.client(
            service_name="s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
        )

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


@lru_cache
def get_object_storage() -> ObjectStorage:
    """Return the shared Cloudflare client."""

    return ObjectStorage()
