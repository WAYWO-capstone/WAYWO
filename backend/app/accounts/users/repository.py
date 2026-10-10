"""Data access for users and profiles."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.users.models import User

class UserRepository:
    """Data access only. Flushes but never commits."""

    def __init__(self, session: Session):
        self._session = session

    def get_user_by_id(self, user_id: str) -> User | None:
        return self._session.get(User, user_id)

    def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self._session.scalar(statement)

    def get_user_by_username(self, username: str) -> User | None:
        statement = select(User).where(User.username == username)
        return self._session.scalar(statement)

    def add_user(self, user: User) -> User:
        self._session.add(user)
        self._session.flush()
        return user   
