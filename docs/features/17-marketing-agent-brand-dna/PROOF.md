# Proof — Marketing Agent: Brand DNA, Social Posts & Fliers

## Primary Proof Command

```bash
pytest backend/tests/test_marketing_agent.py -v
```

## What It Verifies

### Backend unit tests (`test_marketing_agent.py`)
1. `brand_dna` table exists and migration runs
2. `GET /api/v1/brand` returns empty brand for new tenant
3. `PUT /api/v1/brand` saves and returns all fields
4. `POST /api/v1/brand/extract/qa` maps Q&A answers to brand fields
5. `POST /api/v1/marketing/social-post` returns a caption string
6. `POST /api/v1/marketing/social-post/batch` returns captions for multiple platforms
7. `POST /api/v1/marketing/flier` returns a spec with brand, product, copy, and style keys
8. Marketer agent `get_brand_dna` tool returns brand fields
9. Marketer agent `generate_social_post` tool calls through to caption generator
10. Marketer agent `generate_flier` tool returns spec

### Manual verification
- Visit `/brand` → BrandSetupCard loads with 4 tabs
- Paste a URL and click Extract → fields populate
- Switch to Voice tab → select tone adjectives → save
- Visit `/marketing` → select a product → generate posts → preview renders per platform
- Visit `/marketing` → generate flier → canvas renders with brand colors and font
- Open Marketer agent → type "make posts for [product name]" → social_post_preview card renders in chat
- Open Marketer agent → type "make a flier for [product name]" → flier_preview card renders in chat
