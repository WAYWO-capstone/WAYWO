"""Domain exceptions for social features."""


class SelfFollowError(ValueError):
    """Raised when a user tries to follow themselves."""


class AlreadyFollowingError(ValueError):
    """Raised when the user already follows that creator."""


class FollowNotFoundError(ValueError):
    """Raised when the user is not following that creator."""
