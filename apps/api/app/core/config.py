from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql+psycopg://disasterblock:disasterblock@db:5432/disasterblock"
    )
    APP_NAME: str = "DisasterBlock API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
