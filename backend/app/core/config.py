import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _build_redis_url() -> str:
    """Build Redis URL from parts if REDIS_URL env var is incomplete."""
    url = os.environ.get("REDIS_URL", "")
    # If the URL looks complete (has a host after @), use it
    if url and "railway.internal" in url:
        return url
    if url and url not in ("redis://", "redis://:") and len(url) > 10:
        return url
    # Fall back to building from parts
    host = os.environ.get("REDIS_HOST", "localhost")
    port = os.environ.get("REDIS_PORT", "6379")
    password = os.environ.get("REDIS_PASSWORD", "")
    if password:
        return f"redis://default:{password}@{host}:{port}"
    return f"redis://{host}:{port}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/artisan"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/artisan"

    # Redis — built dynamically to work around Railway CLI variable encoding
    redis_url: str = ""

    # JWT
    secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    # App
    app_env: str = "development"
    debug: bool = False

    def model_post_init(self, __context) -> None:
        if not self.redis_url or self.redis_url in ("redis://", "redis://:"):
            object.__setattr__(self, "redis_url", _build_redis_url())


settings = Settings()
