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


def test_user_create_rejects_a_slash_in_the_username() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            username="ada/lovelace",
            email="ada@example.com",
            password="password123",
        )


def test_user_create_rejects_the_username_me() -> None:
    with pytest.raises(ValidationError) as exc:
        UserCreate(
            username="ME",
            email="me@example.com",
            password="password123",
        )

    assert exc.value.errors()[0]["msg"] == "Value error, Username cannot be 'me'"


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
