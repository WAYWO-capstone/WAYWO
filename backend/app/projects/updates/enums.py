import enum

class UpdateType(str, enum.Enum):
    PROGRESS = "PROGRESS"
    DECISION = "DECISION"
    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"