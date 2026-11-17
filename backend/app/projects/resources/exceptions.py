"""Domain exceptions for project resources."""

import uuid


class ResourceUploadUnavailableError(Exception):
    """The upload can't be attached: not the user's, not a resource,
    not verified yet, or already attached."""

    def __init__(self, upload_id: uuid.UUID):
        super().__init__(f"Upload {upload_id} cannot be attached")
        self.upload_id = upload_id
