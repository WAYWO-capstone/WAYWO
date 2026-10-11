"""Data access for authentication credentials and refresh sessions."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.auth.models import UserCredential


class AuthRepository:
    """Data access for password credentials."""

    def __init__(self, session: Session):
        self._session = session

    def get_credentials(self, user_id: uuid.UUID) -> UserCredential | None:
        return self._session.get(UserCredential, user_id)

    def add_credentials(
        self,
        user_id: uuid.UUID,
        password_hash: str,
    ) -> UserCredential:
        credentials = UserCredential(user_id=user_id, password_hash=password_hash)
        self._session.add(credentials)
        self._session.flush()
        return credentials
