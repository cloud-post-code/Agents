"""AI image enhancement — places product into a professional scene using OpenAI image editing."""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/enhance", tags=["image-enhance"])
logger = logging.getLogger(__name__)

# Concise prompt that stays well under the 32k character limit
_ENHANCE_PROMPT_TEMPLATE = (
    "Professional commercial product photograph. "
    "Keep the product EXACTLY as-is — do not alter its shape, color, patterns, or details. "
    "Place it in the following environment: {scene}. "
    "Balanced studio lighting with realistic shadows. "
    "Front-facing camera, sharp product focus, soft background depth-of-field. "
    "Ultra-realistic, high-resolution, 1:1 aspect ratio."
)

_DEFAULT_SCENE = "clean white studio background with soft natural shadows on a smooth surface"


class EnhanceRequest(BaseModel):
    image_url: str
    scene_prompt: Optional[str] = None
    count: int = 1  # 1–4 images


class EnhanceResponse(BaseModel):
    enhanced_urls: list[str]
    scene_used: str


@router.post("/product-image", response_model=EnhanceResponse)
async def enhance_product_image(
    body: EnhanceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI-enhanced product photos with professional backgrounds."""
    from app.core.config import settings
    api_key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    count = max(1, min(4, body.count))
    scene = (body.scene_prompt or _DEFAULT_SCENE).strip()[:500]  # cap scene length
    prompt = _ENHANCE_PROMPT_TEMPLATE.format(scene=scene)

    try:
        import openai

        # Download the source image so we can send it as bytes to images.edit
        async with httpx.AsyncClient(timeout=30) as http:
            img_response = await http.get(body.image_url)
            img_response.raise_for_status()
            image_bytes = img_response.content

        # Determine content type
        content_type = img_response.headers.get("content-type", "image/png")
        ext = "png"
        if "jpeg" in content_type or "jpg" in content_type:
            ext = "jpeg"
        elif "webp" in content_type:
            ext = "webp"

        client = openai.AsyncOpenAI(api_key=api_key)
        enhanced_urls: list[str] = []

        for _ in range(count):
            # Use images.edit which accepts a reference image and modifies it
            response = await client.images.edit(
                model="gpt-image-1",
                image=(f"product.{ext}", image_bytes, content_type),
                prompt=prompt,
                n=1,
                size="1024x1024",
            )
            if response.data and response.data[0].url:
                enhanced_urls.append(response.data[0].url)
            elif response.data and response.data[0].b64_json:
                import base64 as _b64
                from app.services.storage import get_storage_service
                png_bytes = _b64.b64decode(response.data[0].b64_json)
                storage = get_storage_service()
                r2_url = await storage.upload_image(png_bytes, "image/png", "images/enhanced")
                enhanced_urls.append(r2_url)

        if not enhanced_urls:
            raise HTTPException(status_code=502, detail="No images returned from OpenAI")

        return EnhanceResponse(enhanced_urls=enhanced_urls, scene_used=scene)

    except openai.OpenAIError as e:
        logger.error(f"[enhance_product_image] OpenAI error: {e}")
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(e)}")
    except httpx.HTTPError as e:
        logger.error(f"[enhance_product_image] Failed to download source image: {e}")
        raise HTTPException(status_code=400, detail=f"Could not download product image: {str(e)}")
