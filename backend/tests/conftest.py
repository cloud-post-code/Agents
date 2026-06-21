import asyncio
import os
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


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.db.engine import get_db

    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", follow_redirects=True) as c:
        yield c

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
