"""Notification endpoints."""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.user import User
from app.services import notifications as notif_svc

router = APIRouter(tags=["notifications"])


def _notif_dict(n) -> dict:
    return {
        "id": str(n.id),
        "tenant_id": str(n.tenant_id),
        "type": n.type,
        "payload": n.payload,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/api/v1/notifications")
async def list_notifications(
    unread: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await notif_svc.list_notifications(
        db,
        tenant_id=current_user.tenant_id,
        unread_only=unread,
        page=page,
        page_size=page_size,
    )
    return {"items": [_notif_dict(n) for n in items], "page": page, "page_size": page_size}


@router.post("/api/v1/notifications/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await notif_svc.mark_read(db, notification_id, current_user.tenant_id)
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return _notif_dict(notif)


@router.post("/api/v1/notifications/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await notif_svc.mark_all_read(db, current_user.tenant_id)
    return {"marked_read": count}


@router.get("/api/events/stream")
async def sse_stream(
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events endpoint for real-time notifications."""
    from fastapi import Request

    async def event_generator():
        # Send a heartbeat first
        yield "event: connected\ndata: {}\n\n"
        # Keep connection open with periodic heartbeats
        try:
            while True:
                await asyncio.sleep(30)
                yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
