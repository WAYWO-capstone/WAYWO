"""Business logic for media assets."""

import uuid

import boto3

from app.core.config import settings
from app.media.exceptions import UnsupportedImageError

_IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


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
        return f"{base}/{key}"
