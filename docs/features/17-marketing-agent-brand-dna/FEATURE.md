# Feature: Marketing Agent — Brand DNA, Social Posts & Fliers

## Summary

Extends the Marketer agent with a full brand identity system and two content generation tools: social media captions and branded fliers. Users can populate their Brand DNA from a website URL, file upload, or Q&A interview, then generate on-brand content for any catalog product with one command to the Marketer agent or via the Marketing Studio page.

## User Stories

### Brand DNA Setup
- As an artisan, I can paste my website URL and have my brand identity extracted automatically (name, colors, fonts, tone, voice).
- As an artisan, I can upload a PDF, DOCX, image, or text file describing my brand and have it parsed.
- As an artisan, I can answer 6 high-level questions about my business and have a brand profile created for me — without filling in one field at a time.
- As an artisan, I can manually edit any brand field (name, tagline, colors, fonts, voice, visual style) from the Brand DNA page.

### Social Media Posts
- As an artisan, I can tell the Marketer "make posts for [product]" and get expert captions for Instagram, Facebook, and TikTok in one shot.
- As an artisan, the Marketer uses my brand voice, tone adjectives, and writing style to craft each caption.
- As an artisan, I can copy any caption to my clipboard directly from the preview card.
- As an artisan, I can use the Marketing Studio page to pick platforms and add a creative brief without using the chat.

### Fliers
- As an artisan, I can ask the Marketer to "make a flier for [product]" and get a branded visual spec rendered inline.
- As an artisan, the flier uses my brand colors, Google Font, logo, and copy style automatically.
- As an artisan, I can set a headline, CTA, promo banner, and format (square, portrait, landscape).
- As an artisan, the flier spec can be exported to Canva/Figma.

## Acceptance Criteria

### Backend
- `GET/PUT /api/v1/brand` — retrieve and upsert brand DNA for the current tenant
- `POST /api/v1/brand/extract/url` — scrape a URL and LLM-extract brand fields
- `POST /api/v1/brand/extract/file` — parse uploaded file (PDF, DOCX, TXT, image) and extract brand fields
- `POST /api/v1/brand/extract/qa` — convert Q&A answers into brand fields
- `POST /api/v1/marketing/social-post` — single-platform caption generation
- `POST /api/v1/marketing/social-post/batch` — multi-platform caption generation
- `POST /api/v1/marketing/flier` — branded flier spec generation
- `POST /api/v1/marketing/caption` — caption without requiring a product_id
- `brand_dna` table with migration
- Marketer agent gets `get_brand_dna`, `generate_social_post`, `generate_social_post_batch`, `generate_flier`, `search_catalog` tools
- All tool executions routed through `_execute_tool` in `ArtisanAgent`

### Frontend
- `BrandSetupCard` — tabbed card (Identity / Voice / Visual / Source) with inline field editing, color pickers, Google Font selector, tone pill selector, Q&A mode, URL extraction, and file upload
- `SocialPostPreviewCard` — platform-tabbed post preview with product image mock, caption display, per-post copy button, and Copy All
- `FlierPreviewCard` — live branded flier canvas using brand colors and Google Font, with promo badge, CTA button, logo, and design tip
- `/brand` page with `BrandSetupCard` and usage explainer
- `/marketing` Marketing Studio page with product picker, platform/format config, and output preview
- New sidebar nav items: Brand DNA and Marketing
- `brand_setup`, `social_post_preview`, `flier_preview` surfaces wired in `AgentShell`

### Copywriter Prompt
- All social post captions generated using the expert e-commerce copywriter prompt template
- Brand DNA (tone, voice, audience, writing style) injected as context
- Platform-specific formatting rules applied per channel

## Out of Scope
- Actual image generation (captions only; flier is a spec for Canva/Figma)
- Scheduling posts to social platforms
- Analytics/performance tracking for posts
- Multi-image carousel generation
