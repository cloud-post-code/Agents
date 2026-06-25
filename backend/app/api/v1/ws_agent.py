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
from app.models.temp_image import TempImage

router = APIRouter(tags=["ws-agent"])

CONTEXT_WINDOW_MESSAGES = 10  # Only load 10 most recent messages initially

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


import logging as _logging
_logger = _logging.getLogger(__name__)


async def _handle_image_upload(
    image_url: str,
    filename: str,
    tenant_id_str: str,
    db: AsyncSession,
    websocket: WebSocket,
    price: float | None = None,
    quantity: int | None = None,
) -> dict:
    """Call vision AI to extract product info, emit a confirm_product card."""
    result = await _extract_single_image(image_url, filename, tenant_id_str, db)

    # Persist the image into temp_images so the frontend can reference it by id
    import re as _re_uri
    data_url = image_url
    image_id: str | None = None
    if image_url.startswith("data:"):
        try:
            header, raw_b64 = image_url.split(",", 1)
            content_type = header.split(";")[0].replace("data:", "") or "image/jpeg"
            temp_image = TempImage(
                tenant_id=uuid.UUID(tenant_id_str),
                image_data=raw_b64,
                content_type=content_type,
            )
            db.add(temp_image)
            await db.commit()
            await db.refresh(temp_image)
            data_url = f"data:{content_type};base64,{raw_b64}"
            image_id = str(temp_image.id)
        except Exception as _exc:
            _logger.warning("[_handle_image_upload] failed to persist TempImage: %s", _exc)

    props: dict = {
        "image_url": data_url,
        "name": result.get("name", ""),
        "description": result.get("description", ""),
        "variants": result.get("variants", []),
    }
    if image_id is not None:
        props["image_id"] = image_id
    if price is not None:
        props["price"] = price
    if quantity is not None:
        props["quantity"] = quantity

    card_payload = {"surface": "confirm_product", "props": props}
    await websocket.send_text(json.dumps({"type": "a2ui", "payload": card_payload}))
    return card_payload


async def _handle_multi_image_upload(
    image_urls: list[str],
    filenames: list[str],
    tenant_id_str: str,
    db: AsyncSession,
    websocket: WebSocket,
    price: float | None = None,
    quantity: int | None = None,
) -> list[dict]:
    """
    Call vision AI on multiple image URLs in parallel, group similar products,
    emit one confirm_product card per grouped product, and return all card payloads.
    """
    try:
        from app.core.config import settings
        from app.services.vision import extract_products_from_image_urls
        api_key = getattr(settings, "openai_api_key", None) or ""
        products = await extract_products_from_image_urls(image_urls, api_key)
    except Exception as exc:
        _logger.error("[multi_image_upload] vision extraction failed: %s", exc)
        # Fallback: one product per image
        products = [
            {
                "name": fn.replace("_", " ").replace("-", " ").rsplit(".", 1)[0].title(),
                "description": "",
                "variants": [],
                "weight_grams_estimate": None,
                "image_urls": [url],
            }
            for fn, url in zip(filenames, image_urls)
        ]

    card_payloads: list[dict] = []
    for product in products:
        first_url = product["image_urls"][0] if product["image_urls"] else (image_urls[0] if image_urls else "")
        props: dict = {
            "image_url": first_url,
            "image_urls": product["image_urls"],
            "name": product.get("name", ""),
            "description": product.get("description", ""),
            "variants": product.get("variants", []),
            "weight_grams_estimate": product.get("weight_grams_estimate"),
        }
        if price is not None:
            props["price"] = price
        if quantity is not None:
            props["quantity"] = quantity
        card_payload = {"surface": "confirm_product", "props": props}
        await websocket.send_text(json.dumps({"type": "a2ui", "payload": card_payload}))
        card_payloads.append(card_payload)

    return card_payloads


