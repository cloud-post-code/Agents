"""Notification service — create, list, and mark notifications."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    type: str,
    payload: dict,
    report_id: Optional[uuid.UUID] = None,
) -> Notification:
    notif = Notification(
        tenant_id=tenant_id,
        type=type,
        payload=payload,
        report_id=report_id,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


async def list_notifications(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> list[Notification]:
    q = (
        select(Notification)
        .where(Notification.tenant_id == tenant_id)
        .order_by(Notification.created_at.desc())
    )
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return list(result.scalars().all())


async def mark_read(
    db: AsyncSession, notification_id: uuid.UUID, tenant_id: uuid.UUID
) -> Optional[Notification]:
    notif = await db.scalar(
        select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.tenant_id == tenant_id)
    )
    if notif is None:
        return None
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notif)
    return notif


async def mark_all_read(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Notification)
        .where(Notification.tenant_id == tenant_id)
        .where(Notification.read_at.is_(None))
    )
    notifications = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    for n in notifications:
        n.read_at = now
    await db.commit()
    return len(notifications)
