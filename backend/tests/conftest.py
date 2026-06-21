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
    """Function-scoped session using the pre-migrated test DB."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        # Disable RLS for cleanup — use SET LOCAL to limit to this statement
        await session.execute(text("SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000'"))
        for t in TABLES_TO_CLEAN:
            try:
                await session.execute(text(f"TRUNCATE TABLE {t} RESTART IDENTITY CASCADE"))
            except Exception:
                await session.rollback()
                break
        await session.commit()
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
