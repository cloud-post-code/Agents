"""Agent chat history endpoint — returns the persistent thread for a role."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.agent import AgentMessage, AgentSession
from app.models.user import User
from app.agents.prompts import VALID_ROLES

router = APIRouter(prefix="/api/v1/agents", tags=["agent-history"])


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class HistoryOut(BaseModel):
    session_id: str
    role: str
    messages: list[MessageOut]


@router.get("/{role}/history", response_model=HistoryOut)
async def get_agent_history(
    role: str,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if role not in VALID_ROLES:
        raise HTTPException(status_code=404, detail="Unknown agent role")

    # Get persistent session (may not exist yet for brand-new users)
    result = await db.execute(
        select(AgentSession).where(
            AgentSession.tenant_id == current_user.tenant_id,
            AgentSession.agent_role == role,
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        return HistoryOut(session_id="", role=role, messages=[])

    # Load last `limit` messages oldest-first for display
    msgs_result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.session_id == session.id)
        .order_by(AgentMessage.created_at.desc())
        .limit(limit)
    )
    messages = list(reversed(msgs_result.scalars().all()))

    return HistoryOut(
        session_id=str(session.id),
        role=role,
        messages=[
            MessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content or "",
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
    )
