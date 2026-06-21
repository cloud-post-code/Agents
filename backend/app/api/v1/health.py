from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import text

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    db: str
    redis: str


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    from app.core.config import settings
    import redis.asyncio as aioredis
    from sqlalchemy.ext.asyncio import create_async_engine

    db_status = "ok"
    redis_status = "ok"

    try:
        eng = getattr(request.app.state, "db_engine", None)
        if eng is None:
            eng = create_async_engine(settings.database_url, pool_pre_ping=True)
        async with eng.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        r = getattr(request.app.state, "redis", None)
        if r is None:
            r = aioredis.from_url(settings.redis_url, decode_responses=True)
        await r.ping()
    except Exception:
        redis_status = "error"

    return HealthResponse(status="ok", db=db_status, redis=redis_status)
