"""Domain exceptions for authentication."""


class AuthenticationError(ValueError):
    """Raised when supplied authentication credentials are invalid."""


class DuplicateIdentityError(ValueError):
    """Raised when an email or username is already registered."""
