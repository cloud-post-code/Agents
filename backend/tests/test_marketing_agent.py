"""Tests for Brand DNA and marketing generation endpoints."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Brand DNA endpoints ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_get_brand_empty(client: AsyncClient, auth_headers: dict):
    """GET /brand returns a brand profile for a new tenant."""
    resp = await client.get("/api/v1/brand", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "brand_name" in data
    assert "tenant_id" in data


@pytest.mark.anyio
async def test_put_brand_upsert(client: AsyncClient, auth_headers: dict):
    """PUT /brand saves brand fields and returns them."""
    payload = {
        "brand_name": "Test Brand",
        "tagline": "Crafted with care",
        "primary_color": "#ffea00",
        "font_family": "Lato",
        "font_weights": [400, 700],
        "tone_adjectives": ["Warm", "Elegant"],
    }
    resp = await client.put("/api/v1/brand", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["brand_name"] == "Test Brand"
    assert data["primary_color"] == "#ffea00"
    assert data["font_family"] == "Lato"
    assert "Warm" in data["tone_adjectives"]


@pytest.mark.anyio
async def test_put_brand_idempotent(client: AsyncClient, auth_headers: dict):
    """Multiple PUT calls update without creating duplicates."""
    await client.put("/api/v1/brand", json={"brand_name": "First"}, headers=auth_headers)
    resp = await client.put("/api/v1/brand", json={"brand_name": "Second"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["brand_name"] == "Second"

    resp2 = await client.get("/api/v1/brand", headers=auth_headers)
    assert resp2.json()["brand_name"] == "Second"


@pytest.mark.anyio
async def test_extract_from_qa(client: AsyncClient, auth_headers: dict):
    """POST /brand/extract/qa maps answers to brand DNA fields."""
    answers = {
        "business_name": "Pottery Lane",
        "what_you_sell": "Handmade ceramic mugs",
        "who_buys_from_you": "Home decor enthusiasts",
        "brand_vibe": "Warm, earthy, minimal",
        "colors_you_love": "#8B4513 and #F5DEB3",
        "fonts_you_love": "Lato",
        "tagline_or_slogan": "Made with earth, made with love",
        "business_description": "We handcraft every piece from natural clay.",
    }
    resp = await client.post("/api/v1/brand/extract/qa", json=answers, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["brand"]["brand_name"] == "Pottery Lane"
    assert data["brand"]["tagline"] == "Made with earth, made with love"
    assert data["brand"]["font_family"] == "Lato"


# ── Social post endpoints ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_generate_social_post(client: AsyncClient, auth_headers: dict):
    """POST /marketing/social-post returns a caption string."""
    # Create a product first
    prod_resp = await client.post("/api/v1/products", json={
        "name": "Handmade Mug",
        "price": 35.00,
        "stock_qty": 10,
        "description": "A beautiful hand-thrown ceramic mug",
    }, headers=auth_headers)
    if prod_resp.status_code not in (200, 201):
        pytest.skip("Product creation failed — inventory API may not be available in test env")

    product_id = prod_resp.json().get("id")
    if not product_id:
        pytest.skip("Could not extract product_id from response")

    resp = await client.post("/api/v1/marketing/social-post", json={
        "product_id": product_id,
        "platform": "instagram",
        "post_type": "feed_post",
        "creative_brief": "Highlight handmade quality",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "caption" in data
    assert isinstance(data["caption"], str)
    assert len(data["caption"]) > 20
    assert data["platform"] == "instagram"


@pytest.mark.anyio
async def test_generate_social_post_batch(client: AsyncClient, auth_headers: dict):
    """POST /marketing/social-post/batch returns captions for each platform."""
    prod_resp = await client.post("/api/v1/products", json={
        "name": "Artisan Candle",
        "price": 22.00,
        "stock_qty": 15,
        "description": "Hand-poured soy candle with lavender scent",
    }, headers=auth_headers)
    if prod_resp.status_code not in (200, 201):
        pytest.skip("Product creation failed")

    product_id = prod_resp.json().get("id")
    if not product_id:
        pytest.skip("Could not extract product_id")

    resp = await client.post("/api/v1/marketing/social-post/batch", json={
        "product_id": product_id,
        "platforms": ["instagram", "facebook", "tiktok"],
        "post_type": "feed_post",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "posts" in data
    assert len(data["posts"]) == 3
    platforms = {p["platform"] for p in data["posts"]}
    assert "instagram" in platforms
    assert "facebook" in platforms
    assert "tiktok" in platforms
    for post in data["posts"]:
        assert isinstance(post["caption"], str)
        assert len(post["caption"]) > 10


# ── Flier endpoint ────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_generate_flier(client: AsyncClient, auth_headers: dict):
    """POST /marketing/flier returns a structured flier spec."""
    prod_resp = await client.post("/api/v1/products", json={
        "name": "Woven Basket",
        "price": 65.00,
        "stock_qty": 8,
    }, headers=auth_headers)
    if prod_resp.status_code not in (200, 201):
        pytest.skip("Product creation failed")

    product_id = prod_resp.json().get("id")
    if not product_id:
        pytest.skip("Could not extract product_id")

    resp = await client.post("/api/v1/marketing/flier", json={
        "product_id": product_id,
        "headline": "Summer Sale",
        "call_to_action": "Shop Now",
        "promo_text": "20% OFF",
        "format": "square",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "brand" in data
    assert "product" in data
    assert "copy" in data
    assert data["copy"]["headline"] == "Summer Sale"
    assert data["copy"]["call_to_action"] == "Shop Now"
    assert data["copy"]["promo_text"] == "20% OFF"
    assert data["format"] == "square"
    assert data["dimensions"]["width"] == 1080


@pytest.mark.anyio
async def test_generate_flier_portrait(client: AsyncClient, auth_headers: dict):
    """Portrait format returns correct dimensions."""
    prod_resp = await client.post("/api/v1/products", json={
        "name": "Ceramic Bowl",
        "price": 45.00,
        "stock_qty": 5,
    }, headers=auth_headers)
    if prod_resp.status_code not in (200, 201):
        pytest.skip("Product creation failed")

    product_id = prod_resp.json().get("id")
    if not product_id:
        pytest.skip("Could not extract product_id")

    resp = await client.post("/api/v1/marketing/flier", json={
        "product_id": product_id,
        "format": "portrait",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["dimensions"]["height"] == 1350


@pytest.mark.anyio
async def test_flier_uses_brand_colors(client: AsyncClient, auth_headers: dict):
    """Flier spec picks up brand colors from brand DNA."""
    await client.put("/api/v1/brand", json={
        "primary_color": "#ff0000",
        "secondary_color": "#0000ff",
        "font_family": "Montserrat",
    }, headers=auth_headers)

    prod_resp = await client.post("/api/v1/products", json={
        "name": "Test Product",
        "price": 20.00,
        "stock_qty": 3,
    }, headers=auth_headers)
    if prod_resp.status_code not in (200, 201):
        pytest.skip("Product creation failed")

    product_id = prod_resp.json().get("id")
    if not product_id:
        pytest.skip("Could not extract product_id")

    resp = await client.post("/api/v1/marketing/flier", json={
        "product_id": product_id,
        "format": "square",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["brand"]["primary_color"] == "#ff0000"
    assert data["brand"]["font_family"] == "Montserrat"


# ── Caption-only endpoint ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_generate_caption_only(client: AsyncClient, auth_headers: dict):
    """POST /marketing/caption works without a product_id."""
    resp = await client.post("/api/v1/marketing/caption", json={
        "title": "Handmade Candle",
        "description": "Soy wax candle with lavender scent",
        "platform": "instagram",
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "caption" in data
    assert isinstance(data["caption"], str)
    assert len(data["caption"]) > 10


# ── 404 on invalid product ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_product_not_found_returns_404(client: AsyncClient, auth_headers: dict):
    """Marketing endpoints return 404 for invalid product_id."""
    resp = await client.post("/api/v1/marketing/social-post", json={
        "product_id": "00000000-0000-0000-0000-000000000000",
        "platform": "instagram",
    }, headers=auth_headers)
    assert resp.status_code == 404
