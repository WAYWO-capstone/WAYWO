import pytest

from app.media.enums import UploadKind
from app.media.kinds import (
    OCTET_STREAM,
    UPLOAD_KINDS,
    file_extension,
    format_megabytes,
    resolve_mime,
)

RESOURCE = UPLOAD_KINDS[UploadKind.RESOURCE]
PICTURE = UPLOAD_KINDS[UploadKind.PICTURE]


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Bracket.STL", ".stl"),
        ("board.kicad_pcb", ".kicad_pcb"),
        ("archive.tar.gz", ".gz"),
        ("README", ""),
        (".env", ""),
    ],
)
def test_file_extension_matches_the_frontend(filename, expected):
    assert file_extension(filename) == expected


def test_pdf_keeps_its_type():
    assert resolve_mime(RESOURCE, "guide.pdf", "application/pdf") == "application/pdf"


def test_declared_type_is_normalized():
    assert resolve_mime(RESOURCE, "notes.txt", "Text/Plain; charset=utf-8") == "text/plain"


def test_stl_with_empty_type_is_stored_as_octet_stream():
    assert resolve_mime(RESOURCE, "Bracket.STL", "") == OCTET_STREAM


def test_svg_is_stored_as_octet_stream_so_it_never_renders():
    assert resolve_mime(RESOURCE, "logo.svg", "image/svg+xml") == OCTET_STREAM


def test_windows_zip_type_is_allowed():
    assert (
        resolve_mime(RESOURCE, "parts.zip", "application/x-zip-compressed")
        == "application/x-zip-compressed"
    )


@pytest.mark.parametrize(
    ("filename", "mime_type"),
    [
        ("setup.exe", "application/octet-stream"),
        ("unknown.xyz", ""),
        ("setup.exe", "application/pdf"),
        ("page.html", "text/plain"),
        ("script.js", "text/plain"),
    ],
)
def test_disallowed_files_are_rejected(filename, mime_type):
    assert resolve_mime(RESOURCE, filename, mime_type) is None


def test_pictures_are_allowed_by_type_only():
    assert resolve_mime(PICTURE, "me.png", "image/png") == "image/png"
    assert resolve_mime(PICTURE, "me.png", "") is None
    assert resolve_mime(PICTURE, "guide.pdf", "application/pdf") is None


def test_limits_match_the_plan():
    assert RESOURCE.max_size == 50 * 1024 * 1024
    assert PICTURE.max_size == 5 * 1024 * 1024


def test_megabytes_are_worded_like_the_frontend():
    assert format_megabytes(50 * 1024 * 1024) == "50 MB"
    assert format_megabytes(int(4.5 * 1024 * 1024)) == "4.5 MB"
