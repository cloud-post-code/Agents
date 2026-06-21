"""Celery tasks for Facebook inventory sync."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from app.worker import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_product_to_facebook(self, product_id: str, tenant_id: str, retry_count: int = 0):
    """Sync a single product to Facebook catalog. Retries up to 3 times."""
    asyncio.run(_sync_product_async(self, product_id, tenant_id, retry_count))


async def _sync_product_async(task, product_id: str, tenant_id: str, retry_count: int):
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, text
    from app.core.config import settings
    from app.models.product import Product
    from app.models.integration import Integration
    from app.services.facebook import FacebookCatalogClient

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            await db.execute(text(f"SET app.tenant_id = '{tenant_id}'"))

            product = await db.scalar(
                select(Product).where(Product.id == uuid.UUID(product_id))
            )
            if product is None:
                return

            integration = await db.scalar(
                select(Integration).where(
                    Integration.tenant_id == uuid.UUID(tenant_id),
                    Integration.type == "facebook",
                    Integration.enabled == True,
                )
            )
            if integration is None:
                return

            credentials = integration.credentials or {}
            client = FacebookCatalogClient(
                access_token=credentials.get("access_token", ""),
                catalog_id=credentials.get("catalog_id", ""),
            )

            try:
                result = await client.upsert_product({
                    "retailer_id": str(product.id),
                    "name": product.name,
                    "description": product.description or "",
                    "price": int((product.price or 0) * 100),
                    "currency": "USD",
                    "availability": "in stock" if product.stock_qty > 0 else "out of stock",
                    "condition": "new",
                    "image_url": "",
                    "url": "",
                })

                # Mark synced
                await db.execute(
                    text(
                        "INSERT INTO product_sync_status "
                        "(id, tenant_id, product_id, integration_id, status, last_synced_at, facebook_catalog_item_id) "
                        "VALUES (gen_random_uuid(), :tid, :pid, :iid, 'synced', now(), :fb_id) "
                        "ON CONFLICT (tenant_id, product_id, integration_id) DO UPDATE SET "
                        "status='synced', last_synced_at=now(), facebook_catalog_item_id=:fb_id"
                    ),
                    {
                        "tid": tenant_id,
                        "pid": product_id,
                        "iid": str(integration.id),
                        "fb_id": result.get("id", ""),
                    },
                )
                await db.commit()

            except Exception as exc:
                # Record failure
                new_retry = retry_count + 1
                await db.execute(
                    text(
                        "INSERT INTO integration_sync_errors "
                        "(id, tenant_id, integration_id, product_id, error_code, error_message, retry_count, attempted_at) "
                        "VALUES (gen_random_uuid(), :tid, :iid, :pid, 'api_error', :msg, :rc, now())"
                    ),
                    {
                        "tid": tenant_id,
                        "iid": str(integration.id),
                        "pid": product_id,
                        "msg": str(exc)[:512],
                        "rc": new_retry,
                    },
                )

                if new_retry >= 3:
                    # Final failure — write notification
                    await db.execute(
                        text(
                            "UPDATE product_sync_status SET status='failed' "
                            "WHERE tenant_id=:tid AND product_id=:pid AND integration_id=:iid"
                        ),
                        {"tid": tenant_id, "pid": product_id, "iid": str(integration.id)},
                    )
                    await db.execute(
                        text(
                            "INSERT INTO notifications (id, tenant_id, type, payload) "
                            "VALUES (gen_random_uuid(), :tid, 'sync_error', :payload)"
                        ),
                        {
                            "tid": tenant_id,
                            "payload": json.dumps({
                                "product_id": product_id,
                                "integration_type": "facebook",
                                "error": str(exc)[:256],
                            }),
                        },
                    )
                await db.commit()
                raise
    finally:
        await engine.dispose()
