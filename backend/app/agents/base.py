"""Base Artisan agent using LangGraph for structured conversation flow."""
from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.language_models import BaseChatModel

from app.agents.prompts import AGENT_SYSTEM_PROMPTS, VALID_ROLES
from app.agents.tools import SHARED_TOOLS, PRODUCT_MANAGER_TOOLS

logger = logging.getLogger(__name__)


def get_tools_for_role(role: str) -> list:
    if role == "product_manager":
        return PRODUCT_MANAGER_TOOLS
    return SHARED_TOOLS


def get_llm(role: str) -> BaseChatModel:
    """Return LLM instance. Falls back to fake LLM in test/no-key environment."""
    from app.core.config import settings

    api_key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    app_env = settings.app_env
    logger.warning(f"[get_llm] role={role} app_env={app_env} key_prefix={api_key[:7] if api_key else 'MISSING'}")

    if not api_key or api_key.startswith("sk-test") or app_env == "test":
        logger.warning("[get_llm] using FakeChatModel")
        from app.agents.fake_llm import FakeChatModel
        return FakeChatModel()

    logger.warning("[get_llm] using ChatOpenAI gpt-4o-mini")
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", streaming=True, temperature=0.7, api_key=api_key)


@dataclass
class AgentEvent:
    """Discriminated event emitted by ArtisanAgent.run()."""
    type: str  # "token" | "task_created" | "a2ui" | "done"
    content: str = ""
    payload: dict = field(default_factory=dict)


