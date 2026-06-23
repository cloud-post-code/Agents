import asyncio
import os
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5434/artisan_test"
os.environ["DATABASE_URL_SYNC"] = "postgresql://postgres:postgres@localhost:5434/artisan_test"
os.environ["REDIS_URL"] = "redis://localhost:6380/0"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["APP_ENV"] = "test"

from app.db.engine import Base  # noqa: E402
from app.main import app  # noqa: E402

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5434/artisan_test"

# Tables to truncate between tests (ordered to respect FK constraints)
TABLES_TO_CLEAN = [
    "notifications", "task_approvals", "calendar_events",
    "agent_messages", "reports", "tasks", "integrations",
    "agent_sessions", "products", "users", "tenants",
]


@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Function-scoped DB session. Truncates all tenant tables before each test."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE notifications, task_approvals, calendar_events, "
                "agent_messages, reports, tasks, integrations, agent_sessions, "
                "stock_adjustments, product_variants, products, brand_dna, users, tenants RESTART IDENTITY CASCADE"
            )
        )
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    import redis.asyncio as aioredis
    from app.db.engine import get_db

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    # Initialize redis in app state for tests (lifespan doesn't run with ASGITransport)
    redis_client = aioredis.from_url(
        os.environ.get("REDIS_URL", "redis://localhost:6380/0"), decode_responses=True
    )
    app.state.redis = redis_client

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", follow_redirects=True) as c:
        yield c

    await redis_client.aclose()
    app.dependency_overrides.clear()


@dataclass
class RegisteredUser:
    email: str
    raw_password: str


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> RegisteredUser:
    email = "fixture@test.com"
    password = "secret123"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "business_name": "Fixture Shop"
    })
    return RegisteredUser(email=email, raw_password=password)


@pytest_asyncio.fixture(scope="function")
async def ws_client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client configured for WebSocket testing via ASGI."""
    import redis.asyncio as aioredis
    from httpx_ws.transport import ASGIWebSocketTransport
    from app.db.engine import get_db

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    redis_client = aioredis.from_url(
        os.environ.get("REDIS_URL", "redis://localhost:6380/0"), decode_responses=True
    )
    app.state.redis = redis_client

    transport = ASGIWebSocketTransport(app=app)
    c = AsyncClient(transport=transport, base_url="http://test")
    await c.__aenter__()
    yield c
    try:
        await c.__aexit__(None, None, None)
    except RuntimeError:
        # anyio cancel scope teardown issue in pytest-asyncio — safe to ignore
        pass
    await redis_client.aclose()
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    """Register a user and return Authorization headers."""
    r = await client.post("/api/v1/auth/register", json={
        "email": "agent-test@test.com",
        "password": "secret123",
        "business_name": "Agent Test Shop",
    })
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def ws_auth_headers(ws_client: AsyncClient) -> dict:
    """Register a user and return Authorization headers for WS tests."""
    r = await ws_client.post("/api/v1/auth/register", json={
        "email": "ws-agent-test@test.com",
        "password": "secret123",
        "business_name": "WS Agent Test Shop",
    })
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers_b(client: AsyncClient) -> dict:
    """Register a second user (tenant B) and return Authorization headers."""
    r = await client.post("/api/v1/auth/register", json={
        "email": "tenant-b@test.com",
        "password": "secret123",
        "business_name": "Tenant B Shop",
    })
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@dataclass
class FakeTenant:
    id: uuid.UUID


@pytest_asyncio.fixture
async def tenant_a(db: AsyncSession) -> FakeTenant:
    tid = uuid.uuid4()
    await db.execute(
        text(
            "INSERT INTO tenants (id, slug, display_name, plan_tier) "
            "VALUES (:id, :slug, :name, 'starter')"
        ),
        {"id": str(tid), "slug": f"tenant-a-{tid}", "name": "Tenant A"},
    )
    await db.commit()
    return FakeTenant(id=tid)


@pytest_asyncio.fixture
async def tenant_b(db: AsyncSession) -> FakeTenant:
    tid = uuid.uuid4()
    await db.execute(
        text(
            "INSERT INTO tenants (id, slug, display_name, plan_tier) "
            "VALUES (:id, :slug, :name, 'starter')"
        ),
        {"id": str(tid), "slug": f"tenant-b-{tid}", "name": "Tenant B"},
    )
    await db.commit()
    return FakeTenant(id=tid)