async def _extract_single_image(
    image_url: str,
    filename: str,
    tenant_id_str: str,
    db: AsyncSession,
) -> dict:
    """Extract product data from a single image, falling back gracefully."""
    try:
        from app.core.config import settings
        from app.services.vision import extract_product_from_image_url
        api_key = getattr(settings, "openai_api_key", None) or ""
        if api_key:
            return await extract_product_from_image_url(image_url, api_key)
    except Exception:
        pass

    # Secondary fallback: use existing agent tool
    try:
        agent = ArtisanAgent("product_manager")
        result = await agent._execute_tool(
            "ingest_product_from_image",
            {"image_url": image_url, "save": False},
            tenant_id=tenant_id_str,
            user_id=None,
            db=db,
        )
        return result
    except Exception as exc:
        _logger.error("[image_upload] vision extraction failed: %s", exc)
        return {
            "name": filename.replace("_", " ").replace("-", " ").rsplit(".", 1)[0].title(),
            "description": "",
            "variants": [],
        }


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
            # Supports single file_meta OR multiple via files[] array
            files_meta: list[dict] = data.get("files") or []
            if file_meta and file_meta.get("type") == "image":
                files_meta = [file_meta] + [f for f in files_meta if f.get("type") == "image"]
            elif not files_meta:
                files_meta = []
            image_files = [f for f in files_meta if f.get("type") == "image"]

            if image_files:
                image_urls = [f.get("url", "") for f in image_files]
                filenames = [f.get("filename", "image") for f in image_files]
                first_filename = filenames[0]

                # Extract price and quantity from the user's text if provided
                # e.g. "list this for 45 I have 1" → price=45, quantity=1
                extracted_price: float | None = None
                extracted_qty: int | None = None
                if user_content:
                    import re as _re2
                    price_match = _re2.search(
                        r'(?:for|at|price|costs?|selling?|list(?:ing)?\s+(?:it\s+)?(?:for|at))\s*\$?\s*(\d+(?:\.\d+)?)',
                        user_content, _re2.IGNORECASE
                    )
                    if not price_match:
                        price_match = _re2.search(r'\$\s*(\d+(?:\.\d+)?)', user_content)
                    qty_match = _re2.search(
                        r'(?:have|qty|quantity|stock|count|got)\s+(\d+)',
                        user_content, _re2.IGNORECASE
                    )
                    if not qty_match:
                        qty_match = _re2.search(r'(?:i have|have)\s+(\d+)', user_content, _re2.IGNORECASE)
                    if price_match:
                        extracted_price = float(price_match.group(1))
                    if qty_match:
                        extracted_qty = int(qty_match.group(1))

                # Persist user message — include image URLs so frontend renders them
                image_url_list = " ".join(image_urls)
                display_text = f"{user_content}\n{image_url_list}".strip() if user_content else image_url_list
                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="user", content=display_text,
                ))
                await db.commit()

                n = len(image_urls)

                if n == 1:
                    card_payload = await _handle_image_upload(
                        image_urls[0], filenames[0], tenant_id_str, db, websocket,
                        price=extracted_price, quantity=extracted_qty,
                    )
                    # Use AI-extracted name in the ack message
                    product_name = card_payload.get("props", {}).get("name") or "your product"
                    ack = f"Looks like a **{product_name}** — fill in any missing details and hit Save."
                    new_cards = [{"type": "a2ui", "payload": card_payload}]
                else:
                    card_payloads = await _handle_multi_image_upload(
                        image_urls, filenames, tenant_id_str, db, websocket,
                        price=extracted_price, quantity=extracted_qty,
                    )
                    names = [cp.get("props", {}).get("name") for cp in card_payloads if cp.get("props", {}).get("name")]
                    name_list = ", ".join(f"**{n}**" for n in names) if names else f"{len(card_payloads)} items"
                    ack = f"Found {name_list} — fill in any missing details and hit Save."
                    new_cards = [{"type": "a2ui", "payload": cp} for cp in card_payloads]

                await websocket.send_text(json.dumps({"type": "token", "content": ack}))

                card_events.extend(new_cards)

                db.add(AgentMessage(
                    session_id=session_id, tenant_id=tenant_id,
                    role="assistant", content=ack,
                ))
                for card in new_cards:
                    db.add(AgentMessage(
                        session_id=session_id, tenant_id=tenant_id,
                        role="card", content=json.dumps(card),
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
