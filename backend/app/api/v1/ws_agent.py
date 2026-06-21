"""WebSocket endpoint for agent chat streaming."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.agents.base import ArtisanAgent
from app.agents.prompts import VALID_ROLES
from app.core.config import settings
from app.core.security import decode_token
from app.models.agent import AgentMessage, AgentSession

router = APIRouter(tags=["ws-agent"])

# Number of recent messages loaded into the LLM context window
CONTEXT_WINDOW_MESSAGES = 50


def _make_session() -> AsyncSession:
    engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    return factory()


async def _authenticate_ws(websocket: WebSocket) -> Optional[dict]:
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        return decode_token(token)
    except JWTError:
        return None


async def _get_or_create_session(
    db: AsyncSession, tenant_id: uuid.UUID, role: str
) -> AgentSession:
    """Return the single persistent session for this (tenant, role), creating it if needed."""
    result = await db.execute(
        select(AgentSession).where(
            AgentSession.tenant_id == tenant_id,
            AgentSession.agent_role == role,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        session = AgentSession(
            tenant_id=tenant_id,
            agent_role=role,
            title=f"{role.replace('_', ' ').title()} thread",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


async def _load_context_window(
    db: AsyncSession, session_id: uuid.UUID
) -> list[dict]:
    """Load the last CONTEXT_WINDOW_MESSAGES messages, oldest-first, for LLM context."""
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.created_at.desc())
        .limit(CONTEXT_WINDOW_MESSAGES)
    )
    msgs = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": m.content or ""} for m in msgs]


@router.websocket("/ws/agent/{role}/chat")
async def agent_chat(websocket: WebSocket, role: str):
    if role not in VALID_ROLES:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    payload = await _authenticate_ws(websocket)
    if not payload:
        try:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            if data.get("type") == "auth" and data.get("token"):
                try:
                    payload = decode_token(data["token"])
                except JWTError:
                    payload = None
        except Exception:
            payload = None

    if not payload:
        await websocket.send_text(json.dumps({"type": "error", "message": "Unauthorized"}))
        await websocket.close(code=4001)
        return

    tenant_id_str = payload.get("tenant_id")
    user_id = payload.get("sub")
    tenant_id = uuid.UUID(tenant_id_str)

    db: AsyncSession = _make_session()

    try:
        await db.execute(text(f"SET app.tenant_id = '{tenant_id_str}'"))

        # Get or create the ONE persistent session for this (tenant, role)
        ag_session = await _get_or_create_session(db, tenant_id, role)
        session_id = ag_session.id

        # Tell the frontend which session is active
        await websocket.send_text(json.dumps({"type": "session_id", "value": str(session_id)}))

        # Load sliding context window for LLM
        conversation_history = await _load_context_window(db, session_id)

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

            # If a file was attached, build a clear prompt the agent can act on directly
            file_meta = data.get("file")
            if file_meta:
                file_url = file_meta.get("url", "")
                file_type = file_meta.get("type", "file")
                filename = file_meta.get("filename", "")
                if file_type == "image":
                    user_content = (
                        f"{user_content}\n\n"
                        f"[Image uploaded: {filename}]\n"
                        f"Image URL: {file_url}\n"
                        f"Call ingest_product_from_image with image_url='{file_url}'. "
                        f"Ask the user for price, quantity, and unique_id before calling the tool."
                    )
                elif file_type == "csv":
                    user_content = (
                        f"{user_content}\n\n"
                        f"[CSV uploaded: {filename}]\n"
                        f"File URL: {file_url}\n"
                        f"Call ingest_products_from_csv with csv_url='{file_url}'."
                    )

            # Persist user message
            user_msg = AgentMessage(
                session_id=session_id,
                tenant_id=tenant_id,
                role="user",
                content=user_content,
            )
            db.add(user_msg)
            await db.commit()

            # Stream agent events
            full_response = ""
            card_events: list[dict] = []  # task_created / a2ui events to persist
            async for event in agent.run(
                user_content,
                conversation_history,
                tenant_id=tenant_id_str,
                user_id=user_id,
                db=db,
            ):
                if event.type == "token":
                    full_response += event.content
                    await websocket.send_text(json.dumps({"type": "token", "content": event.content}))
                elif event.type == "task_created":
                    await websocket.send_text(json.dumps({"type": "task_created", "payload": event.payload}))
                    card_events.append({"type": "task_created", "payload": event.payload})
                elif event.type == "a2ui":
                    await websocket.send_text(json.dumps({"type": "a2ui", "payload": event.payload}))
                    card_events.append({"type": "a2ui", "payload": event.payload})

            # Persist assistant text message
            asst_msg = AgentMessage(
                session_id=session_id,
                tenant_id=tenant_id,
                role="assistant",
                content=full_response,
            )
            db.add(asst_msg)

            # Persist each card event as its own message row so history reloads them
            for card in card_events:
                card_msg = AgentMessage(
                    session_id=session_id,
                    tenant_id=tenant_id,
                    role="card",
                    content=json.dumps(card),
                )
                db.add(card_msg)

            # Touch updated_at on the session so recency is trackable
            ag_session.updated_at = datetime.now(timezone.utc)
            db.add(ag_session)
            await db.commit()

            # Update in-memory sliding window
            conversation_history.append({"role": "user", "content": user_content})
            conversation_history.append({"role": "assistant", "content": full_response})
            if len(conversation_history) > CONTEXT_WINDOW_MESSAGES:
                conversation_history = conversation_history[-CONTEXT_WINDOW_MESSAGES:]

            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        pass
    finally:
        await db.close()
