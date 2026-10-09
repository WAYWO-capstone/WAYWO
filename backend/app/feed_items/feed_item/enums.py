import enum

class FeedItemType(str, enum.Enum):
    PROJECT = "PROJECT"
    UPDATE = "UPDATE"
    TUTORIAL = "TUTORIAL"