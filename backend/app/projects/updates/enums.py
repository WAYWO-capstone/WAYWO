import enum


class UpdateType(str, enum.Enum):
    PROGRESS = "PROGRESS"
    DECISION = "DECISION"
    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"


class UpdateReferenceReason(str, enum.Enum):
    SOLVES = "SOLVES"
    PARTIALLY_SOLVES = "PARTIALLY_SOLVES"
    RELATED_TO = "RELATED_TO"


class UpdateReferenceDisplayReason(str, enum.Enum):
    SOLVES = "SOLVES"
    SOLVED_BY = "SOLVED_BY"
    PARTIALLY_SOLVES = "PARTIALLY_SOLVES"
    PARTIALLY_SOLVED_BY = "PARTIALLY_SOLVED_BY"
    RELATED_TO = "RELATED_TO"


class UpdateSort(str, enum.Enum):
    DATE_ASC = "date_asc"
    DATE_DESC = "date_desc"
