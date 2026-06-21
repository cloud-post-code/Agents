"""WebSocket endpoint for agent chat streaming."""
from __future__ import annotations

import json
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.agents.base import ArtisanAgent
from app.agents.prompts import VALID_ROLES
from app.core.config import settings
from app.core.security import decode_token
from app.models.agent import AgentMessage, AgentSession

router = APIRouter(tags=["ws-agent"])

def _make_session() -> AsyncSession:
    """Create a fresh session using the currently configured database URL."""
    engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    return factory()


async def _authenticate_ws(websocket: WebSocket) -> Optional[dict]:
    """Extract and verify JWT from query param or header."""
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    try:
        payload = decode_token(token)
        return payload
    except JWTError:
        return None


@router.websocket("/ws/agent/{role}/chat")
async def agent_chat(websocket: WebSocket, role: str):
    if role not in VALID_ROLES:
        await websocket.close(code=4004)
        return

    payload = await _authenticate_ws(websocket)
    if not payload:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    tenant_id = payload.get("tenant_id")
    user_id = payload.get("sub")
    session_id_param = websocket.query_params.get("session_id")

    db: AsyncSession = _make_session()
    session_id: Optional[str] = None
    conversation_history: list[dict] = []

    try:
        await db.execute(text(f"SET app.tenant_id = '{tenant_id}'"))

        # Load or create agent session
        if session_id_param:
            session_id = session_id_param
            # Load history
            result = await db.execute(
                select(AgentMessage)
                .where(AgentMessage.session_id == uuid.UUID(session_id))
                .order_by(AgentMessage.created_at)
            )
            for msg in result.scalars().all():
                conversation_history.append({"role": msg.role, "content": msg.content or ""})

        agent = ArtisanAgent(role)

        while True:
            try:
                raw = await websocket.receive_text()
                data = json.loads(raw)
            except WebSocketDisconnect:
                break
            except Exception:
                break

            if data.get("type") != "message":
                continue

            user_content = data.get("content", "")

            # Create session if first message
            if session_id is None:
                ag_session = AgentSession(
                    tenant_id=uuid.UUID(tenant_id),
                    agent_role=role,
                    title=user_content[:60],
                )
                db.add(ag_session)
                await db.flush()
                session_id = str(ag_session.id)
                await websocket.send_text(json.dumps({"type": "session_id", "value": session_id}))

            # Persist user message
            user_msg = AgentMessage(
                session_id=uuid.UUID(session_id),
                tenant_id=uuid.UUID(tenant_id),
                role="user",
                content=user_content,
            )
            db.add(user_msg)
            await db.commit()

            # Stream response
            full_response = ""
            async for token in agent.stream(user_content, conversation_history):
                full_response += token
                await websocket.send_text(json.dumps({"type": "token", "content": token}))

            # Persist assistant message
            asst_msg = AgentMessage(
                session_id=uuid.UUID(session_id),
                tenant_id=uuid.UUID(tenant_id),
                role="assistant",
                content=full_response,
            )
            db.add(asst_msg)
            await db.commit()

            conversation_history.append({"role": "user", "content": user_content})
            conversation_history.append({"role": "assistant", "content": full_response})

            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        pass
    finally:
        await db.close()
