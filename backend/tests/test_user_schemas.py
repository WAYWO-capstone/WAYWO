import pytest
from pydantic import ValidationError

from app.accounts.users.schemas import UserCreate


def test_user_create_normalizes_valid_email() -> None:
    user = UserCreate(
        username="  test-user  ",
        email="  Test.User@example.com  ",
        password="password123",
    )

    assert user.username == "test-user"
    assert user.email == "test.user@example.com"


def test_user_create_rejects_invalid_email() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            username="test-user",
            email="hebdjhwje",
            password="password123",
        )


def test_user_create_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            username="test-user",
            email="test@example.com",
            password="password123",
            private_account=True,
        )
