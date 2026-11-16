"""Upload rules per kind. This is the only place to change what can be uploaded."""

from dataclasses import dataclass

from app.core.config import settings
from app.media.enums import UploadKind

MEGABYTE = 1024 * 1024
OCTET_STREAM = "application/octet-stream"

# Refused for every kind, whatever type the browser declares, because a downloaded
# copy would keep its name and could run or render on the downloader's machine.
BLOCKED_EXTENSIONS = frozenset({".exe", ".html", ".htm", ".js"})


@dataclass(frozen=True)
class UploadKindConfig:
    max_size: int
    allowed_mime: tuple[str, ...]
    # Files allowed only by extension are stored as application/octet-stream,
    # so browsers always download them instead of opening them.
    allowed_extensions: tuple[str, ...]
    storage_prefix: str
    bucket: str


_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")

UPLOAD_KINDS: dict[UploadKind, UploadKindConfig] = {
    UploadKind.PICTURE: UploadKindConfig(
        max_size=5 * MEGABYTE,
        allowed_mime=_IMAGE_TYPES,
        allowed_extensions=(),
        storage_prefix="pictures",
        bucket=settings.r2_bucket_name,
    ),
    UploadKind.RESOURCE: UploadKindConfig(
        max_size=50 * MEGABYTE,
        allowed_mime=(
            "application/pdf",
            "application/zip",
            # What Chrome and Edge on Windows send for .zip files.
            "application/x-zip-compressed",
            *_IMAGE_TYPES,
            "text/plain",
            "text/markdown",
            "video/mp4",
        ),
        allowed_extensions=(
            ".md", ".stl", ".obj", ".3mf", ".step", ".stp", ".f3d", ".dxf",
            ".svg", ".gcode", ".ino", ".kicad_pcb", ".kicad_sch",
        ),
        storage_prefix="resources",
        bucket=settings.r2_private_bucket_name,
    ),
}


def file_extension(filename: str) -> str:
    """Lowercased extension with its dot: "Bracket.STL" gives ".stl".

    Empty for names with no dot, or whose only dot is the first character
    (".env"), the same as the frontend's fileExtension.
    """
    dot = filename.rfind(".")
    return filename[dot:].lower() if dot > 0 else ""


def resolve_mime(
    rules: UploadKindConfig, filename: str, mime_type: str
) -> str | None:
    """The type to store the file with, or None when the file isn't allowed."""
    extension = file_extension(filename)
    if extension in BLOCKED_EXTENSIONS:
        return None
    declared = mime_type.split(";", 1)[0].strip().lower()
    if declared and declared in rules.allowed_mime:
        return declared
    if extension in rules.allowed_extensions:
        return OCTET_STREAM
    return None


def format_megabytes(size: int) -> str:
    """"50 MB", "4.5 MB": the same wording as the frontend's size errors."""
    return f"{round(size / MEGABYTE, 1):g} MB"
