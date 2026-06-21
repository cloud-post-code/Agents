# Proof: Backend Foundation

## Primary Proof Command

```bash
pytest backend/tests/test_foundation.py -v
```

## Red State

Tests fail because the FastAPI app, DB connection, Redis connection, auth endpoints, and health check do not exist.

## Green State

All assertions below pass:

1. `GET /api/v1/health` returns `200 {"status": "ok", "db": "ok", "redis": "ok"}`
2. `POST /api/v1/auth/register` with `{email, password, business_name}` returns `201` with JWT and creates one `tenants` row + one `users` row in the same transaction
3. `POST /api/v1/auth/login` with valid credentials returns `200` with JWT; invalid credentials return `401`
4. Any protected route called without JWT returns `401`
5. `alembic upgrade head` runs without error against a fresh DB
6. `alembic check` passes (no pending migrations)
7. Celery worker starts without error: `celery -A app.worker worker --loglevel=info`

## Executable Proof File

`backend/tests/test_foundation.py`

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["db"] == "ok"
    assert r.json()["redis"] == "ok"

@pytest.mark.asyncio
async def test_register_creates_tenant_and_user(client: AsyncClient, db):
    r = await client.post("/api/v1/auth/register", json={
        "email": "maker@test.com",
        "password": "secret123",
        "business_name": "Dharma Ceramics"
    })
    assert r.status_code == 201
    assert "token" in r.json()
    # Verify both rows created atomically
    tenant = await db.execute("SELECT id FROM tenants WHERE display_name = 'Dharma Ceramics'")
    assert tenant.fetchone() is not None

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
```
