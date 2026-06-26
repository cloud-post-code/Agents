"""Marketing generation API — social posts, fliers, and caption copy."""
from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.brand import BrandDNA
from app.models.product import Product
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/marketing", tags=["marketing"])

Platform = Literal["instagram", "facebook", "tiktok", "twitter", "pinterest"]
PostType = Literal["feed_post", "story", "reel", "carousel"]

PLATFORM_LABELS: dict[str, str] = {
    "instagram": "Instagram",
    "facebook": "Facebook",
    "tiktok": "TikTok",
    "twitter": "X (Twitter)",
    "pinterest": "Pinterest",
}

POST_TYPE_NAMES: dict[str, str] = {
    "feed_post": "Feed Post",
    "story": "Story",
    "reel": "Reel",
    "carousel": "Carousel",
}


# ─── Schemas ───────────────────────────────────────────────────────────────────

class SocialPostRequest(BaseModel):
    product_id: str
    platform: Platform = "instagram"
    post_type: PostType = "feed_post"
    creative_brief: str = ""


class SocialPostBatchRequest(BaseModel):
    product_id: str
    platforms: list[Platform] = ["instagram", "facebook", "tiktok"]
    post_type: PostType = "feed_post"
    creative_brief: str = ""


class FlierRequest(BaseModel):
    product_id: str
    headline: str = ""
    subheadline: str = ""
    call_to_action: str = "Shop Now"
    promo_text: str = ""
    format: Literal["square", "portrait", "landscape"] = "square"


class CaptionOnlyRequest(BaseModel):
    title: str
    description: str
    platform: Platform = "instagram"
    post_type: PostType = "feed_post"
    creative_brief: str = ""


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def _get_brand(tenant_id, db: AsyncSession) -> BrandDNA | None:
    from uuid import UUID as _UUID
    tid = _UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    result = await db.execute(select(BrandDNA).where(BrandDNA.tenant_id == tid))
    return result.scalar_one_or_none()


async def _get_product(product_id: str, tenant_id, db: AsyncSession) -> Product:
    from uuid import UUID
    try:
        pid = UUID(product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product_id")
    tid = UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    result = await db.execute(
        select(Product).where(Product.id == pid, Product.tenant_id == tid, Product.deleted_at.is_(None))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _brand_context(brand: BrandDNA | None) -> str:
    if not brand:
        return ""
    parts = []
    if brand.brand_name:
        parts.append(f"Brand: {brand.brand_name}")
    if brand.tagline:
        parts.append(f"Tagline: {brand.tagline}")
    if brand.tone_adjectives:
        parts.append(f"Tone: {', '.join(brand.tone_adjectives)}")
    if brand.writing_style:
        parts.append(f"Style: {brand.writing_style}")
    if brand.target_audience:
        parts.append(f"Audience: {brand.target_audience}")
    return "\n".join(parts)


COPYWRITER_SYSTEM = (
    "You are an expert e-commerce social media copywriter.\n\n"
    "Your role: {platform_label} feed post copywriter.\n"
    "Write a polished feed caption: engaging opening, optional short paragraphs, moderate relevant hashtags.\n\n"
    "Rules for ALL outputs:\n"
    "- Output ONLY the final caption as plain text (what a human would paste into {platform_label}).\n"
    "- Do NOT generate, request, or describe images. No DALL·E, no image URLs, no base64.\n"
    "- Do NOT wrap the caption in quotes or markdown code fences.\n"
    "- Do NOT prefix with 'Here is the caption:' or similar.\n"
    "- Match the language of the product name and description when possible; otherwise use English.\n"
)

COPYWRITER_USER = (
    "Channel: {platform_label}\n"
    "Format: {post_type_name}\n\n"
    "### Product name\n{title}\n\n"
    "### Product description (catalog)\n{desc}\n\n"
    "### Brand context\n{brand_context}\n\n"
    "### Brief\n{creative_block}\n\n"
    "Write the {platform_label} {post_type_name} caption now."
)


async def _analyze_product_image(
    title: str,
    desc: str,
    image_url: str,
    api_key: str,
) -> str:
    """
    Call 1: GPT-4o vision — send product info + photo in a single request.
    Returns a rich visual description used to enhance downstream AI calls.
    """
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)

    # Build the image content block: data URIs and https URLs are both supported
    image_block: dict = {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}}

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        image_block,
                        {
                            "type": "text",
                            "text": (
                                f"Product: {title}\n"
                                f"Description: {desc or 'Not provided'}\n\n"
                                "Analyze this product photo and describe in 2-3 sentences: "
                                "the visual appearance (colors, texture, finish, shape), "
                                "the mood or aesthetic it conveys, and what makes it appealing. "
                                "Be specific and sensory. This will be used to write marketing copy."
                            ),
                        },
                    ],
                }
            ],
            max_tokens=200,
        )
        result = (resp.choices[0].message.content or "").strip()
        logger.info("[vision] analysis complete len=%d", len(result))
        return result
    except Exception as exc:
        logger.warning("[vision] analysis failed (non-fatal, continuing): %s", exc)
        return desc or ""


