"""Feature 03: Auth — Email/Password proof tests."""
import pytest
from httpx import AsyncClient
from sqlalchemy import text


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, db):
    r = await client.post("/api/v1/auth/register", json={
        "email": "potter@test.com",
        "password": "secret123",
        "business_name": "Clay Works",
    })
    assert r.status_code == 201
    body = r.json()
    assert "token" in body
    assert body["onboarding"] is True


@pytest.mark.asyncio
async def test_register_creates_tenant_and_user(client: AsyncClient, db):
    r = await client.post("/api/v1/auth/register", json={
        "email": "artisan@test.com",
        "password": "secret123",
        "business_name": "Artisan Shop",
    })
    assert r.status_code == 201

    # Verify in DB (superuser bypasses RLS)
    result = await db.execute(text("SELECT COUNT(*) FROM tenants"))
    assert result.scalar() >= 1

    result = await db.execute(text("SELECT role FROM users WHERE email = 'artisan@test.com'"))
    row = result.fetchone()
    assert row is not None
    assert row[0] == "owner"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, registered_user):
    r = await client.post("/api/v1/auth/register", json={
        "email": registered_user.email,
        "password": "anotherpass",
        "business_name": "Other Shop",
    })
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, registered_user):
    r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email,
        "password": registered_user.raw_password,
    })
    assert r.status_code == 200
    assert "token" in r.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, registered_user):
    r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email,
        "password": "wrongpassword",
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_and_tenant(client: AsyncClient, registered_user):
    login_r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email,
        "password": registered_user.raw_password,
    })
    token = login_r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "user" in body and "tenant" in body
    assert body["user"]["role"] == "owner"
    assert body["user"]["email"] == registered_user.email


@pytest.mark.asyncio
async def test_me_without_token_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_token(client: AsyncClient, registered_user):
    login_r = await client.post("/api/v1/auth/login", json={
        "email": registered_user.email,
        "password": registered_user.raw_password,
    })
    token = login_r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Logout
    logout_r = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_r.status_code == 204

    # Same token should now fail
    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unique_slugs_for_same_business_name(client: AsyncClient, db):
    for i in range(2):
        r = await client.post("/api/v1/auth/register", json={
            "email": f"user{i}@test.com",
            "password": "secret123",
            "business_name": "Same Name Shop",
        })
        assert r.status_code == 201

    result = await db.execute(text("SELECT COUNT(DISTINCT slug) FROM tenants WHERE display_name = 'Same Name Shop'"))
    count = result.scalar()
    assert count == 2, f"Expected 2 unique slugs, got {count}"
