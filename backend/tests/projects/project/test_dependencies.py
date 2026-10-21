import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.accounts.auth.exceptions import InvalidTokenError
from app.projects.project import dependencies
from app.projects.project.dependencies import get_optional_current_user_id


def _credentials(token: str = "token") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture
def auth_service(monkeypatch) -> MagicMock:
    service = MagicMock()
    monkeypatch.setattr(dependencies, "AuthService", lambda *_args: service)
    return service


def test_no_token_means_anonymous_viewer(auth_service):
    assert get_optional_current_user_id(None, MagicMock()) is None
    auth_service.get_user_from_access_token.assert_not_called()


def test_valid_token_returns_the_user_id(auth_service):
    user_id = uuid.uuid4()
    auth_service.get_user_from_access_token.return_value = MagicMock(id=user_id)

    assert get_optional_current_user_id(_credentials(), MagicMock()) == user_id


def test_invalid_or_expired_token_is_treated_as_anonymous(auth_service):
    auth_service.get_user_from_access_token.side_effect = InvalidTokenError()

    assert get_optional_current_user_id(_credentials(), MagicMock()) is None
