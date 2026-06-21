"""Task queue API endpoints."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.user import User
from app.services import tasks as task_svc

router = APIRouter(prefix="/tasks", tags=["tasks"])


class ApprovalRequest(BaseModel):
    reason: str = ""


def _task_dict(task, approvals=None) -> dict:
    return {
        "id": str(task.id),
        "tenant_id": str(task.tenant_id),
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "approvals": [
            {
                "id": str(a.id),
                "action": a.action,
                "reason": a.reason,
                "decided_at": a.decided_at.isoformat() if a.decided_at else None,
            }
            for a in (approvals or [])
        ],
    }


async def _set_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Set the RLS tenant context on this DB session."""
    await db.execute(text(f"SET app.tenant_id = '{tenant_id}'"))


@router.get("")
async def list_tasks(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _set_tenant(db, current_user.tenant_id)
    tasks = await task_svc.list_tasks(db, tenant_id=current_user.tenant_id, status=status, page=page, page_size=page_size)
    return {"tasks": [_task_dict(t) for t in tasks], "page": page, "page_size": page_size}


@router.get("/{task_id}")
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _set_tenant(db, current_user.tenant_id)
    task = await task_svc.get_task(db, task_id, tenant_id=current_user.tenant_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    approvals = await task_svc.get_approvals(db, task_id)
    return _task_dict(task, approvals)


@router.post("/{task_id}/approve")
async def approve_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _set_tenant(db, current_user.tenant_id)
    task = await task_svc.approve_task(db, task_id, tenant_id=current_user.tenant_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    approvals = await task_svc.get_approvals(db, task_id)
    return _task_dict(task, approvals)


@router.post("/{task_id}/reject")
async def reject_task(
    task_id: uuid.UUID,
    body: ApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _set_tenant(db, current_user.tenant_id)
    task = await task_svc.reject_task(db, task_id, reason=body.reason, tenant_id=current_user.tenant_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    approvals = await task_svc.get_approvals(db, task_id)
    return _task_dict(task, approvals)
