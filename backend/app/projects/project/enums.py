import enum

class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    # A published project its owner has hidden. Unlike a draft it keeps its
    # publication history and can be restored to ACTIVE or COMPLETED.
    ARCHIVED = "ARCHIVED"


# Statuses a project can only reach by being published first.
PUBLISHED_STATUSES = (ProjectStatus.ACTIVE, ProjectStatus.COMPLETED)
