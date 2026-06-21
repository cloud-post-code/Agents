# Proof: Inventory Core

## Primary Proof Command

```bash
pytest backend/tests/test_inventory.py -v
```

## Green State

1. `POST /api/v1/products` creates product scoped to tenant
2. `GET /api/v1/products` returns only tenant's products
3. Stock adjustment: `delta=-3` reduces `stock_qty` by 3 and writes `stock_adjustments` row
4. Stock falling to/below `reorder_point` creates a `low_stock` notification
5. Semantic search: `GET /api/v1/products?search=ceramic bowl` returns relevant products (pgvector)
6. Soft delete: deleted product not returned in list but retrievable with `?include_deleted=true`
7. PM agent `search_catalog("handmade candles")` returns top matches
8. PM agent `manage_catalog` creates a task for approval before writing
9. Tenant isolation: tenant B cannot read tenant A's products

## Executable Proof File

`backend/tests/test_inventory.py`

```python
import pytest

@pytest.mark.asyncio
async def test_create_and_list_product(client, auth_headers):
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Ceramic Bowl",
        "sku": "CB-001",
        "price": 45.00,
        "cost": 12.00,
        "stock_qty": 20,
        "reorder_point": 5
    })
    assert r.status_code == 201
    product_id = r.json()["id"]

    r2 = await client.get("/api/v1/products", headers=auth_headers)
    ids = [p["id"] for p in r2.json()["items"]]
    assert product_id in ids

@pytest.mark.asyncio
async def test_stock_adjustment(client, auth_headers, product):
    r = await client.post(
        f"/api/v1/products/{product.id}/stock-adjustment",
        headers=auth_headers,
        json={"delta": -3, "reason": "sold"}
    )
    assert r.status_code == 200
    r2 = await client.get(f"/api/v1/products/{product.id}", headers=auth_headers)
    assert r2.json()["stock_qty"] == product.stock_qty - 3

@pytest.mark.asyncio
async def test_low_stock_notification(client, auth_headers, db):
    # Create product at reorder threshold
    r = await client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Low Stock Item", "sku": "LS-001",
        "price": 10.00, "stock_qty": 6, "reorder_point": 5
    })
    product_id = r.json()["id"]
    await client.post(
        f"/api/v1/products/{product_id}/stock-adjustment",
        headers=auth_headers, json={"delta": -2, "reason": "sold"}
    )
    result = await db.execute(
        "SELECT id FROM notifications WHERE type = 'low_stock' AND payload->>'product_id' = :pid",
        {"pid": product_id}
    )
    assert result.fetchone() is not None

@pytest.mark.asyncio
async def test_tenant_product_isolation(client, auth_headers_b, product_tenant_a):
    r = await client.get("/api/v1/products", headers=auth_headers_b)
    ids = [p["id"] for p in r.json()["items"]]
    assert str(product_tenant_a.id) not in ids
```