class ArtisanAgent:
    """Streaming agent with real tool execution (create_task, render_ui)."""

    def __init__(self, role: str):
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid agent role: {role}")
        self.role = role
        self.system_prompt = AGENT_SYSTEM_PROMPTS[role]
        self.tools = get_tools_for_role(role)
        self.llm = get_llm(role)

    def _build_tool_map(self) -> dict[str, Any]:
        return {t.name: t for t in self.tools}

    async def run(
        self,
        user_message: str,
        history: list[dict],
        *,
        tenant_id: str | None = None,
        user_id: str | None = None,
        db=None,
    ) -> AsyncIterator[AgentEvent]:
        """Stream AgentEvents for one turn. Executes tool calls against the real DB."""
        from app.agents.fake_llm import FakeChatModel
        is_fake = isinstance(self.llm, FakeChatModel)

        messages = [SystemMessage(content=self.system_prompt)]
        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=user_message))

        tool_map = self._build_tool_map()

        # Bind tools to LLM so it can emit tool_calls (no-op for FakeChatModel)
        llm_with_tools = self.llm.bind_tools(self.tools) if not is_fake else self.llm

        MAX_TOOL_ROUNDS = 5
        for _ in range(MAX_TOOL_ROUNDS):
            # Accumulate the full response for this round
            full_content = ""
            tool_calls: list[dict] = []
            pending_tool_call: dict = {}

            async for chunk in llm_with_tools.astream(messages):
                # Collect text content
                if hasattr(chunk, "content") and chunk.content:
                    full_content += chunk.content
                    yield AgentEvent(type="token", content=chunk.content)

                # Accumulate tool_calls from streaming chunks
                if hasattr(chunk, "tool_call_chunks") and chunk.tool_call_chunks:
                    for tc_chunk in chunk.tool_call_chunks:
                        idx = tc_chunk.get("index", 0)
                        while len(tool_calls) <= idx:
                            tool_calls.append({"id": "", "name": "", "args": ""})
                        if tc_chunk.get("id"):
                            tool_calls[idx]["id"] = tc_chunk["id"]
                        if tc_chunk.get("name"):
                            tool_calls[idx]["name"] = tc_chunk["name"]
                        if tc_chunk.get("args"):
                            tool_calls[idx]["args"] += tc_chunk["args"]

                # Non-streaming tool_calls (some models emit all at once)
                if hasattr(chunk, "tool_calls") and chunk.tool_calls and not tool_calls:
                    for tc in chunk.tool_calls:
                        tool_calls.append({
                            "id": tc.get("id", str(uuid.uuid4())),
                            "name": tc.get("name", ""),
                            "args": json.dumps(tc.get("args", {})) if isinstance(tc.get("args"), dict) else tc.get("args", ""),
                        })

            if not tool_calls:
                # No tool calls — we're done
                break

            # Add assistant message with tool_calls to history
            ai_msg = AIMessage(content=full_content)
            ai_msg.tool_calls = [
                {"id": tc["id"], "name": tc["name"], "args": json.loads(tc["args"]) if tc["args"] else {}}
                for tc in tool_calls
            ]
            messages.append(ai_msg)

            # Execute each tool call
            for tc in tool_calls:
                tool_name = tc["name"]
                try:
                    args = json.loads(tc["args"]) if tc["args"] else {}
                except json.JSONDecodeError:
                    args = {}

                result = await self._execute_tool(
                    tool_name, args, tenant_id=tenant_id, user_id=user_id, db=db
                )

                # Emit typed events for specific tools
                if tool_name == "render_ui":
                    yield AgentEvent(type="a2ui", payload=result)

                tool_result_str = json.dumps(result)
                messages.append(ToolMessage(content=tool_result_str, tool_call_id=tc["id"]))

        yield AgentEvent(type="done")

    async def _execute_tool(
        self,
        tool_name: str,
        args: dict,
        *,
        tenant_id: str | None,
        user_id: str | None,
        db=None,
    ) -> dict:
        """Execute a named tool. create_task is disabled — agents no longer create tasks."""
        if tool_name == "create_task":
            return {
                "error": "create_task is not available. Tasks have been removed from the system.",
                "message": "Please take action directly instead of creating a task.",
            }

        # Product manager tools with real implementations
        if tool_name == "get_product_count" and db is not None and tenant_id:
            from app.services.product_tools import get_product_count_impl
            try:
                return await get_product_count_impl(db=db, tenant_id=uuid.UUID(tenant_id))
            except Exception as exc:
                logger.error(f"[get_product_count] failed: {exc}")
                return {"total_products": 0, "error": str(exc)}

        if tool_name == "get_catalog_summary" and db is not None and tenant_id:
            from app.services.product_tools import get_catalog_summary_impl
            try:
                return await get_catalog_summary_impl(db=db, tenant_id=uuid.UUID(tenant_id))
            except Exception as exc:
                logger.error(f"[get_catalog_summary] failed: {exc}")
                return {"error": str(exc)}

        if tool_name == "search_catalog" and db is not None and tenant_id:
            from app.services.product_tools import search_catalog_impl
            try:
                return await search_catalog_impl(
                    db=db,
                    tenant_id=uuid.UUID(tenant_id),
                    query=args.get("query", ""),
                    limit=args.get("limit", 10),
                )
            except Exception as exc:
                logger.error(f"[search_catalog] failed: {exc}")
                return {"error": str(exc)}

        if tool_name == "ingest_product_from_image" and db is not None and tenant_id:
            try:
                from app.models.product import Product
                from sqlalchemy import select as sa_select

                # Accept either image_url (preferred — from file upload) or image_base64
                image_url = args.get("image_url") or args.get("image_base64", "")
                name = args.get("name") or args.get("product_name") or "Unnamed Product"
                description = args.get("description", "")
                price = args.get("price")
                stock_qty = args.get("quantity") or args.get("stock_qty") or 0
                sku = args.get("sku") or args.get("unique_id") or None

                # If name looks like a base64 blob, use a default
                if len(name) > 200:
                    name = "Imported Product"

                product = Product(
                    tenant_id=uuid.UUID(tenant_id),
                    name=name,
                    description=description,
                    price=float(price) if price else None,
                    stock_qty=int(stock_qty),
                    sku=sku,
                    image_url=image_url if image_url.startswith("http") else None,
                )
                db.add(product)
                await db.commit()
                await db.refresh(product)
                return {
                    "status": "success",
                    "product_id": str(product.id),
                    "name": product.name,
                    "price": float(product.price) if product.price else None,
                    "stock_qty": product.stock_qty,
                    "message": f"Added '{product.name}' to your catalog.",
                }
            except Exception as exc:
                logger.error(f"[ingest_product_from_image] failed: {exc}")
                return {"status": "error", "error": str(exc)}

        if tool_name == "render_ui":
            return {
                "surface": args.get("component", args.get("surface", "unknown")),
                "components": args.get("components", args.get("props", {}).get("components", [])),
                "props": args.get("props", {}),
            }

        # Fall back to the LangChain tool's built-in invoke for other tools
        tool_map = self._build_tool_map()
        if tool_name in tool_map:
            try:
                result = tool_map[tool_name].invoke(args)
                return result if isinstance(result, dict) else {"result": result}
            except Exception as exc:
                logger.error(f"[{tool_name}] tool invoke failed: {exc}")
                return {"error": str(exc)}

        return {"error": f"Unknown tool: {tool_name}"}

    # Keep backward-compat stream() for existing tests that don't need tool events
    async def stream(self, user_message: str, history: list[dict]) -> AsyncIterator[str]:
        """Yield raw text tokens only (no tool events). Used by legacy tests."""
        async for event in self.run(user_message, history):
            if event.type == "token":
                yield event.content
