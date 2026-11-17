"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    # Public bucket: profile pictures.
    r2_bucket_name: str
    # Private bucket: project resources, only reachable through signed links.
    r2_private_bucket_name: str
    r2_public_base_url: str

    class Config:
        env_file = ".env"


settings = Settings()
