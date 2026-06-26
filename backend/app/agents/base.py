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
from app.agents.tools import SHARED_TOOLS, PRODUCT_MANAGER_TOOLS, MARKETER_TOOLS

logger = logging.getLogger(__name__)


def get_tools_for_role(role: str) -> list:
    if role == "product_manager":
        return PRODUCT_MANAGER_TOOLS
    if role == "marketer":
        return MARKETER_TOOLS
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

        import re as _re_b64
        _b64_pattern = _re_b64.compile(r'data:[^;]+;base64,[A-Za-z0-9+/=\n]{20,}', _re_b64.DOTALL)

        def _clean(text: str) -> str:
            cleaned = _b64_pattern.sub('', text or '').strip()
            # Hard truncate to ~2k tokens per message
            return cleaned[:8000] + '…' if len(cleaned) > 8000 else cleaned

        # Keep only the most recent 30 messages to stay within context limits
        trimmed_history = history[-30:] if len(history) > 30 else history

        messages = [SystemMessage(content=self.system_prompt)]
        for msg in trimmed_history:
            content = _clean(msg["content"])
            if not content:
                continue
            if msg["role"] == "user":
                messages.append(HumanMessage(content=content))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=content))
        messages.append(HumanMessage(content=_clean(user_message) or user_message))

        tool_map = self._build_tool_map()

        # Bind tools to LLM so it can emit tool_calls (no-op for FakeChatModel)
        llm_with_tools = self.llm.bind_tools(self.tools) if not is_fake else self.llm

        MAX_TOOL_ROUNDS = 5
        _emitted_surfaces: set[str] = set()  # deduplicate a2ui surfaces within a turn
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
                    surface_key = str(result.get("surface", ""))
                    if surface_key not in _emitted_surfaces:
                        _emitted_surfaces.add(surface_key)
                        yield AgentEvent(type="a2ui", payload=result)

                # Auto-emit product_list card when search_catalog is called with no query
                # (i.e. "show all products"). The LLM sometimes skips the render_ui call.
                if tool_name == "search_catalog" and not args.get("query", "").strip():
                    pl_surface = result.get("_product_list_surface") if isinstance(result, dict) else None
                    if pl_surface and "error" not in result and "product_list" not in _emitted_surfaces:
                        _emitted_surfaces.add("product_list")
                        yield AgentEvent(type="a2ui", payload=pl_surface)

                # Flier image tools auto-emit their card so the UI appears
                # immediately — the LLM doesn't need to make a separate render_ui call
                if tool_name == "generate_flier_image" and "error" not in result:
                    if "flier_preview" not in _emitted_surfaces:
                        _emitted_surfaces.add("flier_preview")
                        yield AgentEvent(type="a2ui", payload={
                            "surface": "flier_preview",
                            "props": result,
                        })
                if tool_name == "generate_multi_flier_image" and "error" not in result:
                    if "multi_flier_preview" not in _emitted_surfaces:
                        _emitted_surfaces.add("multi_flier_preview")
                        yield AgentEvent(type="a2ui", payload={
                            "surface": "multi_flier_preview",
                            "props": result,
                        })

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
                query_str = args.get("query", "")
                result = await search_catalog_impl(
                    db=db,
                    tenant_id=uuid.UUID(tenant_id),
                    query=query_str,
                    limit=args.get("limit", 10),
                )
                products = result.get("results", result) if isinstance(result, dict) else result
                result_dict = result if isinstance(result, dict) else {"results": result, "count": len(result)}
                count = result_dict.get("count", len(products))

                # Check for exact match — by UUID (direct lookup) or by name
                exact_match = None
                if query_str and products:
                    # If the query was a UUID and we got exactly one result, it's a direct hit
                    try:
                        uuid.UUID(query_str)
                        if count == 1:
                            exact_match = products[0]
                    except ValueError:
                        q_lower = query_str.strip().lower()
                        exact_match = next(
                            (p for p in products if (p.get("name") or "").lower() == q_lower),
                            None
                        )

                # When there is no single exact match and multiple results exist,
                # include a product_picker surface so the agent can ask the user
                # to clarify instead of guessing.
                if not exact_match and count > 1:
                    result_dict["_product_picker_surface"] = {
                        "surface": "product_picker",
                        "props": {
                            "query": query_str,
                            "results": [
                                {
                                    "id": p.get("id"),
                                    "name": p.get("name"),
                                    "sku": p.get("sku"),
                                    "price": p.get("price"),
                                    "stock_qty": p.get("stock_qty"),
                                    "image_url": p.get("image_url"),
                                    "description": p.get("description"),
                                }
                                for p in products[:5]
                            ],
                        },
                    }
                    result_dict["_needs_clarification"] = True
                    result_dict["_instruction"] = (
                        "Multiple products match. "
                        "Call render_ui with the _product_picker_surface props so the user can pick the right one. "
                        "Do NOT guess or proceed with any product until the user selects one."
                    )
                elif exact_match:
                    result_dict["_exact_match"] = exact_match
                    result_dict["_instruction"] = (
                        f"Exact match found: '{exact_match.get('name')}' (id={exact_match.get('id')}). "
                        "Use this product_id directly."
                    )

                # Always include product_list surface as fallback
                result_dict["_product_list_surface"] = {
                    "surface": "product_list",
                    "props": {
                        "products": products,
                        "total": count,
                        "page": 1,
                        "per_page": 10,
                    }
                }
                return result_dict
            except Exception as exc:
                logger.error(f"[search_catalog] failed: {exc}")
                return {"error": str(exc)}

        if tool_name == "ingest_product_from_image" and db is not None and tenant_id:
            try:
                from app.core.config import settings

                image_url = args.get("image_url") or ""
                price = args.get("price")
                stock_qty = args.get("quantity") or args.get("stock_qty") or 0
                sku = args.get("sku") or None
                do_save = args.get("save", False)

                # --- Vision extraction step ---
                api_key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
                extracted_name = "Imported Product"
                extracted_description = ""
                extracted_variants: list[dict] = []

                if image_url and api_key and not api_key.startswith("sk-test"):
                    try:
                        import openai
                        client = openai.AsyncOpenAI(api_key=api_key)
                        vision_resp = await client.chat.completions.create(
                            model="gpt-4o",
                            messages=[
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": (
                                                "You are an e-commerce product expert. "
                                                "Analyze this product image and respond with JSON only "
                                                "(no markdown, no code fences). "
                                                "Return: {\"name\": \"<short product name>\", "
                                                "\"description\": \"<1-2 sentence product description>\", "
                                                "\"variants\": [{\"name\": \"<variant label>\"}]} "
                                                "Include variants only if the image clearly shows multiple "
                                                "size, color, or style options; otherwise use an empty array."
                                            ),
                                        },
                                        {
                                            "type": "image_url",
                                            "image_url": {"url": image_url, "detail": "low"},
                                        },
                                    ],
                                }
                            ],
                            max_tokens=300,
                        )
                        raw = vision_resp.choices[0].message.content or ""
                        vision_data = json.loads(raw)
                        extracted_name = vision_data.get("name", extracted_name)
                        extracted_description = vision_data.get("description", "")
                        extracted_variants = vision_data.get("variants", [])
                    except Exception as vision_exc:
                        logger.warning(f"[ingest_product_from_image] vision extraction failed: {vision_exc}")

                if not do_save:
                    # Return extracted info without saving — agent will show confirm card
                    return {
                        "status": "extracted",
                        "name": extracted_name,
                        "description": extracted_description,
                        "variants": extracted_variants,
                        "image_url": image_url,
                        "message": "Product info extracted. Show confirm_product card to collect price and quantity.",
                    }

                # --- Save step ---
                import base64 as _b64
                from app.models.product import Product
                from app.services.storage import get_storage_service

                # If image_url is a data: URI, decode and upload to R2 first.
                # GPT-4o also can't fetch data: URIs, so this fixes vision extraction too.
                prod_image_url = None
                if image_url:
                    if image_url.startswith("data:"):
                        try:
                            header, b64_data = image_url.split(",", 1)
                            content_type = header.split(";")[0].replace("data:", "") or "image/jpeg"
                        except (ValueError, IndexError):
                            b64_data = image_url
                            content_type = "image/jpeg"
                        image_bytes = _b64.b64decode(b64_data)
                        storage = get_storage_service()
                        prod_image_url = await storage.upload_image(
                            image_bytes, content_type, "images/products"
                        )
                    elif image_url.startswith("http"):
                        prod_image_url = image_url[:1024]

                product = Product(
                    tenant_id=uuid.UUID(tenant_id),
                    name=extracted_name,
                    description=extracted_description,
                    price=float(price) if price else None,
                    stock_qty=int(stock_qty),
                    sku=sku,
                    image_url=prod_image_url,
                    image_data=None,
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

        # Marketer tools
        if tool_name == "get_brand_dna" and db is not None and tenant_id:
            try:
                from sqlalchemy import select
                from app.models.brand import BrandDNA
                result = await db.execute(
                    select(BrandDNA).where(BrandDNA.tenant_id == uuid.UUID(tenant_id))
                )
                brand = result.scalar_one_or_none()

                # Compute completion % (same 8-field formula as the frontend)
                if brand:
                    filled = sum(bool(x) for x in [
                        brand.brand_name, brand.tagline, brand.primary_color,
                        brand.font_family, brand.tone_adjectives,
                        brand.overview, brand.writing_style, brand.logo_url,
                    ])
                    completion_pct = round(filled / 8 * 100)
                else:
                    completion_pct = 0

                # ≥20% counts as "has brand" — enough to write useful copy
                has_brand = completion_pct >= 20

                if not has_brand:
                    return {
                        "has_brand": False,
                        "completion_pct": completion_pct,
                        "status": "no_brand",
                        "instruction": (
                            "STOP. Do not proceed with copy generation. "
                            "The brand profile is less than 20% complete. "
                            "Call render_ui(surface='brand_setup', props={}) so the user can set up their brand. "
                            "Say: 'Before I write anything, I need your brand info — fill this in and I'll tailor everything to your style.'"
                        ),
                    }

                # Build a rich brand context string the agent uses verbatim when writing copy
                tone = ", ".join(brand.tone_adjectives) if brand.tone_adjectives else "warm and authentic"
                lines = [
                    f"Brand name: {brand.brand_name or 'Not set'}",
                    f"Tagline: {brand.tagline}" if brand.tagline else None,
                    f"Overview: {brand.overview}" if brand.overview else None,
                    f"Product category: {brand.product_category}" if brand.product_category else None,
                    f"Target audience: {brand.target_audience}" if brand.target_audience else None,
                    f"Tone: {tone}",
                    f"Writing style: {brand.writing_style}" if brand.writing_style else None,
                    f"Primary color: {brand.primary_color}" if brand.primary_color else None,
                    f"Font: {brand.font_family}" if brand.font_family else None,
                ]
                brand_context = "\n".join(l for l in lines if l)

                return {
                    "has_brand": True,
                    "completion_pct": completion_pct,
                    "brand_name": brand.brand_name,
                    "tagline": brand.tagline,
                    "overview": brand.overview,
                    "product_category": brand.product_category,
                    "target_audience": brand.target_audience,
                    "tone_adjectives": brand.tone_adjectives or [],
                    "writing_style": brand.writing_style,
                    "primary_color": brand.primary_color,
                    "secondary_color": brand.secondary_color,
                    "font_family": brand.font_family,
                    "source": brand.source,
                    "brand_context_for_copy": brand_context,
                    "instruction": (
                        "Brand profile loaded. Use brand_context_for_copy as the voice and style reference "
                        "for ALL copy you write in this response. Match the tone adjectives exactly. "
                        "Write copy as if you ARE this brand."
                    ),
                }
            except Exception as exc:
                logger.error(f"[get_brand_dna] failed: {exc}")
                return {"error": str(exc)}

        if tool_name == "update_product_stock" and db is not None and tenant_id:
            try:
                from app.models.product import Product as _Product
                from sqlalchemy import select as _select
                pid = uuid.UUID(args.get("product_id", ""))
                delta = int(args.get("delta", 0))
                result = await db.execute(
                    _select(_Product).where(
                        _Product.id == pid,
                        _Product.tenant_id == uuid.UUID(tenant_id),
                        _Product.deleted_at.is_(None),
                    )
                )
                product = result.scalar_one_or_none()
                if not product:
                    return {"error": "Product not found"}
                new_qty = max(0, (product.stock_qty or 0) + delta)
                product.stock_qty = new_qty
                await db.commit()
                await db.refresh(product)
                return {
                    "status": "success",
                    "product_id": str(product.id),
                    "product_name": product.name,
                    "stock_qty": new_qty,
                    "delta": delta,
                    "message": f"Stock updated: {product.name} is now {new_qty}.",
                }
            except Exception as exc:
                logger.error(f"[update_product_stock] failed: {exc}")
                return {"error": str(exc)}

        if tool_name in ("generate_social_post", "generate_social_post_batch", "generate_multi_product_post", "generate_flier", "generate_flier_image", "generate_multi_product_flier", "generate_multi_flier_image") and db is not None and tenant_id:
            try:
                import httpx
                from app.core.config import settings as _settings
                api_base = f"http://localhost:{getattr(_settings, 'port', 8000)}"
                # Resolve internally via the service layer directly to avoid HTTP round-trip
                from app.api.v1.marketing import (
                    generate_social_post as _gen_post,
                    generate_social_post_batch as _gen_batch,
                    generate_flier as _gen_flier,
                    SocialPostRequest, SocialPostBatchRequest, FlierRequest,
                    _get_brand, _get_product,
                )
                from app.models.brand import BrandDNA
                from sqlalchemy import select

                brand_result = await db.execute(
                    select(BrandDNA).where(BrandDNA.tenant_id == uuid.UUID(tenant_id))
                )
                brand = brand_result.scalar_one_or_none()

                if tool_name == "generate_social_post":
                    product = await _get_product(args.get("product_id", ""), uuid.UUID(tenant_id), db)
                    from app.api.v1.marketing import _generate_caption, _product_image, _analyze_product_image
                    import os as _os
                    _api_key = _os.environ.get("OPENAI_API_KEY", "")
                    product_img_url = _product_image(product)

                    # Call 1: vision — send product info + photo to GPT-4o in one request
                    image_analysis = ""
                    if product_img_url and _api_key and not _api_key.startswith("sk-test"):
                        image_analysis = await _analyze_product_image(
                            title=product.name,
                            desc=product.description or "",
                            image_url=product_img_url,
                            api_key=_api_key,
                        )

                    # Call 2: caption — use vision output + previous caption for iteration
                    previous_caption = args.get("previous_caption", "")
                    caption = await _generate_caption(
                        title=product.name,
                        desc=product.description or "",
                        platform=args.get("platform", "instagram"),
                        post_type=args.get("post_type", "feed_post"),
                        creative_brief=args.get("creative_brief", ""),
                        brand=brand,
                        image_analysis=image_analysis,
                        previous_caption=previous_caption,
                    )
                    return {
                        "product_id": args.get("product_id"),
                        "product_name": product.name,
                        "product_image_url": product_img_url,
                        "platform": args.get("platform", "instagram"),
                        "post_type": args.get("post_type", "feed_post"),
                        "caption": caption,
                        "brand_name": brand.brand_name if brand else None,
                        "image_analysis": image_analysis,
                        "products": [{
                            "id": str(product.id),
                            "name": product.name,
                            "price": float(product.price) if product.price else None,
                            "image_url": product_img_url,
                            "description": product.description,
                            "sku": product.sku,
                            "stock_qty": product.stock_qty,
                        }],
                    }

                elif tool_name == "generate_social_post_batch":
                    import asyncio
                    import os as _os
                    product = await _get_product(args.get("product_id", ""), uuid.UUID(tenant_id), db)
                    from app.api.v1.marketing import _generate_caption, PLATFORM_LABELS, _product_image, _analyze_product_image
                    platforms = args.get("platforms", ["instagram", "facebook", "tiktok"])
                    product_img_url = _product_image(product)
                    _api_key = _os.environ.get("OPENAI_API_KEY", "")

                    # Call 1: single vision call for the product photo (shared across all platforms)
                    image_analysis = ""
                    if product_img_url and _api_key and not _api_key.startswith("sk-test"):
                        image_analysis = await _analyze_product_image(
                            title=product.name,
                            desc=product.description or "",
                            image_url=product_img_url,
                            api_key=_api_key,
                        )

                    previous_caption = args.get("previous_caption", "")

                    # Call 2: one caption per platform using the shared vision analysis
                    async def _gen(p):
                        cap = await _generate_caption(
                            title=product.name,
                            desc=product.description or "",
                            platform=p,
                            post_type=args.get("post_type", "feed_post"),
                            creative_brief=args.get("creative_brief", ""),
                            brand=brand,
                            image_analysis=image_analysis,
                            previous_caption=previous_caption,
                        )
                        return {"platform": p, "platform_label": PLATFORM_LABELS.get(p, p), "caption": cap}

                    posts = await asyncio.gather(*[_gen(p) for p in platforms])
                    return {
                        "product_id": args.get("product_id"),
                        "product_name": product.name,
                        "product_image_url": product_img_url,
                        "image_analysis": image_analysis,
                        "products": [{
                            "id": str(product.id),
                            "name": product.name,
                            "price": float(product.price) if product.price else None,
                            "image_url": product_img_url,
                            "description": product.description,
                            "sku": product.sku,
                            "stock_qty": product.stock_qty,
                        }],
                        "posts": list(posts),
                    }

                elif tool_name == "generate_multi_product_post":
                    import asyncio as _asyncio
                    from app.api.v1.marketing import _generate_caption, PLATFORM_LABELS, _product_image
                    product_ids = args.get("product_ids", [])
                    platforms = args.get("platforms", ["instagram", "facebook", "tiktok"])
                    post_type = args.get("post_type", "feed_post")
                    creative_brief = args.get("creative_brief", "")

                    products_fetched = []
                    for pid in product_ids:
                        try:
                            p = await _get_product(pid, uuid.UUID(tenant_id), db)
                            products_fetched.append(p)
                        except Exception:
                            pass

                    if not products_fetched:
                        return {"error": "No valid products found for the given IDs"}

                    # Build a combined product description for the LLM
                    combined_title = " & ".join(p.name for p in products_fetched)
                    combined_desc = "\n".join(
                        f"- {p.name}: {p.description or ''}" for p in products_fetched
                    )

                    async def _gen_multi(plat):
                        cap = await _generate_caption(
                            title=combined_title,
                            desc=combined_desc,
                            platform=plat,
                            post_type=post_type,
                            creative_brief=creative_brief or f"Feature all {len(products_fetched)} products together.",
                            brand=brand,
                        )
                        return {"platform": plat, "platform_label": PLATFORM_LABELS.get(plat, plat), "caption": cap}

                    posts = await _asyncio.gather(*[_gen_multi(plat) for plat in platforms])
                    return {
                        "product_ids": product_ids,
                        "product_name": combined_title,
                        "product_image_url": _product_image(products_fetched[0]) if products_fetched else None,
                        "products": [
                            {
                                "id": str(p.id),
                                "name": p.name,
                                "price": float(p.price) if p.price else None,
                                "image_url": _product_image(p),
                                "description": p.description,
                                "sku": p.sku,
                                "stock_qty": p.stock_qty,
                            }
                            for p in products_fetched
                        ],
                        "posts": list(posts),
                    }

                elif tool_name == "generate_flier":
                    product = await _get_product(args.get("product_id", ""), uuid.UUID(tenant_id), db)
                    from app.api.v1.marketing import _build_flier_spec
                    spec = _build_flier_spec(
                        product=product,
                        brand=brand,
                        headline=args.get("headline", ""),
                        subheadline=args.get("subheadline", ""),
                        call_to_action=args.get("call_to_action", "Shop Now"),
                        promo_text=args.get("promo_text", ""),
                        fmt=args.get("format", "square"),
                    )
                    return spec

                elif tool_name == "generate_multi_product_flier":
                    from app.api.v1.marketing import _build_multi_flier_spec
                    product_ids = args.get("product_ids", [])
                    products_fetched = []
                    for pid in product_ids:
                        try:
                            p = await _get_product(pid, uuid.UUID(tenant_id), db)
                            products_fetched.append(p)
                        except Exception:
                            pass
                    if not products_fetched:
                        return {"error": "No valid products found for the given IDs"}
                    spec = _build_multi_flier_spec(
                        products=products_fetched,
                        brand=brand,
                        headline=args.get("headline", ""),
                        subheadline=args.get("subheadline", ""),
                        call_to_action=args.get("call_to_action", "Shop Now"),
                        promo_text=args.get("promo_text", ""),
                        fmt=args.get("format", "landscape"),
                    )
                    return spec

                elif tool_name == "generate_flier_image":
                    import os as _os
                    from app.api.v1.marketing import (
                        _build_flier_spec, _generate_dalle_image, _flier_dalle_prompt,
                        _analyze_product_image, _product_image,
                    )
                    product = await _get_product(args.get("product_id", ""), uuid.UUID(tenant_id), db)
                    fmt = args.get("format", "square")
                    spec = _build_flier_spec(
                        product=product,
                        brand=brand,
                        headline=args.get("headline", ""),
                        subheadline=args.get("subheadline", ""),
                        call_to_action=args.get("call_to_action", "Shop Now"),
                        promo_text=args.get("promo_text", ""),
                        fmt=fmt,
                    )
                    size_map = {"square": "1024x1024", "portrait": "1024x1792", "landscape": "1792x1024"}
                    dalle_size = size_map.get(fmt, "1024x1024")
                    primary = spec["brand"]["primary_color"]
                    secondary = spec["brand"]["secondary_color"]
                    headline = spec["copy"]["headline"]
                    imagery_style = spec["style"].get("imagery_style", "Product-focused lifestyle")
                    background_style = spec["style"].get("background_style", "Clean white background")
                    _api_key = _os.environ.get("OPENAI_API_KEY", "")
                    product_img_url = _product_image(product)

                    # Call 1: vision — send product info + photo to GPT-4o in one request
                    image_analysis = ""
                    if product_img_url and _api_key and not _api_key.startswith("sk-test"):
                        image_analysis = await _analyze_product_image(
                            title=product.name,
                            desc=product.description or "",
                            image_url=product_img_url,
                            api_key=_api_key,
                        )

                    # Call 2: DALL-E — full brand context + vision analysis
                    prompt = _flier_dalle_prompt(
                        brand_name=spec["brand"]["name"],
                        product_name=product.name,
                        product_description=product.description or "",
                        headline=headline,
                        primary_color=primary,
                        secondary_color=secondary,
                        imagery_style=imagery_style,
                        background_style=background_style,
                        image_analysis=image_analysis,
                        tagline=brand.tagline if brand else "",
                        tone=", ".join(brand.tone_adjectives) if (brand and brand.tone_adjectives) else "",
                        target_audience=brand.target_audience if brand else "",
                        font_family=brand.font_family if brand else "",
                        call_to_action=spec["copy"]["call_to_action"],
                        promo_text=spec["copy"]["promo_text"],
                        subheadline=spec["copy"]["subheadline"],
                        price=f"${product.price:.2f}" if product.price else "",
                    )
                    ai_image_url = await _generate_dalle_image(prompt, size=dalle_size)
                    spec["ai_image_url"] = ai_image_url
                    spec["image_analysis"] = image_analysis
                    spec["_rendered"] = True
                    spec["_instruction"] = (
                        "The flier card has already been rendered in the UI automatically. "
                        "Do NOT call render_ui again. Just say one short line like: "
                        "'Here's your AI-generated flier — ready to download!'"
                    )
                    return spec

                elif tool_name == "generate_multi_flier_image":
                    import asyncio as _asyncio2
                    import os as _os
                    from app.api.v1.marketing import (
                        _build_multi_flier_spec, _generate_dalle_image, _multi_flier_dalle_prompt,
                        _analyze_product_image, _product_image,
                    )
                    product_ids = args.get("product_ids", [])
                    products_fetched = []
                    for pid in product_ids:
                        try:
                            p = await _get_product(pid, uuid.UUID(tenant_id), db)
                            products_fetched.append(p)
                        except Exception:
                            pass
                    if not products_fetched:
                        return {"error": "No valid products found for the given IDs"}
                    fmt = args.get("format", "landscape")
                    spec = _build_multi_flier_spec(
                        products=products_fetched,
                        brand=brand,
                        headline=args.get("headline", ""),
                        subheadline=args.get("subheadline", ""),
                        call_to_action=args.get("call_to_action", "Shop Now"),
                        promo_text=args.get("promo_text", ""),
                        fmt=fmt,
                    )
                    size_map = {"square": "1024x1024", "portrait": "1024x1792", "landscape": "1792x1024"}
                    dalle_size = size_map.get(fmt, "1792x1024")
                    _api_key = _os.environ.get("OPENAI_API_KEY", "")

                    # Call 1: vision — analyze each product photo, run in parallel
                    async def _analyze_one(p):
                        img = _product_image(p)
                        if img and _api_key and not _api_key.startswith("sk-test"):
                            return await _analyze_product_image(
                                title=p.name,
                                desc=p.description or "",
                                image_url=img,
                                api_key=_api_key,
                            )
                        return p.description or ""

                    analyses = await _asyncio2.gather(*[_analyze_one(p) for p in products_fetched])
                    combined_analysis = " | ".join(a for a in analyses if a)

                    # Call 2: DALL-E with full brand context + vision analysis
                    prompt = _multi_flier_dalle_prompt(
                        brand_name=spec["brand"]["name"],
                        product_names=[p.name for p in products_fetched],
                        headline=spec["copy"]["headline"],
                        primary_color=spec["brand"]["primary_color"],
                        secondary_color=spec["brand"]["secondary_color"],
                        imagery_style=spec["style"].get("imagery_style", "Product-focused lifestyle"),
                        background_style=spec["style"].get("background_style", "Clean white background"),
                        tagline=brand.tagline if brand else "",
                        tone=", ".join(brand.tone_adjectives) if (brand and brand.tone_adjectives) else "",
                        target_audience=brand.target_audience if brand else "",
                        font_family=brand.font_family if brand else "",
                        call_to_action=spec["copy"]["call_to_action"],
                        promo_text=spec["copy"]["promo_text"],
                        subheadline=spec["copy"]["subheadline"],
                        image_analysis=combined_analysis,
                    )
                    ai_image_url = await _generate_dalle_image(prompt, size=dalle_size)
                    spec["ai_image_url"] = ai_image_url
                    spec["image_analysis"] = combined_analysis
                    spec["_rendered"] = True
                    spec["_instruction"] = (
                        "The collection flier card has already been rendered in the UI automatically. "
                        "Do NOT call render_ui again. Just say one short line like: "
                        "'Here's your AI-generated collection flier — ready to download!'"
                    )
                    return spec

            except Exception as exc:
                logger.error(f"[{tool_name}] failed: {exc}")
                return {"error": str(exc)}

        if tool_name == "render_ui":
            surface = args.get("component", args.get("surface", "unknown"))
            props = args.get("props", {})

            # Re-attach image_url from DB for surfaces that show a single product.
            # The LLM often omits or truncates the image field when building props.
            if surface in ("edit_product", "remove_product", "product_variants") and db is not None and tenant_id:
                try:
                    product_id_str = props.get("id") or props.get("productId") or ""
                    if product_id_str:
                        from app.models.product import Product as _Prod
                        from sqlalchemy import select as _sel
                        p = await db.scalar(
                            _sel(_Prod).where(
                                _Prod.id == uuid.UUID(str(product_id_str)),
                                _Prod.tenant_id == uuid.UUID(tenant_id),
                            )
                        )
                        if p:
                            img = p.image_url
                            if not img and p.image_data:
                                img = f"data:image/jpeg;base64,{p.image_data}"
                            props = {**props, "image_url": img, "productImageUrl": img}
                except Exception as exc:
                    logger.warning(f"[render_ui/{surface}] image re-fetch failed: {exc}")

            # For product_list, re-fetch products from DB to ensure image_url is always populated.
            # The LLM often strips large fields (base64, long URLs) when constructing props.
            if surface == "product_list" and db is not None and tenant_id:
                try:
                    from app.services.product_tools import search_catalog_impl
                    fresh = await search_catalog_impl(
                        db=db,
                        tenant_id=uuid.UUID(tenant_id),
                        query="",
                        limit=props.get("per_page", 50) or 50,
                    )
                    fresh_products = fresh.get("results", fresh) if isinstance(fresh, dict) else fresh
                    props = {
                        **props,
                        "products": fresh_products,
                        "total": len(fresh_products),
                        "page": props.get("page", 1),
                        "per_page": props.get("per_page", 10) or 10,
                    }
                except Exception as exc:
                    logger.warning(f"[render_ui/product_list] image re-fetch failed: {exc}")

            return {
                "surface": surface,
                "components": args.get("components", props.get("components", [])),
                "props": props,
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
