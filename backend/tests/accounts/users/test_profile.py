import uuid
from collections.abc import Iterator
from io import BytesIO

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.accounts.users.router import get_profile
from app.accounts.users.service import MAX_PROFILE_PICTURE_BYTES
from app.core.database import SessionLocal, get_session
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    session = SessionLocal()

    def override_get_session() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        session.rollback()
        session.close()
        app.dependency_overrides.clear()


def _account() -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    return {
        "username": f"user-{suffix}",
        "email": f"user-{suffix}@example.com",
        "password": "password123",
    }


def _block_r2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.media.service.boto3.client",
        lambda *args, **kwargs: object(),
    )


def _register_and_login(client: TestClient) -> tuple[dict[str, str], str]:
    account = _account()
    client.post("/auth/register", json=account)
    login = client.post(
        "/auth/login",
        json={"login": account["email"], "password": account["password"]},
    )
    return account, login.json()["access_token"]


def test_get_my_profile_requires_a_token(client: TestClient) -> None:
    response = client.get("/users/me")

    assert response.status_code == 401


def test_get_my_profile_rejects_a_bad_token(client: TestClient) -> None:
    response = client.get("/users/me", headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401


def test_get_my_profile_returns_the_logged_in_user(client: TestClient) -> None:
    account, token = _register_and_login(client)

    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "username": account["username"],
        "bio": None,
        "profile_picture_link": None,
    }


def test_update_my_profile_changes_only_the_sent_field(client: TestClient) -> None:
    account, token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    bio_response = client.patch(
        "/users/me",
        headers=headers,
        json={"bio": "Making a table"},
    )
    picture_response = client.patch(
        "/users/me",
        headers=headers,
        json={"profile_picture_link": "https://example.com/me.png"},
    )

    assert bio_response.status_code == 200
    assert picture_response.status_code == 200
    assert picture_response.json() == {
        "username": account["username"],
        "bio": "Making a table",
        "profile_picture_link": "https://example.com/me.png",
    }


def test_update_my_profile_rejects_account_fields(client: TestClient) -> None:
    _, token = _register_and_login(client)

    response = client.patch(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "someone-else"},
    )

    assert response.status_code == 422


def test_public_profile_does_not_require_a_token(client: TestClient) -> None:
    account, token = _register_and_login(client)
    client.patch(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"bio": "Public bio"},
    )

    response = client.get(f"/users/{account['username']}")

    assert response.status_code == 200
    assert response.json()["username"] == account["username"]
    assert response.json()["bio"] == "Public bio"


def test_upload_profile_picture_saves_the_public_link(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    account, token = _register_and_login(client)
    _block_r2(monkeypatch)

    def fake_upload(self, user_id: uuid.UUID, content: bytes, content_type: str) -> str:
        return "https://photos.example/me.png"

    monkeypatch.setattr(
        "app.accounts.users.router.ObjectStorage.upload_profile_picture",
        fake_upload,
    )

    response = client.post(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("me.png", b"image-bytes", "image/png")},
    )
    public_response = client.get(f"/users/{account['username']}")

    assert response.status_code == 200
    assert response.json()["profile_picture_link"] == "https://photos.example/me.png"
    assert (
        public_response.json()["profile_picture_link"]
        == "https://photos.example/me.png"
    )


def test_upload_profile_picture_requires_a_token(client: TestClient) -> None:
    response = client.post(
        "/users/me/picture",
        files={"file": ("me.png", b"image-bytes", "image/png")},
    )

    assert response.status_code == 401


def test_upload_profile_picture_rejects_a_non_image(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, token = _register_and_login(client)
    _block_r2(monkeypatch)

    response = client.post(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Profile picture must be a JPEG, PNG, or WebP image"
    )


def test_upload_profile_picture_rejects_bytes_that_are_not_an_image(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, token = _register_and_login(client)
    _block_r2(monkeypatch)

    response = client.post(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("me.png", b"not-a-real-image", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Profile picture must be a JPEG, PNG, or WebP image"
    )


def test_upload_profile_picture_accepts_a_real_png(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    account, token = _register_and_login(client)

    class StoredObject:
        def put_object(self, **kwargs: object) -> None:
            return None

        def delete_object(self, **kwargs: object) -> None:
            return None

    monkeypatch.setattr(
        "app.media.service.boto3.client",
        lambda *args, **kwargs: StoredObject(),
    )
    picture = BytesIO()
    Image.new("RGB", (1, 1)).save(picture, format="PNG")

    response = client.post(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("me.png", picture.getvalue(), "image/png")},
    )
    public_response = client.get(f"/users/{account['username']}")

    assert response.status_code == 200
    assert "profile-pictures/" in response.json()["profile_picture_link"]
    assert (
        public_response.json()["profile_picture_link"]
        == response.json()["profile_picture_link"]
    )


def test_upload_profile_picture_rejects_a_file_over_5_mb(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, token = _register_and_login(client)
    _block_r2(monkeypatch)

    response = client.post(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
        files={
            "file": (
                "me.png",
                b"x" * (MAX_PROFILE_PICTURE_BYTES + 1),
                "image/png",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Profile picture must be 5 MB or smaller"


def test_delete_profile_picture_clears_the_link(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    account, token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}
    client.patch(
        "/users/me",
        headers=headers,
        json={
            "bio": "Making a table",
            "profile_picture_link": "https://photos.example/me.png",
        },
    )
    _block_r2(monkeypatch)
    monkeypatch.setattr(
        "app.accounts.users.router.ObjectStorage.delete_profile_picture",
        lambda self, user_id: None,
    )

    response = client.delete("/users/me/picture", headers=headers)
    public_response = client.get(f"/users/{account['username']}")

    assert response.status_code == 204
    assert response.content == b""
    assert public_response.json()["profile_picture_link"] is None
    assert public_response.json()["bio"] == "Making a table"


def test_delete_profile_picture_requires_a_token(client: TestClient) -> None:
    response = client.delete("/users/me/picture")

    assert response.status_code == 401


def test_delete_profile_picture_returns_404_when_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, token = _register_and_login(client)
    _block_r2(monkeypatch)

    response = client.delete(
        "/users/me/picture",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "You do not have a profile picture"


def test_public_profile_rejects_a_slash_in_the_username() -> None:
    session = SessionLocal()
    try:
        with pytest.raises(HTTPException) as exc:
            get_profile("ada/lovelace", session)
    finally:
        session.close()

    assert exc.value.status_code == 400
    assert exc.value.detail == "Username cannot contain '/'"


def test_public_profile_returns_404_for_an_unknown_user(client: TestClient) -> None:
    response = client.get("/users/missing-user")

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
