"""Domain exceptions for media assets."""


class UnsupportedImageError(ValueError):
    """Raised when a profile picture is not a JPEG, PNG, or WebP image."""


class ImageTooLargeError(ValueError):
    """Raised when a profile picture is larger than the allowed size."""
