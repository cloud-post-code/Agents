"""Feature 09: Standalone Calendar endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.calendar import CalendarEvent
from app.models.user import User

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _event_dict(e: CalendarEvent) -> dict:
    return {
        "id": str(e.id),
        "tenant_id": str(e.tenant_id),
        "title": e.title,
        "description": e.description,
        "starts_at": e.starts_at.isoformat() if e.starts_at else None,
        "ends_at": e.ends_at.isoformat() if e.ends_at else None,
        "all_day": e.all_day,
        "created_by": e.created_by,
        "related_task_id": str(e.related_task_id) if e.related_task_id else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


class CreateEventRequest(BaseModel):
    title: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    all_day: bool = False
    related_task_id: Optional[uuid.UUID] = None


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    all_day: Optional[bool] = None


@router.get("/events")
async def list_events(
    start: str = Query(...),
    end: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end)
    from sqlalchemy import and_
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.tenant_id == current_user.tenant_id,
                CalendarEvent.starts_at >= start_dt,
                CalendarEvent.starts_at <= end_dt,
            )
        ).order_by(CalendarEvent.starts_at)
    )
    events = result.scalars().all()
    return {"events": [_event_dict(e) for e in events]}


@router.post("/events", status_code=201)
async def create_event(
    body: CreateEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = CalendarEvent(
        tenant_id=current_user.tenant_id,
        title=body.title,
        description=body.description,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        all_day=body.all_day,
        related_task_id=body.related_task_id,
        created_by=None,  # human-created
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _event_dict(event)


@router.patch("/events/{event_id}")
async def update_event(
    event_id: uuid.UUID,
    body: UpdateEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.scalar(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.tenant_id == current_user.tenant_id,
        )
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if body.title is not None:
        event.title = body.title
    if body.description is not None:
        event.description = body.description
    if body.starts_at is not None:
        event.starts_at = body.starts_at
    if body.ends_at is not None:
        event.ends_at = body.ends_at
    if body.all_day is not None:
        event.all_day = body.all_day
    await db.commit()
    await db.refresh(event)
    return _event_dict(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.scalar(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.tenant_id == current_user.tenant_id,
        )
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
