"""Agent message history API with pagination."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.agent import AgentMessage, AgentSession
from app.models.user import User

router = APIRouter(tags=["agent-history"])


@router.get("/agents/{role}/history")
async def get_agent_history_by_role(
    role: str,
    limit: int = Query(30, ge=1, le=200),
    before: Optional[str] = Query(None, description="Load messages older than this message ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return message history for the current user's session for a given agent role.
    Returns the most recent {limit} messages by default (newest-first fetch, reversed for display).
    Use before=<message_id> to paginate backwards (load older messages).

    Shape: { session_id, role, messages: [{id, role, content, created_at}], has_more }
    """
    import re as _re

    session_result = await db.execute(
        select(AgentSession).where(
            AgentSession.tenant_id == current_user.tenant_id,
            AgentSession.agent_role == role,
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        return {"session_id": None, "role": role, "messages": [], "has_more": False}

    base_filter = [
        AgentMessage.session_id == session.id,
        AgentMessage.role.in_(["user", "assistant", "card"]),
    ]

    # Cursor pagination: if before is provided, only fetch messages older than that one
    if before:
        try:
            before_uuid = UUID(before)
            ts_result = await db.execute(
                select(AgentMessage.created_at).where(AgentMessage.id == before_uuid)
            )
            before_ts = ts_result.scalar_one_or_none()
            if before_ts:
                base_filter.append(AgentMessage.created_at < before_ts)
        except Exception:
            pass

    # Fetch newest-first so LIMIT cuts the right end, then reverse for chronological order
    msgs_result = await db.execute(
        select(AgentMessage)
        .where(*base_filter)
        .order_by(AgentMessage.created_at.desc())
        .limit(limit + 1)  # fetch one extra to detect has_more
    )
    rows = msgs_result.scalars().all()
    has_more = len(rows) > limit
    messages = list(reversed(rows[:limit]))

    _base64 = _re.compile(r'data:[^;]+;base64,[A-Za-z0-9+/=]{100,}', _re.DOTALL)
    items = [
        {
            "id": str(m.id),
            "role": m.role,
            "content": _base64.sub("[image]", m.content or ""),
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]

    return {
        "session_id": str(session.id),
        "role": role,
        "messages": items,
        "has_more": has_more,
    }


@router.get("/agent/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=100, description="Number of messages to return"),
    before: Optional[str] = Query(None, description="Return messages before this message ID (for pagination)"),
) -> dict:
    """
    Get paginated message history for an agent session.
    
    Returns the most recent {limit} messages by default.
    Use 'before' parameter to load older messages (scroll back).
    
    Example:
    - GET /agent/sessions/{id}/messages?limit=10
      → Returns 10 most recent messages
    
    - GET /agent/sessions/{id}/messages?limit=10&before={oldest_message_id}
      → Returns 10 messages before that ID (scroll back)
    """
    session_uuid = UUID(session_id)
    
    # Verify session belongs to user's tenant
    session_result = await db.execute(
        select(AgentSession).where(
            AgentSession.id == session_uuid,
            AgentSession.tenant_id == current_user.tenant_id,
        )
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Build query for messages
    query = select(AgentMessage).where(
        AgentMessage.session_id == session_uuid,
        AgentMessage.role.in_(["user", "assistant", "system"])
    )
    
    # Pagination: if 'before' is provided, get messages before that ID
    if before:
        before_uuid = UUID(before)
        # Get the created_at of the 'before' message
        before_result = await db.execute(
            select(AgentMessage.created_at).where(AgentMessage.id == before_uuid)
        )
        before_timestamp = before_result.scalar_one_or_none()
        
        if before_timestamp:
            query = query.where(AgentMessage.created_at < before_timestamp)
    
    # Get total count
    count_query = select(func.count(AgentMessage.id)).where(
        AgentMessage.session_id == session_uuid,
        AgentMessage.role.in_(["user", "assistant", "system"])
    )
    if before:
        if before_timestamp:
            count_query = count_query.where(AgentMessage.created_at < before_timestamp)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get messages (most recent first, then reverse for chronological order)
    query = query.order_by(AgentMessage.created_at.desc()).limit(limit)
    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))
    
    # Format response
    items = []
    for msg in messages:
        # Strip base64 images from content for list view
        content = msg.content or ""
        if len(content) > 1000:
            # Truncate very long messages (like base64 images)
            import re
            base64_pattern = re.compile(r'data:[^;]+;base64,[A-Za-z0-9+/=]{100,}', re.DOTALL)
            content = base64_pattern.sub('[image]', content)
        
        items.append({
            "id": str(msg.id),
            "role": msg.role,
            "content": content,
            "created_at": msg.created_at.isoformat(),
        })
    
    # Check if there are more messages to load
    has_more = total > limit
    
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "has_more": has_more,
        "oldest_id": str(items[0]["id"]) if items else None,  # For next pagination
        "newest_id": str(items[-1]["id"]) if items else None,
    }


@router.get("/agent/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    role: Optional[str] = Query(None, description="Filter by agent role"),
) -> dict:
    """List all agent sessions for the current user's tenant."""
    query = select(AgentSession).where(
        AgentSession.tenant_id == current_user.tenant_id
    )
    
    if role:
        query = query.where(AgentSession.agent_role == role)
    
    query = query.order_by(AgentSession.updated_at.desc())
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    items = []
    for session in sessions:
        # Get message count
        count_result = await db.execute(
            select(func.count(AgentMessage.id)).where(
                AgentMessage.session_id == session.id
            )
        )
        message_count = count_result.scalar() or 0
        
        items.append({
            "id": str(session.id),
            "agent_role": session.agent_role,
            "title": session.title,
            "message_count": message_count,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
        })
    
    return {
        "items": items,
        "total": len(items),
    }
