import os
from pydantic_settings import BaseSettings, SettingsConfigDict


def _build_database_url() -> str:
    """
    Build async PostgreSQL URL from Railway's native plugin variables.
    
    Railway provides: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
    Falls back to localhost for local development.
    """
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5433")  # Local dev uses 5433
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "postgres")
    database = os.environ.get("PGDATABASE", "artisan")
    
    # Use asyncpg driver for async SQLAlchemy
    url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    
    # Add SSL for Railway production
    if "railway.app" in host:
        url += "?sslmode=require"
    
    return url


def _build_database_url_sync() -> str:
    """
    Build sync PostgreSQL URL from Railway's native plugin variables.
    Used for Alembic migrations and sync operations.
    """
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5433")
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "postgres")
    database = os.environ.get("PGDATABASE", "artisan")
    
    # Use psycopg2 driver for sync operations
    url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    # Add SSL for Railway production
    if "railway.app" in host:
        url += "?sslmode=require"
    
    return url


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

    # Database - auto-built from Railway variables or local defaults
    database_url: str = _build_database_url()
    database_url_sync: str = _build_database_url_sync()

    # Redis — built from Railway's native plugin vars, not REDIS_URL (which CLI mangles)
    redis_url: str = ""

    # JWT
    secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_days: int = 7

    # App
    app_env: str = "development"
    debug: bool = False

    # AI
    openai_api_key: str = ""

    # CORS — comma-separated list of allowed origins, e.g. https://frontend.up.railway.app
    cors_origins: str = ""

    # Object storage — Cloudflare R2 (prod) or MinIO (dev)
    r2_endpoint: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "artisan-images"
    r2_public_url: str = ""  # https://images.yourdomain.com or https://<bucket>.r2.dev
    storage_endpoint_override: str = ""  # http://localhost:9000 for local MinIO

    def model_post_init(self, __context) -> None:
        if not self.redis_url or self.redis_url in ("redis://", "redis://:"):
            object.__setattr__(self, "redis_url", _redis_url())


settings = Settings()
