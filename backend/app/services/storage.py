"""Object storage abstraction — Cloudflare R2 in prod, MinIO in dev."""
from __future__ import annotations

import asyncio
import logging
import uuid
from functools import lru_cache

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _ext_for_content_type(content_type: str) -> str:
    mapping = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    return mapping.get(content_type.split(";")[0].strip(), "jpg")


class StorageService:
    def __init__(self) -> None:
        endpoint = settings.storage_endpoint_override or settings.r2_endpoint
        if not endpoint:
            raise RuntimeError(
                "Object storage not configured. "
                "Set R2_ENDPOINT (and R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL) "
                "in your .env, or start MinIO via docker compose and set STORAGE_ENDPOINT_OVERRIDE."
            )
        self._bucket = settings.r2_bucket
        self._public_url = (settings.r2_public_url or endpoint).rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.r2_access_key_id or "minio",
            aws_secret_access_key=settings.r2_secret_access_key or "minio123",
            region_name="auto",
        )

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def upload_image(
        self,
        image_bytes: bytes,
        content_type: str,
        key_prefix: str = "images",
    ) -> str:
        """Upload bytes to storage and return a permanent public URL."""
        ext = _ext_for_content_type(content_type)
        key = f"{key_prefix.rstrip('/')}/{uuid.uuid4()}.{ext}"
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: self._client.put_object(
                    Bucket=self._bucket,
                    Key=key,
                    Body=image_bytes,
                    ContentType=content_type,
                ),
            )
        except (BotoCoreError, ClientError) as exc:
            logger.error("[storage] upload failed key=%s err=%s", key, exc)
            raise RuntimeError(f"Image upload failed: {exc}") from exc

        return f"{self._public_url}/{key}"

    async def delete_object(self, key: str) -> None:
        """Best-effort deletion of an object by key. Never raises."""
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: self._client.delete_object(Bucket=self._bucket, Key=key),
            )
        except Exception as exc:
            logger.warning("[storage] delete failed key=%s err=%s", key, exc)

    def delete_object_sync(self, key: str) -> None:
        """Sync version for Celery workers (not async context)."""
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except Exception as exc:
            logger.warning("[storage] delete_sync failed key=%s err=%s", key, exc)

    def key_from_url(self, url: str) -> str | None:
        """Strip the public URL prefix to get the raw object key."""
        if not url or not url.startswith(self._public_url):
            return None
        return url[len(self._public_url):].lstrip("/")


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    return StorageService()
