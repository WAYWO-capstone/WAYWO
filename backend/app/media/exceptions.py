"""Domain exceptions for media assets."""

import uuid


class UnsupportedImageError(ValueError):
    """Raised when a profile picture is not a JPEG, PNG, or WebP image."""


class ImageTooLargeError(ValueError):
    """Raised when a profile picture is larger than the allowed size."""


class UploadNotFoundError(Exception):
    """Raised for a missing upload and for another user's upload alike."""

    def __init__(self, upload_id: uuid.UUID):
        super().__init__(f"Upload {upload_id} does not exist")
        self.upload_id = upload_id


class UploadRejectedError(ValueError):
    """Raised when a file breaks its kind's rules.

    The message is shown to the user as is, so it is a full sentence.
    """


class UploadNotReceivedError(Exception):
    """Raised when /complete is called before the file reached storage."""

    def __init__(self, upload_id: uuid.UUID):
        super().__init__(f"Upload {upload_id} has not reached storage")
        self.upload_id = upload_id