COPYWRITER_USER_WITH_VISION = (
    "Channel: {platform_label}\n"
    "Format: {post_type_name}\n\n"
    "### Product name\n{title}\n\n"
    "### Product description (catalog)\n{desc}\n\n"
    "### Visual analysis of product photo\n{image_analysis}\n\n"
    "### Brand context\n{brand_context}\n\n"
    "### Brief\n{creative_block}\n\n"
    "{iteration_block}"
    "Write the {platform_label} {post_type_name} caption now."
)


async def _generate_caption(
    title: str,
    desc: str,
    platform: str,
    post_type: str,
    creative_brief: str,
    brand: BrandDNA | None,
    image_analysis: str = "",
    previous_caption: str = "",
) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    platform_label = PLATFORM_LABELS.get(platform, platform)
    post_type_name = POST_TYPE_NAMES.get(post_type, post_type)
    brand_ctx = _brand_context(brand)

    if not api_key or api_key.startswith("sk-test"):
        return _stub_caption(title, platform_label, post_type_name)

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    system = COPYWRITER_SYSTEM.format(platform_label=platform_label)

    iteration_block = ""
    if previous_caption:
        iteration_block = (
            f"### Previous caption (iterate on this)\n{previous_caption}\n\n"
            "Apply the brief above as edits to the previous caption. "
            "Return an improved version that incorporates the requested changes.\n\n"
        )

    if image_analysis:
        user = COPYWRITER_USER_WITH_VISION.format(
            platform_label=platform_label,
            post_type_name=post_type_name,
            title=title,
            desc=desc or "No description provided.",
            image_analysis=image_analysis,
            brand_context=brand_ctx or "No brand context set.",
            creative_block=creative_brief or "Showcase the product authentically.",
            iteration_block=iteration_block,
        )
    else:
        user = COPYWRITER_USER.format(
            platform_label=platform_label,
            post_type_name=post_type_name,
            title=title,
            desc=desc or "No description provided.",
            brand_context=brand_ctx or "No brand context set.",
            creative_block=creative_brief or "Showcase the product authentically.",
        )
        if iteration_block:
            user = user.replace(
                "Write the {platform_label} {post_type_name} caption now.".format(
                    platform_label=platform_label, post_type_name=post_type_name
                ),
                iteration_block + f"Write the {platform_label} {post_type_name} caption now.",
            )

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.85,
            max_tokens=400,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.warning(f"Caption generation failed: {exc}")
        return _stub_caption(title, platform_label, post_type_name)


def _stub_caption(title: str, platform_label: str, post_type_name: str) -> str:
    return (
        f"✨ Introducing {title} — crafted with care and built to last.\n\n"
        f"This piece tells a story. Yours.\n\n"
        f"Shop now through the link in bio. ❤️\n\n"
        f"#handmade #artisan #shopsmall #craftedwithlove #{title.replace(' ', '').lower()}"
    )


