"""Task queue service — create, list, approve, reject tasks."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskApproval


async def create_task(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    created_by: Optional[uuid.UUID],
    title: str,
    description: str = "",
    priority: int = 0,
    due_at: Optional[datetime] = None,
) -> Task:
    task = Task(
        tenant_id=tenant_id,
        created_by=created_by,
        title=title,
        description=description,
        status="pending",
        priority=priority,
        due_at=due_at,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(
    db: AsyncSession, task_id: uuid.UUID, tenant_id: Optional[uuid.UUID] = None
) -> Optional[Task]:
    q = select(Task).where(Task.id == task_id)
    if tenant_id:
        q = q.where(Task.tenant_id == tenant_id)
    return await db.scalar(q)


async def list_tasks(
    db: AsyncSession,
    tenant_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> list[Task]:
    q = select(Task).order_by(Task.created_at.desc())
    if tenant_id:
        q = q.where(Task.tenant_id == tenant_id)
    if status:
        q = q.where(Task.status == status)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_approvals(db: AsyncSession, task_id: uuid.UUID) -> list[TaskApproval]:
    result = await db.execute(
        select(TaskApproval)
        .where(TaskApproval.task_id == task_id)
        .order_by(TaskApproval.decided_at)
    )
    return list(result.scalars().all())


async def approve_task(
    db: AsyncSession, task_id: uuid.UUID, tenant_id: Optional[uuid.UUID] = None
) -> Optional[Task]:
    task = await get_task(db, task_id, tenant_id=tenant_id)
    if task is None:
        return None
    task.status = "approved"
    task.updated_at = datetime.now(timezone.utc)
    approval = TaskApproval(
        task_id=task_id,
        action="approved",
        decided_at=datetime.now(timezone.utc),
    )
    db.add(approval)

    # Auto-create calendar event when task has a due date
    if task.due_at:
        from app.models.calendar import CalendarEvent
        event = CalendarEvent(
            tenant_id=task.tenant_id,
            title=task.title,
            starts_at=task.due_at,
            created_by=str(task.created_by) if task.created_by else None,
            related_task_id=task.id,
        )
        db.add(event)

    await db.commit()
    await db.refresh(task)
    return task


async def reject_task(
    db: AsyncSession, task_id: uuid.UUID, reason: str = "", tenant_id: Optional[uuid.UUID] = None
) -> Optional[Task]:
    task = await get_task(db, task_id, tenant_id=tenant_id)
    if task is None:
        return None
    task.status = "rejected"
    task.updated_at = datetime.now(timezone.utc)
    approval = TaskApproval(
        task_id=task_id,
        action="rejected",
        reason=reason,
        decided_at=datetime.now(timezone.utc),
    )
    db.add(approval)
    await db.commit()
    await db.refresh(task)
    return task
