# Product Catalog Ingestion Agent

## Summary
Add multi-modal product ingestion capability to the Product Manager agent, supporting both image-based and CSV-based product catalog import with AI enrichment.

## Desired Behavior
- Product Manager agent can ingest products via:
  - Images + text (extract product details from photos)
  - CSV files (auto-detect column structure)
- For image input:
  - Extract product information from image using vision AI
  - Detect multiple items in single image
  - Detect variants of same product across images
  - Support multiple images of different items in one batch
  - AI generates product description from image
  - User provides price and quantity via text
- For CSV input:
  - Auto-detect CSV column structure
  - Map columns to product fields intelligently
  - Process entire file in batch
- AI enrichment (always active):
  - Generate/enhance product descriptions
  - Create relevant tags automatically
- Validation:
  - Required fields: name, price, quantity, description, unique_id
  - No duplicate unique_id (hard constraint)
  - SKU optional but no duplicates if provided
  - Price, stock, SKU come from user input
- Variant handling:
  - Variants attach to parent products
  - Detect variants from images (size, color variations)
  - Link variants correctly

## Scope
- Image-based ingestion with vision AI
- CSV-based bulk import
- Duplicate detection and prevention
- AI description generation
- AI tag generation
- Multi-item detection in images
- Variant detection and linking
- Integration with existing Product Manager agent
- Tenant-scoped (products belong to authenticated artisan)

## Non-Goals
- External API integrations (Etsy, Shopify) - v2
- Facebook reverse sync - v2
- Custom report generation during import
- Email notifications about imports

## Scenarios
- **Image single item**: Artisan uploads photo of handmade soap, says "price $12, quantity 25", agent extracts product details, generates description, creates tags, imports product
- **Image multiple items**: Artisan uploads photo with 3 different products, agent detects each, prompts for price/quantity for each, imports all 3
- **Image variants**: Artisan uploads 3 photos of same candle in different colors, agent detects variants, links them to parent product
- **CSV bulk**: Artisan uploads CSV with 50 products, agent detects column structure, validates all rows, imports batch, reports success/failures
- **Duplicate prevention**: Artisan tries to import product with existing unique_id, agent rejects with clear error
- **SKU duplicate**: Artisan imports product with duplicate SKU, agent rejects
- **Missing required field**: CSV row missing price, agent skips row and reports error
- **AI enrichment**: Basic description "soap" becomes "Handmade artisan lavender soap with natural ingredients, perfect for sensitive skin"

## Constraints
- Must use existing Product, ProductVariant models
- Must respect tenant isolation (tenant_id scoping)
- Vision AI must use available model (GPT-4 Vision or Claude with vision)
- Tag generation should use structured output
- CSV parsing must handle common formats (comma, tab, pipe delimited)
- Images must be reasonably sized (handle resizing if needed)
- Batch imports should provide progress feedback
- Must maintain existing Product Manager agent capabilities

## Implementation Routing
- Required skills: coding-python-backend, coding-proof-author, coding-feature-execute
- Vision AI: Use existing LangChain + OpenAI/Anthropic integration
- Image processing: Pillow for image handling
- CSV parsing: pandas for CSV detection and parsing
- Tag generation: Structured output from LLM
- Duplicate detection: Database queries on unique_id and sku fields
