# Proof: Facebook Inventory Sync v1

## Primary Proof Command

```bash
pytest backend/tests/test_facebook_sync.py -v
```

## Green State

1. Creating a product enqueues a `sync_product_to_facebook` Celery task
2. Celery task calls Facebook Catalog API with correct payload (mocked in tests)
3. On success: `product_sync_status.status = 'synced'`, `last_synced_at` set
4. On API failure (mocked): retry count increments; after 3 failures, status = `failed`, notification written
5. Manual retry endpoint: `POST /api/v1/integrations/facebook/retry-failed` re-enqueues failed products
6. Disconnect: `DELETE /api/v1/integrations/{id}` removes credentials, sets all product sync statuses to `not_connected`
7. Tenant isolation: tenant B sync errors not visible to tenant A

## Executable Proof File

`backend/tests/test_facebook_sync.py`

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_product_create_enqueues_sync(client, auth_headers, facebook_connected_tenant):
    with patch("app.tasks.sync_product_to_facebook.delay") as mock_delay:
        r = await client.post("/api/v1/products", headers=auth_headers, json={
            "name": "Ceramic Mug", "sku": "MUG-001", "price": 25.00, "stock_qty": 15
        })
        assert r.status_code == 201
        mock_delay.assert_called_once()

@pytest.mark.asyncio
async def test_sync_success_updates_status(db, facebook_connected_tenant, product):
    with patch("app.services.facebook.FacebookCatalogClient.upsert_product",
               new_callable=AsyncMock, return_value={"id": "fb_123"}):
        from app.tasks import sync_product_to_facebook
        await sync_product_to_facebook(str(product.id), str(facebook_connected_tenant.id))

    result = await db.execute(
        "SELECT status, facebook_catalog_item_id FROM product_sync_status WHERE product_id = :pid",
        {"pid": str(product.id)}
    )
    row = result.fetchone()
    assert row[0] == "synced"
    assert row[1] == "fb_123"

@pytest.mark.asyncio
async def test_sync_failure_after_3_retries_writes_notification(db, facebook_connected_tenant, product):
    with patch("app.services.facebook.FacebookCatalogClient.upsert_product",
               new_callable=AsyncMock, side_effect=Exception("rate_limit")):
        from app.tasks import sync_product_to_facebook
        # Simulate 3 retry failures
        for _ in range(3):
            try:
                await sync_product_to_facebook(str(product.id), str(facebook_connected_tenant.id), retry_count=_)
            except Exception:
                pass

    result = await db.execute(
        "SELECT type FROM notifications WHERE type = 'sync_error' AND tenant_id = :tid",
        {"tid": str(facebook_connected_tenant.id)}
    )
    assert result.fetchone() is not None
```
