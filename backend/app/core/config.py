"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
