"""Brand DNA API — CRUD + extraction endpoints."""
from __future__ import annotations

import logging
import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.brand import BrandDNA
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/brand", tags=["brand"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class BrandDNAPayload(BaseModel):
    brand_name: str | None = None
    tagline: str | None = None
    overview: str | None = None
    product_category: str | None = None
    target_audience: str | None = None
    tone_adjectives: list[str] | None = None
    writing_style: str | None = None
    primary_color: str | None = None
    primary_color_inverse: str | None = None
    secondary_color: str | None = None
    secondary_color_inverse: str | None = None
    logo_url: str | None = None
    logo_ratio: str | None = None
    font_family: str | None = None
    font_weights: list[int] | None = None
    background_style: str | None = None
    imagery_style: str | None = None
    typography_vibe: str | None = None
    source: str | None = None
    source_url: str | None = None


class ExtractFromURLRequest(BaseModel):
    url: str


class QAAnswers(BaseModel):
    business_name: str | None = None
    what_you_sell: str | None = None
    who_buys_from_you: str | None = None
    brand_vibe: str | None = None
    colors_you_love: str | None = None
    fonts_you_love: str | None = None
    tagline_or_slogan: str | None = None
    business_description: str | None = None


# ─── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_create_brand(tenant_id, db: AsyncSession) -> BrandDNA:
    import uuid as _uuid
    tid = _uuid.UUID(tenant_id) if isinstance(tenant_id, str) else tenant_id
    result = await db.execute(select(BrandDNA).where(BrandDNA.tenant_id == tid))
    brand = result.scalar_one_or_none()
    if not brand:
        brand = BrandDNA(tenant_id=tid)
        db.add(brand)
        await db.flush()
    return brand


def _brand_to_dict(brand: BrandDNA) -> dict:
    return {
        "id": str(brand.id),
        "tenant_id": str(brand.tenant_id),
        "brand_name": brand.brand_name,
        "tagline": brand.tagline,
        "overview": brand.overview,
        "product_category": brand.product_category,
        "target_audience": brand.target_audience,
        "tone_adjectives": brand.tone_adjectives or [],
        "writing_style": brand.writing_style,
        "primary_color": brand.primary_color,
        "primary_color_inverse": brand.primary_color_inverse,
        "secondary_color": brand.secondary_color,
        "secondary_color_inverse": brand.secondary_color_inverse,
        "logo_url": brand.logo_url,
        "logo_ratio": brand.logo_ratio,
        "font_family": brand.font_family,
        "font_weights": brand.font_weights or [],
        "background_style": brand.background_style,
        "imagery_style": brand.imagery_style,
        "typography_vibe": brand.typography_vibe,
        "source": brand.source,
        "source_url": brand.source_url,
        "created_at": brand.created_at.isoformat() if brand.created_at else None,
        "updated_at": brand.updated_at.isoformat() if brand.updated_at else None,
    }


