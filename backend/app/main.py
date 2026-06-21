from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, calendar, health, inventory, notifications, reports, tasks, ws_agent
from app.core.config import settings
from app.db.engine import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    logging.warning(f"REDIS_URL resolved to: {settings.redis_url}")
    app.state.db_engine = engine
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    yield
    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(title="Artisan Platform API", lifespan=lifespan)

_cors_origins = (
    [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if settings.cors_origins
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=bool(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(notifications.router)  # Uses full paths defined in router
app.include_router(ws_agent.router)  # WebSocket routes don't use /api/v1 prefix
