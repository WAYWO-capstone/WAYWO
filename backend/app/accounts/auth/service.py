"""Authentication business logic."""

from app.accounts.auth.exceptions import DuplicateIdentityError
from app.accounts.auth.repository import AuthRepository
from app.accounts.auth.security import hash_password
from app.accounts.users.models import User
from app.accounts.users.repository import UserRepository
from app.accounts.users.schemas import UserCreate


class AuthService:
    """Creates accounts from a registration payload."""

    def __init__(self, users: UserRepository, auth: AuthRepository) -> None:
        self._users = users
        self._auth = auth

    def register(self, payload: UserCreate) -> User:
        """Create a user and store a hashed password."""

        if self._users.get_user_by_email(payload.email) is not None:
            raise DuplicateIdentityError("Email is already registered")
        if self._users.get_user_by_username(payload.username) is not None:
            raise DuplicateIdentityError("Username is already taken")

        user = self._users.add_user(
            User(username=payload.username, email=payload.email)
        )
        self._auth.add_credentials(user.id, hash_password(payload.password))
        return user