def _build_flier_spec(
    product: Product,
    brand: BrandDNA | None,
    headline: str,
    subheadline: str,
    call_to_action: str,
    promo_text: str,
    fmt: str,
) -> dict:
    """Build a structured flier spec for frontend rendering."""
    primary = (brand.primary_color if brand else None) or "#1a1a1a"
    secondary = (brand.secondary_color if brand else None) or "#ffffff"
    font = (brand.font_family if brand else None) or "Inter"
    brand_name = (brand.brand_name if brand else None) or "Your Brand"

    dims = {
        "square": {"width": 1080, "height": 1080, "ratio": "1:1"},
        "portrait": {"width": 1080, "height": 1350, "ratio": "4:5"},
        "landscape": {"width": 1200, "height": 628, "ratio": "1.91:1"},
    }[fmt]

    return {
        "format": fmt,
        "dimensions": dims,
        "brand": {
            "name": brand_name,
            "logo_url": brand.logo_url if brand else None,
            "primary_color": primary,
            "secondary_color": secondary,
            "font_family": font,
            "font_weights": (brand.font_weights if brand else None) or [400, 700],
        },
        "product": {
            "id": str(product.id),
            "name": product.name,
            "description": product.description,
            "price": float(product.price) if product.price else None,
            "image_url": _product_image(product),
            "sku": product.sku,
        },
        "copy": {
            "headline": headline or product.name,
            "subheadline": subheadline or (product.description or "")[:120],
            "call_to_action": call_to_action,
            "promo_text": promo_text,
        },
        "style": {
            "background_style": (brand.background_style if brand else None) or "Clean white background",
            "imagery_style": (brand.imagery_style if brand else None) or "Product-focused lifestyle",
        },
    }


async def _generate_dalle_image_with_error(
    prompt: str,
    size: str = "1024x1792",
) -> tuple[str | None, str | None]:
    """Generate a flier image with DALL-E 3. Returns (data_uri, error_string)."""
    from app.core.config import settings as _cfg
    api_key = _cfg.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-test"):
        msg = f"No valid OpenAI API key (found: {'sk-test...' if api_key else 'MISSING'})"
        logger.warning("[dalle] %s", msg)
        return None, msg
    logger.info("[dalle] generating size=%s prompt_len=%d key=%s", size, len(prompt), api_key[:8])
    try:
        from openai import AsyncOpenAI
        import httpx
        import base64 as _b64

        client = AsyncOpenAI(api_key=api_key)
        resp = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,  # type: ignore[arg-type]
            quality="hd",
            n=1,
        )
        image_url = resp.data[0].url
        if not image_url:
            return None, "DALL-E returned no image URL"
        async with httpx.AsyncClient(timeout=60) as http:
            dl = await http.get(image_url)
            dl.raise_for_status()
            content_type = dl.headers.get("content-type", "image/png").split(";")[0]
            b64 = _b64.b64encode(dl.content).decode()
            logger.info("[dalle] success bytes=%d", len(dl.content))
            return f"data:{content_type};base64,{b64}", None
    except Exception as exc:
        msg = f"{type(exc).__name__}: {exc}"
        logger.error("[dalle] FAILED %s", msg)
        return None, msg


async def _generate_dalle_image(
    prompt: str,
    size: str = "1024x1792",
    product_image_url: str | None = None,
) -> str | None:
    """Wrapper that discards the error string."""
    result, _ = await _generate_dalle_image_with_error(prompt, size)
    return result


