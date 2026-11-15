from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    datacurrent_env: Literal["development", "test", "production"] = "development"
    datacurrent_log_level: str = "INFO"
    datacurrent_secret_key: SecretStr = Field(
        default=SecretStr("development-only-secret-change-me"), min_length=32
    )
    datacurrent_encryption_key: SecretStr | None = None
    datacurrent_public_url: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://datacurrent:datacurrent@localhost:5432/datacurrent"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-5-mini"
    cors_origins: list[str] = ["http://localhost:3000"]
    request_timeout_seconds: float = 30.0
    query_timeout_ms: int = 15_000
    max_page_size: int = 100
    allow_private_database_hosts: bool = False
    database_host_allowlist: list[str] = ["demo-postgres", "postgres", "localhost"]

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.datacurrent_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
