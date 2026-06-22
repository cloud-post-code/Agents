"""AI image enhancement endpoint — generates enhanced product photos using GPT-image-1."""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/enhance", tags=["image-enhance"])
logger = logging.getLogger(__name__)

ENHANCEMENT_SYSTEM_PROMPT = """[SYSTEM DIRECTIVE]
You are an expert AI commercial photographer and composite artist. Your primary directive is to place the provided reference image of a product into a newly generated environment.

Absolute Preservation: Do NOT alter, warp, restyle, or hallucinate any details on the product itself. Size, color, shape, and patterns must remain the same as the reference image.

Sequential Coherence: When running batch generations, lock the random seed, lighting parameters, and environmental textures to maintain stylistic consistency across all outputs.

[IMAGE GENERATION PROMPT]
Use the provided reference image as the locked foreground subject. Generate the following environment strictly behind and around the product:

A high-resolution, ultra-realistic product photograph. The environment, background surface, and surrounding props must strictly reflect the user's scene description. The lighting is a balanced, multi-point diffused studio lighting designed to highlight the product's natural form, textures, and true colors (unless specific moody lighting is heavily requested). Cast realistic, physically accurate shadows from the locked product onto the newly generated surface to integrate it seamlessly. The camera angle is front-facing with sharp focus on the anchor product and a natural depth-of-field blur applied only to the background environment. Aspect ratio: 1:1.

[POST-GENERATION VERIFICATION]
Compare the core product in the generated image against the original reference image. If any color shifting, shape alteration, or detail degradation has occurred on the product, discard and regenerate."""


class EnhanceRequest(BaseModel):
    image_url: str
    scene_prompt: Optional[str] = None
    count: int = 1  # 1-4 images


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
    scene = body.scene_prompt or "clean white studio background with soft shadows"

    full_prompt = (
        f"{ENHANCEMENT_SYSTEM_PROMPT}\n\n"
        f"[USER SCENE INJECTION]\nUser Prompt: {scene}\n\n"
        f"Product image URL: {body.image_url}"
    )

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=api_key)

        enhanced_urls: list[str] = []
        for _ in range(count):
            response = await client.images.generate(
                model="gpt-image-1",
                prompt=full_prompt,
                n=1,
                size="1024x1024",
            )
            if response.data and response.data[0].url:
                enhanced_urls.append(response.data[0].url)
            elif response.data and response.data[0].b64_json:
                # Store base64 as data URI
                enhanced_urls.append(f"data:image/png;base64,{response.data[0].b64_json}")

        if not enhanced_urls:
            raise HTTPException(status_code=502, detail="No images returned from OpenAI")

        return EnhanceResponse(enhanced_urls=enhanced_urls, scene_used=scene)

    except openai.OpenAIError as e:
        logger.error(f"[enhance_product_image] OpenAI error: {e}")
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(e)}")
