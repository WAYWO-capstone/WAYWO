import enum


class UpdateType(str, enum.Enum):
    PROGRESS = "PROGRESS"
    DECISION = "DECISION"
    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"


class UpdateSort(str, enum.Enum):
    DATE_ASC = "date_asc"
    DATE_DESC = "date_desc"
