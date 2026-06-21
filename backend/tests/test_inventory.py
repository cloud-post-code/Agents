"""Feature 10: Inventory Core proof tests."""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_and_list_product(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Ceramic Bowl",
        "sku": "CB-001",
        "price": 45.00,
        "cost": 12.00,
        "stock_qty": 20,
        "reorder_point": 5,
    })
    assert r.status_code == 201
    product_id = r.json()["id"]

    r2 = await client.get("/api/v1/products", headers=auth_headers)
    assert r2.status_code == 200
    ids = [p["id"] for p in r2.json()["items"]]
    assert product_id in ids


@pytest.mark.asyncio
async def test_stock_adjustment_updates_qty(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Candle", "sku": "CND-001", "price": 15.00, "stock_qty": 10, "reorder_point": 3,
    })
    product_id = r.json()["id"]
    initial_qty = r.json()["stock_qty"]

    r2 = await client.post(
        f"/api/v1/products/{product_id}/stock-adjustment",
        headers=auth_headers,
        json={"delta": -3, "reason": "sold"},
    )
    assert r2.status_code == 200
    assert r2.json()["stock_qty"] == initial_qty - 3


@pytest.mark.asyncio
async def test_low_stock_notification(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Low Stock Item", "sku": "LS-001", "price": 10.00, "stock_qty": 6, "reorder_point": 5,
    })
    product_id = r.json()["id"]

    await client.post(
        f"/api/v1/products/{product_id}/stock-adjustment",
        headers=auth_headers,
        json={"delta": -2, "reason": "sold"},
    )

    result = await db.execute(
        text("SELECT id FROM notifications WHERE type = 'low_stock' AND payload->>'product_id' = :pid"),
        {"pid": product_id},
    )
    assert result.fetchone() is not None


@pytest.mark.asyncio
async def test_soft_delete_excludes_from_list(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "To Delete", "sku": "DEL-001", "price": 5.00, "stock_qty": 2,
    })
    product_id = r.json()["id"]

    r2 = await client.delete(f"/api/v1/products/{product_id}", headers=auth_headers)
    assert r2.status_code == 204

    r3 = await client.get("/api/v1/products", headers=auth_headers)
    ids = [p["id"] for p in r3.json()["items"]]
    assert product_id not in ids

    r4 = await client.get(f"/api/v1/products/{product_id}?include_deleted=true", headers=auth_headers)
    assert r4.status_code == 200


@pytest.mark.asyncio
async def test_add_variant(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "T-Shirt", "sku": "TS-001", "price": 25.00, "stock_qty": 50,
    })
    product_id = r.json()["id"]

    r2 = await client.post(
        f"/api/v1/products/{product_id}/variants",
        headers=auth_headers,
        json={"name": "Small", "sku": "TS-001-S", "stock_qty": 20},
    )
    assert r2.status_code == 201
    assert r2.json()["name"] == "Small"

    r3 = await client.get(f"/api/v1/products/{product_id}", headers=auth_headers)
    assert len(r3.json()["variants"]) == 1


@pytest.mark.asyncio
async def test_tenant_product_isolation(
    client: AsyncClient, auth_headers: dict, auth_headers_b: dict
):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Tenant A Product", "price": 10.00, "stock_qty": 5,
    })
    product_id = r.json()["id"]

    r2 = await client.get("/api/v1/products", headers=auth_headers_b)
    ids = [p["id"] for p in r2.json()["items"]]
    assert product_id not in ids

    r3 = await client.get(f"/api/v1/products/{product_id}", headers=auth_headers_b)
    assert r3.status_code == 404
