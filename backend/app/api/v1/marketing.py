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


async def _generate_caption(
    title: str,
    desc: str,
    platform: str,
    post_type: str,
    creative_brief: str,
    brand: BrandDNA | None,
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
    user = COPYWRITER_USER.format(
        platform_label=platform_label,
        post_type_name=post_type_name,
        title=title,
        desc=desc or "No description provided.",
        brand_context=brand_ctx or "No brand context set.",
        creative_block=creative_brief or "Showcase the product authentically.",
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


async def _generate_dalle_image(prompt: str, size: str = "1024x1024") -> str | None:
    """Call DALL-E 3 with the given prompt and return the image URL. Returns None on failure."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-test"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        resp = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,  # type: ignore[arg-type]
            quality="standard",
            n=1,
        )
        return resp.data[0].url
    except Exception as exc:
        logger.warning(f"DALL-E generation failed: {exc}")
        return None


def _flier_dalle_prompt(
    brand_name: str,
    product_name: str,
    product_description: str,
    headline: str,
    primary_color: str,
    secondary_color: str,
    imagery_style: str,
    background_style: str,
) -> str:
    return (
        f"Create a professional marketing flier image for '{brand_name}'. "
        f"Featured product: {product_name}. {product_description}. "
        f"Headline text on the flier: '{headline}'. "
        f"Color palette: primary {primary_color}, accent {secondary_color}. "
        f"Style: {imagery_style}. Background: {background_style}. "
        "High quality, clean layout, commercial photography aesthetic. "
        "No watermarks. Do not include any text or logos in the generated image — "
        "the image should be the visual backdrop/scene only."
    )


def _multi_flier_dalle_prompt(
    brand_name: str,
    product_names: list[str],
    headline: str,
    primary_color: str,
    secondary_color: str,
    imagery_style: str,
    background_style: str,
) -> str:
    products_str = ", ".join(product_names)
    return (
        f"Create a professional collection marketing flier image for '{brand_name}'. "
        f"Featured products: {products_str}. "
        f"Headline: '{headline}'. "
        f"Color palette: primary {primary_color}, accent {secondary_color}. "
        f"Style: {imagery_style}. Background: {background_style}. "
        "Show the products elegantly arranged together in a lifestyle or flat-lay composition. "
        "High quality, clean commercial photography aesthetic. No watermarks. "
        "Do not include any text or logos — image is the visual scene only."
    )


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
