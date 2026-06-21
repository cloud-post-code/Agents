"""WebSocket endpoint for agent chat streaming."""
from __future__ import annotations

import json
import re as _re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.agents.base import ArtisanAgent
from app.agents.prompts import VALID_ROLES
from app.core.config import settings
from app.core.security import decode_token
from app.models.agent import AgentMessage, AgentSession

router = APIRouter(tags=["ws-agent"])

CONTEXT_WINDOW_MESSAGES = 50

_BASE64_PATTERN = _re.compile(r'data:[^;]+;base64,[A-Za-z0-9+/=]{100,}', _re.DOTALL)


def _strip_base64(s: str) -> str:
    return _BASE64_PATTERN.sub('[image]', s)


def _make_session() -> AsyncSession:
    engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
    from sqlalchemy.ext.asyncio import async_sessionmaker
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


async def _get_or_create_session(db: AsyncSession, tenant_id: uuid.UUID, role: str) -> AgentSession:
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


async def _load_context_window(db: AsyncSession, session_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .where(AgentMessage.role.in_(["user", "assistant"]))
        .order_by(AgentMessage.created_at.desc())
        .limit(CONTEXT_WINDOW_MESSAGES)
    )
    msgs = list(reversed(result.scalars().all()))
    return [{"role": m.role, "content": _strip_base64(m.content or "")} for m in msgs]


async def _handle_image_upload(
    image_url: str,
    filename: str,
    tenant_id_str: str,
    db: AsyncSession,
    websocket: WebSocket,
) -> dict:
    """
    Call vision AI to extract product info from the image, emit a confirm_product card,
    and return the card payload so it can be persisted. Bypasses the LLM entirely.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.agents.base import ArtisanAgent
        agent = ArtisanAgent("product_manager")
        result = await agent._execute_tool(
            "ingest_product_from_image",
            {"image_url": image_url, "save": False},
            tenant_id=tenant_id_str,
            user_id=None,
            db=db,
        )
    except Exception as exc:
        logger.error(f"[image_upload] vision extraction failed: {exc}")
        result = {
            "status": "extracted",
            "name": filename.replace("_", " ").replace("-", " ").rsplit(".", 1)[0].title(),
            "description": "",
            "variants": [],
            "image_url": image_url,
        }

    card_payload = {
        "surface": "confirm_product",
        "props": {
            "image_url": image_url,
            "name": result.get("name", ""),
            "description": result.get("description", ""),
            "variants": result.get("variants", []),
        },
    }

    await websocket.send_text(json.dumps({"type": "a2ui", "payload": card_payload}))
    return card_payload


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

        ag_session = await _get_or_create_session(db, tenant_id, role)
        session_id = ag_session.id

        await websocket.send_text(json.dumps({"type": "session_id", "value": str(session_id)}))

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

            user_content = _strip_base64(data.get("content", ""))
            file_meta = data.get("file")
            card_events: list[dict] = []

            # --- Image upload: bypass LLM, call vision directly ---
            if file_meta and file_meta.get("type") == "image":
                image_url = file_meta.get("url", "")
                filename = file_meta.get("filename", "image")

                # Persist user message (clean display text only)
                display_text = user_content or f"📎 {filename}"
                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="user", content=display_text,
                ))
                await db.commit()

                # Stream a short acknowledgement token
                ack = "Here's what I see — fill in the price and quantity to save it."
                await websocket.send_text(json.dumps({"type": "token", "content": ack}))

                # Call vision AI and emit confirm_product card
                card_payload = await _handle_image_upload(
                    image_url, filename, tenant_id_str, db, websocket
                )
                card_events.append({"type": "a2ui", "payload": card_payload})

                # Persist assistant ack + card
                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="assistant", content=ack,
                ))
                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="card", content=json.dumps({"type": "a2ui", "payload": card_payload}),
                ))
                ag_session.updated_at = datetime.now(timezone.utc)
                db.add(ag_session)
                await db.commit()

                conversation_history.append({"role": "user", "content": display_text})
                conversation_history.append({"role": "assistant", "content": ack})
                if len(conversation_history) > CONTEXT_WINDOW_MESSAGES:
                    conversation_history = conversation_history[-CONTEXT_WINDOW_MESSAGES:]

                await websocket.send_text(json.dumps({"type": "done"}))
                continue

            # --- CSV upload: tell agent about it cleanly ---
            if file_meta and file_meta.get("type") == "csv":
                csv_url = file_meta.get("url", "")
                filename = file_meta.get("filename", "file.csv")
                user_content = f"{user_content}\n[CSV file: {filename} — URL: {csv_url}]".strip()

            # --- Normal text message: run through LLM ---
            db.add(AgentMessage(
                session_id=session_id, tenant_id=tenant_id,
                role="user", content=user_content,
            ))
            await db.commit()

            full_response = ""
            async for event in agent.run(
                user_content, conversation_history,
                tenant_id=tenant_id_str, user_id=user_id, db=db,
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

            db.add(AgentMessage(
                session_id=session_id, tenant_id=tenant_id,
                role="assistant", content=full_response,
            ))
            for card in card_events:
                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="card", content=json.dumps(card),
                ))
            ag_session.updated_at = datetime.now(timezone.utc)
            db.add(ag_session)
            await db.commit()

            conversation_history.append({"role": "user", "content": user_content})
            conversation_history.append({"role": "assistant", "content": full_response})
            if len(conversation_history) > CONTEXT_WINDOW_MESSAGES:
                conversation_history = conversation_history[-CONTEXT_WINDOW_MESSAGES:]

            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        pass
    finally:
        await db.close()
