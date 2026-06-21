"""Vision extraction utilities — GPT-4o image analysis for product data."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_EXTRACT_PROMPT = (
    "You are a product cataloguing assistant. Analyse this product image and return ONLY valid JSON "
    "(no markdown, no code fences) with these exact keys:\n"
    "{\n"
    '  "name": "<short product name>",\n'
    '  "description": "<1-2 sentence product description>",\n'
    '  "variants": [{"name": "<variant label>"}],\n'
    '  "weight_grams_estimate": <integer grams or null>\n'
    "}\n"
    "Return an empty variants list if no variants are visible. "
    "Return null for weight_grams_estimate if you cannot reasonably estimate the weight."
)

_DEFAULT_RESULT: dict[str, Any] = {
    "name": "Product",
    "description": "",
    "variants": [],
    "weight_grams_estimate": None,
}


async def extract_product_from_image_url(image_url: str, api_key: str) -> dict:
    """
    Call GPT-4o vision on a single image URL.

    Returns a dict with keys: name, description, variants, weight_grams_estimate.
    On any failure, returns safe defaults so callers never crash.
    """
    try:
        from openai import AsyncOpenAI  # optional dep — fail gracefully
    except ImportError:
        logger.warning("openai package not installed; returning default product result")
        return {**_DEFAULT_RESULT}

    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _EXTRACT_PROMPT},
                        {"type": "image_url", "image_url": {"url": image_url, "detail": "low"}},
                    ],
                }
            ],
        )
        raw = response.choices[0].message.content or ""
        data = json.loads(raw.strip())
        return {
            "name": str(data.get("name") or "Product"),
            "description": str(data.get("description") or ""),
            "variants": list(data.get("variants") or []),
            "weight_grams_estimate": data.get("weight_grams_estimate"),
        }
    except json.JSONDecodeError as exc:
        logger.error("vision: JSON parse error for %s: %s", image_url, exc)
        return {**_DEFAULT_RESULT}
    except Exception as exc:
        logger.error("vision: extraction failed for %s: %s", image_url, exc)
        return {**_DEFAULT_RESULT}


async def extract_products_from_image_urls(image_urls: list[str], api_key: str) -> list[dict]:
    """
    Call GPT-4o vision on multiple image URLs in parallel.

    Groups results by name similarity: images whose extracted name starts with
    the same first word are merged into one product with multiple image_urls.
    Returns a list of dicts, each with: name, description, variants, weight_grams_estimate, image_urls.
    """
    if not image_urls:
        return []

    results = await asyncio.gather(
        *[extract_product_from_image_url(url, api_key) for url in image_urls]
    )

    # Pair each result with its source URL
    tagged: list[tuple[dict, str]] = list(zip(results, image_urls))

    # Group: use first word of name as key (case-insensitive)
    def _first_word(name: str) -> str:
        words = name.strip().split()
        return words[0].lower() if words else ""

    groups: dict[str, list[tuple[dict, str]]] = {}
    for result, url in tagged:
        key = _first_word(result["name"])
        groups.setdefault(key, []).append((result, url))

    products: list[dict] = []
    for _key, members in groups.items():
        # Use the first member's extracted data as the canonical representation
        representative, _ = members[0]
        products.append({
            "name": representative["name"],
            "description": representative["description"],
            "variants": representative["variants"],
            "weight_grams_estimate": representative["weight_grams_estimate"],
            "image_urls": [url for _, url in members],
        })

    return products