def _flier_dalle_prompt(
    brand_name: str,
    product_name: str,
    product_description: str,
    headline: str,
    primary_color: str,
    secondary_color: str,
    imagery_style: str,
    background_style: str,
    image_analysis: str = "",
    tagline: str = "",
    tone: str = "",
    target_audience: str = "",
    font_family: str = "",
    call_to_action: str = "",
    promo_text: str = "",
    subheadline: str = "",
    price: str = "",
) -> str:
    visual_detail = image_analysis or product_description

    parts = [
        f"Design a complete portrait-orientation one-page printed flier for {brand_name}.",
        "Layout: full 8.5x11 inch page, portrait orientation, ready to print and hand out in person.",
        "The flier must include all of the following sections from top to bottom:",
        f"1. Brand name '{brand_name}' prominently at the top." + (f" Tagline: '{tagline}'." if tagline else ""),
        f"2. Large bold headline: '{headline}'." if headline else "",
        f"3. Subheadline or benefit statement: '{subheadline}'." if subheadline else "",
        f"4. Product photo of '{product_name}' as the hero image — large, centered, high quality. {visual_detail}",
        f"5. Price displayed clearly: {price}." if price else "",
        f"6. Key product description or benefit for {target_audience}." if target_audience else "5. Key product description or benefit.",
        f"7. Promotional offer: '{promo_text}'." if promo_text else "",
        f"8. Bold call-to-action button or text: '{call_to_action}'." if call_to_action else "",
        f"Color palette: primary {primary_color}, accent {secondary_color}.",
        f"Typography: {font_family}." if font_family else "",
        f"Visual style: {imagery_style}." if imagery_style else "",
        f"Brand tone: {tone}." if tone else "",
        "Design requirements: generous whitespace, strong visual hierarchy, premium print quality.",
        "Make it look like a professionally designed retail flier — suitable for handing out at markets, events, or stores.",
    ]

    return " ".join(p for p in parts if p)


def _multi_flier_dalle_prompt(
    brand_name: str,
    product_names: list[str],
    headline: str,
    primary_color: str,
    secondary_color: str,
    imagery_style: str,
    background_style: str,
    tagline: str = "",
    tone: str = "",
    target_audience: str = "",
    font_family: str = "",
    call_to_action: str = "",
    promo_text: str = "",
    subheadline: str = "",
    image_analysis: str = "",
) -> str:
    products_str = ", ".join(product_names)

    visual_note = image_analysis or ""

    parts = [
        f"A polished marketing flier for {brand_name} featuring {products_str}.",
        visual_note,
        f"Headline: {headline}." if headline else "",
        f"Subheadline: {subheadline}." if subheadline else "",
        f"Call to action: {call_to_action}." if call_to_action else "",
        f"Promotion: {promo_text}." if promo_text else "",
        f"Brand tone: {tone}." if tone else "",
        f"Color palette: primary {primary_color}, accent {secondary_color}.",
        f"Visual style: {imagery_style}." if imagery_style else "",
        f"Background: {background_style}." if background_style else "",
        "Products elegantly arranged. Clean layout, strong visual hierarchy, premium commercial quality.",
    ]

    return " ".join(p for p in parts if p)


def _product_image(product: Product) -> str | None:
    return product.image_url or (
        f"data:image/jpeg;base64,{product.image_data}" if product.image_data else None
    )


