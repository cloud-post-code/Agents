"""Celery tasks for storage cleanup — expired temp images and orphaned product images."""
from __future__ import annotations

import asyncio
import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task
def cleanup_expired_temp_images():
    """Delete TempImage rows older than 48 hours and their R2/MinIO objects."""
    asyncio.run(_cleanup_temp_images_async())


async def _cleanup_temp_images_async():
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, delete
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.core.config import settings
    from app.models.temp_image import TempImage
    from app.services.storage import get_storage_service

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    engine = create_async_engine(settings.database_url)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            result = await db.execute(
                select(TempImage).where(TempImage.created_at < cutoff)
            )
            expired = result.scalars().all()

            storage = get_storage_service()
            for row in expired:
                if row.image_url:
                    key = storage.key_from_url(row.image_url)
                    if key:
                        await storage.delete_object(key)

            await db.execute(
                delete(TempImage).where(TempImage.created_at < cutoff)
            )
            await db.commit()
            logger.info("[cleanup] deleted %d expired temp images", len(expired))
    finally:
        await engine.dispose()


@celery_app.task
def delete_product_images(product_id: str, image_url: str | None):
    """Delete R2/MinIO objects for a soft-deleted product. Best-effort."""
    if not image_url or not image_url.startswith("http"):
        return
    try:
        from app.services.storage import get_storage_service
        storage = get_storage_service()
        key = storage.key_from_url(image_url)
        if key:
            storage.delete_object_sync(key)
            logger.info("[cleanup] deleted product image key=%s product_id=%s", key, product_id)
    except Exception as exc:
        logger.warning("[cleanup] failed to delete product image product_id=%s err=%s", product_id, exc)
