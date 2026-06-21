# Feature: Inventory Core

## What to Build

Core product catalog and inventory management — CRUD for products and variants, stock tracking, and the Product Manager agent's live tools wired to real DB operations.

### Backend — API Endpoints

- `GET /api/v1/products` — paginated list; filterable by `low_stock=true`, `search=query`
- `POST /api/v1/products` — create product
- `GET /api/v1/products/{id}` — product detail with variants
- `PATCH /api/v1/products/{id}` — update product
- `DELETE /api/v1/products/{id}` — soft delete (sets `deleted_at`)
- `POST /api/v1/products/{id}/variants` — add variant
- `PATCH /api/v1/products/{id}/variants/{variant_id}` — update variant
- `POST /api/v1/products/{id}/stock-adjustment` — adjust stock with reason: `{delta, reason}` (positive = restock, negative = sale/shrinkage)

### Backend — Product Manager Agent Tools (real implementations)

- `update_inventory(product_id, delta, reason)` — calls stock-adjustment endpoint, creates task if delta > 50 units (requires approval)
- `manage_catalog(action, product_data)` — create/update products; always creates task for approval before writing
- `search_catalog(query)` — pgvector semantic search over `products.embedding`; returns top 10 matches

### Inventory Schema

```sql
products
  id, tenant_id, name, sku (unique per tenant), description
  price NUMERIC(10,2), cost NUMERIC(10,2)
  stock_qty INTEGER, reorder_point INTEGER DEFAULT 5
  metadata JSONB  -- tags, materials, dimensions, channel data
  embedding vector(1536)
  deleted_at TIMESTAMPTZ  -- soft delete
  created_at, updated_at

product_variants
  id, tenant_id, product_id, name, sku, price, cost, stock_qty, metadata JSONB
  created_at, updated_at

stock_adjustments
  id, tenant_id, product_id, variant_id, delta, reason, created_by, created_at
```

### Stock Alert Logic

When `stock_qty <= reorder_point` after any adjustment:
- Write a `notification` of type `low_stock`
- Create a task (status=pending) for the Product Manager: "Reorder {product_name} — {stock_qty} units remaining"

### Frontend — Inventory Page

- `/inventory` route added to sidebar
- Product list: `SURFACE:inventory` (StatRow totals + Table[ProductRow+VariantRow] + SummaryPanel)
- Clicking ProductRow expands VariantRow children inline
- Quick stock adjustment: `+` / `-` stepper inline on ProductRow; large adjustments trigger approval flow
- "Add Product" button → slide-over form
- Low stock filter tab
- Search bar (semantic search via pgvector)
- Product Manager chat: asking about inventory renders `SURFACE:inventory` inline

## Out of Scope

- Facebook sync (feature 11)
- Supplier management (deferred — no supplier feature in v1 spec)
- Materials/COGS auto-calculation (deferred)
- Bulk CSV import (v2)
