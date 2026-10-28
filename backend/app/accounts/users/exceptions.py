"""Domain exceptions for users and profiles."""


class ProfilePictureNotFoundError(ValueError):
    """Raised when the user has no profile picture to delete."""