def _extract_colors_from_text(text: str) -> list[str]:
    """Pull hex colors from arbitrary text."""
    return re.findall(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", text)


def _extract_from_qa(answers: QAAnswers) -> dict[str, Any]:
    """Convert Q&A answers into a BrandDNA field map."""
    tone_words = []
    vibe = answers.brand_vibe or ""
    style_words = ["elegant", "playful", "bold", "minimal", "warm", "modern", "rustic",
                   "artisanal", "sophisticated", "timeless", "vibrant", "luxurious"]
    for word in style_words:
        if word.lower() in vibe.lower():
            tone_words.append(word.capitalize())
    if not tone_words and vibe:
        tone_words = [w.strip().capitalize() for w in vibe.split(",") if w.strip()][:5]

    colors = []
    if answers.colors_you_love:
        colors = _extract_colors_from_text(answers.colors_you_love)

    font = None
    if answers.fonts_you_love:
        common_google = ["Lato", "Roboto", "Open Sans", "Montserrat", "Playfair Display",
                         "Merriweather", "Nunito", "Raleway", "Poppins", "Inter",
                         "Source Sans Pro", "Oswald", "PT Serif", "Lora", "Josefin Sans"]
        for gf in common_google:
            if gf.lower() in answers.fonts_you_love.lower():
                font = gf
                break
        if not font:
            font = answers.fonts_you_love.split(",")[0].strip()

    return {
        "brand_name": answers.business_name,
        "tagline": answers.tagline_or_slogan,
        "overview": answers.business_description,
        "product_category": answers.what_you_sell,
        "target_audience": answers.who_buys_from_you,
        "tone_adjectives": tone_words or None,
        "writing_style": f"Inspired by a {vibe} brand voice." if vibe else None,
        "primary_color": colors[0] if colors else None,
        "secondary_color": colors[1] if len(colors) > 1 else None,
        "font_family": font,
        "font_weights": [400, 700],
        "source": "qa",
    }


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_brand(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    brand = await _get_or_create_brand(current_user.tenant_id, db)
    await db.commit()
    return _brand_to_dict(brand)


@router.put("")
async def upsert_brand(
    payload: BrandDNAPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    brand = await _get_or_create_brand(current_user.tenant_id, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(brand, field, value)
    await db.commit()
    await db.refresh(brand)
    return _brand_to_dict(brand)


@router.post("/extract/url")
async def extract_from_url(
    body: ExtractFromURLRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Scrape a website URL and extract brand signals using LLM."""
    extracted = await _scrape_and_extract(body.url)
    brand = await _get_or_create_brand(current_user.tenant_id, db)
    for field, value in extracted.items():
        if value is not None:
            setattr(brand, field, value)
    brand.source = "website"
    brand.source_url = body.url
    await db.commit()
    await db.refresh(brand)
    return {"brand": _brand_to_dict(brand), "extraction": extracted}


@router.post("/extract/file")
async def extract_from_file(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
) -> dict:
    """Parse an uploaded file (PDF, DOCX, TXT, image) and extract brand signals."""
    content = await file.read()
    filename = file.filename or ""
    extracted = await _parse_file_and_extract(content, filename)
    brand = await _get_or_create_brand(current_user.tenant_id, db)
    for field, value in extracted.items():
        if value is not None:
            setattr(brand, field, value)
    brand.source = "upload"
    await db.commit()
    await db.refresh(brand)
    return {"brand": _brand_to_dict(brand), "extraction": extracted}


@router.post("/extract/qa")
async def extract_from_qa(
    answers: QAAnswers,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Convert Q&A interview answers into brand DNA and save."""
    extracted = _extract_from_qa(answers)
    brand = await _get_or_create_brand(current_user.tenant_id, db)
    for field, value in extracted.items():
        if value is not None:
            setattr(brand, field, value)
    await db.commit()
    await db.refresh(brand)
    return {"brand": _brand_to_dict(brand), "extraction": extracted}


# ─── LLM Extraction Helpers ────────────────────────────────────────────────────

async def _scrape_and_extract(url: str) -> dict[str, Any]:
    """Fetch page text and ask LLM to extract brand fields."""
    import httpx
    from bs4 import BeautifulSoup

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ArtisanBot/1.0)"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)[:6000]
    except Exception as exc:
        logger.warning(f"Scrape failed for {url}: {exc}")
        text = ""

    colors = _extract_colors_from_text(resp.text if "resp" in dir() else "")

    return await _llm_extract_brand(text, hint_colors=colors, source_url=url)


async def _parse_file_and_extract(content: bytes, filename: str) -> dict[str, Any]:
    """Parse file bytes and extract brand signals."""
    text = ""
    fname_lower = filename.lower()

    if fname_lower.endswith(".pdf"):
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            text = " ".join(page.extract_text() or "" for page in reader.pages)[:6000]
        except Exception as exc:
            logger.warning(f"PDF parse failed: {exc}")

    elif fname_lower.endswith(".docx"):
        try:
            import io
            import docx
            doc = docx.Document(io.BytesIO(content))
            text = " ".join(p.text for p in doc.paragraphs)[:6000]
        except Exception as exc:
            logger.warning(f"DOCX parse failed: {exc}")

    elif fname_lower.endswith((".txt", ".md")):
        text = content.decode("utf-8", errors="ignore")[:6000]

    elif fname_lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
        return await _vision_extract_brand(content)

    else:
        text = content.decode("utf-8", errors="ignore")[:4000]

    return await _llm_extract_brand(text)


async def _llm_extract_brand(text: str, hint_colors: list[str] | None = None, source_url: str = "") -> dict[str, Any]:
    """Ask an LLM to extract brand fields from text."""
    import json
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-test"):
        return _stub_extraction(text, hint_colors)

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    system = (
        "You are a brand analyst. Extract brand DNA from the provided text and return ONLY valid JSON "
        "with these keys (use null for unknown): brand_name, tagline, overview, product_category, "
        "target_audience, tone_adjectives (array of strings), writing_style, primary_color (hex), "
        "secondary_color (hex), font_family (Google Font name only), background_style, imagery_style, "
        "typography_vibe. Infer tone from language style. Return only JSON, no markdown."
    )
    user = f"Source URL: {source_url}\n\n{text[:5000]}"
    if hint_colors:
        user += f"\n\nColors detected in CSS: {', '.join(hint_colors[:5])}"

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        data["font_weights"] = [400, 700]
        return data
    except Exception as exc:
        logger.warning(f"LLM brand extraction failed: {exc}")
        return _stub_extraction(text, hint_colors)


async def _vision_extract_brand(image_bytes: bytes) -> dict[str, Any]:
    """Use GPT-4o vision to extract brand info from an image (logo, brand board, etc.)."""
    import base64, json
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-test"):
        return {"brand_name": "Detected from image", "source": "upload"}

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    b64 = base64.b64encode(image_bytes).decode()
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": (
                        "Analyze this brand image (logo, brand board, or product photo). "
                        "Return ONLY JSON with: brand_name, primary_color (hex), secondary_color (hex), "
                        "tone_adjectives (array), font_family (Google Font guess), overview. "
                        "Use null for unknowns."
                    )},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
            response_format={"type": "json_object"},
            max_tokens=400,
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:
        logger.warning(f"Vision brand extraction failed: {exc}")
        return {"source": "upload"}


def _stub_extraction(text: str, hint_colors: list[str] | None = None) -> dict[str, Any]:
    """Fallback stub for test environments."""
    return {
        "brand_name": None,
        "tagline": None,
        "overview": text[:200] if text else None,
        "primary_color": hint_colors[0] if hint_colors else None,
        "tone_adjectives": ["Warm", "Artisanal"],
        "font_family": "Lato",
        "font_weights": [400, 700],
    }
