import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["redis"] == "ok"


@pytest.mark.asyncio
async def test_register_creates_tenant_and_user(client: AsyncClient, db: AsyncSession):
    r = await client.post("/api/v1/auth/register", json={
        "email": "maker@test.com",
        "password": "secret123",
        "business_name": "Dharma Ceramics"
    })
    assert r.status_code == 201
    assert "token" in r.json()

    result = await db.execute(
        text("SELECT id FROM tenants WHERE display_name = 'Dharma Ceramics'")
    )
    assert result.fetchone() is not None


@pytest.mark.asyncio
async def test_login_valid(client: AsyncClient, registered_user):
    r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email,
        "password": registered_user.raw_password
    })
    assert r.status_code == 200
    assert "token" in r.json()


@pytest.mark.asyncio
async def test_login_invalid(client: AsyncClient):
    r = await client.post("/api/v1/auth/login", json={
        "email": "nobody@test.com",
        "password": "wrong"
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_requires_auth(client: AsyncClient):
    r = await client.get("/api/v1/products")
    assert r.status_code == 401
