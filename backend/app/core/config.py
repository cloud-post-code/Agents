import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _redis_url() -> str:
    """Build Redis URL — tries multiple Railway env var patterns."""
    # Use REDIS_FULL_URL only if it looks fully expanded (no $ placeholders)
    full = os.environ.get("REDIS_FULL_URL", "")
    if full and len(full) > 15 and "$" not in full:
        return full
    # Build from Railway native plugin individual vars
    host = os.environ.get("REDISHOST") or os.environ.get("REDIS_HOST", "localhost")
    port = os.environ.get("REDISPORT") or os.environ.get("REDIS_PORT", "6379")
    password = os.environ.get("REDISPASSWORD") or os.environ.get("REDIS_PASSWORD", "")
    user = os.environ.get("REDISUSER", "default")
    if password:
        return f"redis://{user}:{password}@{host}:{port}"
    return f"redis://{host}:{port}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/artisan"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/artisan"

    # Redis — built from Railway's native plugin vars, not REDIS_URL (which CLI mangles)
    redis_url: str = ""

    # JWT
    secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    # App
    app_env: str = "development"
    debug: bool = False

    # CORS — comma-separated list of allowed origins, e.g. https://frontend.up.railway.app
    cors_origins: str = ""

    def model_post_init(self, __context) -> None:
        if not self.redis_url or self.redis_url in ("redis://", "redis://:"):
            object.__setattr__(self, "redis_url", _redis_url())


settings = Settings()
