# Feature: Facebook Inventory Sync v1

## What to Build

One-way sync from the platform (source of truth) to Facebook Commerce Manager. Products created/updated/deleted in the platform push to Facebook.

### Facebook API

- Facebook Catalog API (part of Facebook Commerce Manager)
- OAuth flow: artisan connects their Facebook Business account via `/settings/integrations`
- Credentials stored encrypted in `integrations` table (`type='facebook'`)
- Scope required: `catalog_management`, `business_management`

### Sync Behavior

- **Platform is source of truth** — Facebook never pushes to platform
- On product create/update in platform → push to Facebook catalog (async via Celery)
- On product delete (soft) → remove from Facebook catalog
- Sync is eventual — products queue to Celery, not real-time
- Celery task: `sync_product_to_facebook(product_id, tenant_id)`

### Error Handling

- On sync failure (rate limit, auth expiry, API error):
  - Log error to `integration_sync_errors` table: `{tenant_id, product_id, error_code, error_message, attempted_at, retry_count}`
  - Write `sync_error` notification (shows banner in UI)
  - Retry up to 3 times with exponential backoff (Celery retry)
  - After 3 failures: mark product sync status as `failed`, stop retrying, notify user
- Banner UI: "Facebook sync failed for 3 products — [Retry] [Details]"
- "Retry" button triggers manual re-sync for all failed products

### New Tables

```sql
integration_sync_errors
  id, tenant_id, integration_id, product_id, error_code, error_message
  retry_count, attempted_at, resolved_at

product_sync_status
  id, tenant_id, product_id, integration_id, status (synced/pending/failed/not_connected)
  last_synced_at, facebook_catalog_item_id
```

### Settings Page

- `/settings/integrations` — list of integrations; Facebook shown with Connect button
- OAuth connect flow → Facebook login → callback → save credentials
- After connect: shows sync status (synced / pending / failed counts)
- Disconnect button: removes credentials from DB, marks all `product_sync_status` as `not_connected`

### Frontend

- Integration status chip on ProductRow: green dot (synced), yellow (pending), red (failed)
- Failed sync products highlighted with `DelayWarning` atom in inventory list
- Sync error notification uses `sync_error` notification type → navigates to `/settings/integrations`

## Out of Scope

- Etsy, Shopify, or any other platform sync (next after this feature ships)
- Pulling orders from Facebook into platform (v2)
- Automatic Facebook ad creation (v2)
