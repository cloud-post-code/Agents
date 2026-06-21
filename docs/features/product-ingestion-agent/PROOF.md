# Proof Plan - Product Ingestion Agent

## Definition Of Done
- Product Manager agent can accept image + text input and create products
- Agent extracts product details from images using vision AI
- Agent detects multiple products in single image
- Agent detects product variants across multiple images
- Agent accepts CSV files and auto-detects structure
- Agent generates descriptions from images using AI
- Agent generates tags for all products using AI
- Agent validates required fields (name, price, quantity, description, unique_id)
- Agent prevents duplicate unique_id
- Agent prevents duplicate SKU (when SKU provided)
- Variants are correctly linked to parent products
- All products are tenant-scoped

## Primary Proof
Type: integration + api

Command:
```bash
/Users/christophermauri/Auto_Business/artisan-platform/docs/features/product-ingestion-agent/proof/run.sh
```

Expected evidence:
- test_ingest_single_product_from_image: PASS
- test_ingest_multiple_products_from_image: PASS
- test_ingest_product_variants_from_images: PASS
- test_ingest_products_from_csv: PASS
- test_csv_auto_detection: PASS
- test_duplicate_unique_id_rejected: PASS
- test_duplicate_sku_rejected: PASS
- test_ai_description_generation: PASS
- test_ai_tag_generation: PASS
- test_required_field_validation: PASS
- test_tenant_isolation: PASS
- Vision AI integration functional
- CSV parsing functional
- Database records created correctly
- Variants linked to products

Secondary guards:
- Type checking: /Users/christophermauri/Auto_Business/artisan-platform/backend/.venv/bin/python -m mypy backend/app/
- Linting: /Users/christophermauri/Auto_Business/artisan-platform/backend/.venv/bin/python -m ruff check backend/app/
- Format: /Users/christophermauri/Auto_Business/artisan-platform/backend/.venv/bin/python -m ruff format --check backend/app/

## Environment And Data
- PostgreSQL database with products, product_variants tables
- Vision AI model (GPT-4 Vision or Claude with vision capabilities)
- Test images in proof/fixtures/images/
- Test CSV files in proof/fixtures/csv/
- Authenticated tenant context (test tenants)
- FastAPI test client for API calls
- Mock vision AI responses for deterministic tests

## Anti-Gaming Constraints
- Must call actual vision AI API (not mocked descriptions)
- Must actually parse CSV files (not hardcoded results)
- Must actually query database for duplicates
- Must verify tenant_id on all created records
- Cannot skip validation checks

## Repo Safety Gate
Command:
```bash
~/.zeroclaw/scripts/gate
```

## Manual Gaps
- Visual inspection of generated descriptions for quality
- Manual review of tags for relevance
- Testing with very large CSV files (>10MB) - performance validation