def _build_multi_flier_spec(
    products: list[Product],
    brand: "BrandDNA | None",
    headline: str,
    subheadline: str,
    call_to_action: str,
    promo_text: str,
    fmt: str,
) -> dict:
    """Build a multi-product flier spec for the MultiFlierPreviewCard."""
    primary = (brand.primary_color if brand else None) or "#1a1a1a"
    secondary = (brand.secondary_color if brand else None) or "#ffffff"
    font = (brand.font_family if brand else None) or "Inter"
    brand_name = (brand.brand_name if brand else None) or "Your Brand"

    dims = {
        "square": {"width": 1080, "height": 1080, "ratio": "1:1"},
        "portrait": {"width": 1080, "height": 1350, "ratio": "4:5"},
        "landscape": {"width": 1200, "height": 628, "ratio": "1.91:1"},
    }[fmt]

    return {
        "format": fmt,
        "dimensions": dims,
        "brand": {
            "name": brand_name,
            "logo_url": brand.logo_url if brand else None,
            "primary_color": primary,
            "secondary_color": secondary,
            "font_family": font,
            "font_weights": (brand.font_weights if brand else None) or [400, 700],
        },
        "products": [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "price": float(p.price) if p.price else None,
                "image_url": _product_image(p),
                "sku": p.sku,
                "stock_qty": p.stock_qty,
            }
            for p in products
        ],
        "copy": {
            "headline": headline or "Our Collection",
            "subheadline": subheadline or "",
            "call_to_action": call_to_action,
            "promo_text": promo_text,
        },
        "style": {
            "background_style": (brand.background_style if brand else None) or "Clean white background",
            "imagery_style": (brand.imagery_style if brand else None) or "Product-focused lifestyle",
        },
    }


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.post("/social-post")
async def generate_social_post(
    body: SocialPostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a single social media caption for a product."""
    product = await _get_product(body.product_id, current_user.tenant_id, db)
    brand = await _get_brand(current_user.tenant_id, db)
    caption = await _generate_caption(
        title=product.name,
        desc=product.description or "",
        platform=body.platform,
        post_type=body.post_type,
        creative_brief=body.creative_brief,
        brand=brand,
    )
    return {
        "product_id": body.product_id,
        "product_name": product.name,
        "product_image_url": product.image_url,
        "platform": body.platform,
        "post_type": body.post_type,
        "caption": caption,
        "brand_name": brand.brand_name if brand else None,
    }


@router.post("/social-post/batch")
async def generate_social_post_batch(
    body: SocialPostBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate captions for multiple platforms at once."""
    import asyncio
    product = await _get_product(body.product_id, current_user.tenant_id, db)
    brand = await _get_brand(current_user.tenant_id, db)

    async def gen(platform: str):
        caption = await _generate_caption(
            title=product.name,
            desc=product.description or "",
            platform=platform,
            post_type=body.post_type,
            creative_brief=body.creative_brief,
            brand=brand,
        )
        return {
            "platform": platform,
            "platform_label": PLATFORM_LABELS.get(platform, platform),
            "caption": caption,
        }

    posts = await asyncio.gather(*[gen(p) for p in body.platforms])
    return {
        "product_id": body.product_id,
        "product_name": product.name,
        "product_image_url": product.image_url,
        "posts": list(posts),
    }


@router.post("/flier")
async def generate_flier(
    body: FlierRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Build a structured flier spec for the given product using brand DNA."""
    product = await _get_product(body.product_id, current_user.tenant_id, db)
    brand = await _get_brand(current_user.tenant_id, db)
    spec = _build_flier_spec(
        product=product,
        brand=brand,
        headline=body.headline,
        subheadline=body.subheadline,
        call_to_action=body.call_to_action,
        promo_text=body.promo_text,
        fmt=body.format,
    )
    return spec


@router.get("/test-dalle")
async def test_dalle(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Debug endpoint — test DALL-E connectivity and key validity."""
    from app.core.config import settings as _cfg
    import os as _os
    api_key = _cfg.openai_api_key or _os.environ.get("OPENAI_API_KEY", "")
    key_info = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else f"len={len(api_key)}"
    result = await _generate_dalle_image(
        "A simple purple candle on a white background. Clean product photo.",
        size="1024x1024",
    )
    return {
        "key_found": bool(api_key and not api_key.startswith("sk-test")),
        "key_prefix": key_info,
        "image_generated": bool(result),
        "image_size_bytes": len(result) if result else 0,
    }


@router.post("/caption")
async def generate_caption_only(
    body: CaptionOnlyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a caption without requiring a product_id — for custom content."""
    brand = await _get_brand(current_user.tenant_id, db)
    caption = await _generate_caption(
        title=body.title,
        desc=body.description,
        platform=body.platform,
        post_type=body.post_type,
        creative_brief=body.creative_brief,
        brand=brand,
    )
    return {"platform": body.platform, "caption": caption}
