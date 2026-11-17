import enum


class UploadKind(str, enum.Enum):
    PICTURE = "PICTURE"
    RESOURCE = "RESOURCE"


class UploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    # Reserved for a future job queue.
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"
