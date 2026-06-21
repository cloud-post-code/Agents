# Admin Agent — Full Wiring

## Summary

Wire the Admin agent end-to-end: introduce the `tenant_business_profile`, `orders`, `order_line_items`, and `order_shipping` tables with RLS; replace stub Admin tools with real async DB queries; add Admin-specific A2UI surface components (InvoiceCard, BusinessProfileCard, ShippingPolicyCard, OrdersTable, RevenueSummaryCard); and fix the WebSocket handler and frontend `AgentShell` so `{type: "a2ui"}` payloads emitted by `render_ui` actually render inline in chat.

## Desired Behavior

- Admin agent calling `get_business_profile` returns the tenant's real business profile data (name, description, entity type, address, contact info, shipping config, policies).
- Admin agent calling `get_orders` returns real orders from the DB, filterable by status and date range, including line items and shipping details.
- Admin agent calling `create_order_draft` creates a pending approval task (via the existing task queue) describing the new order; no order row is written until a human approves.
- Admin agent calling `get_revenue_summary` returns aggregated revenue totals from completed orders for a requested period.
- When Admin agent calls `render_ui`, the backend sends `{type: "a2ui", surface: ..., components: [...]}` over the WebSocket.
- Frontend `AgentShell` receives `{type: "a2ui"}` frames and renders them inline in the chat thread using `A2UISurface` with `agentRole="admin"`.
- A2UI surfaces `InvoiceCard`, `BusinessProfileCard`, `ShippingPolicyCard`, `OrdersTable`, and `RevenueSummaryCard` compose from the existing fragment catalog and render correctly in the Admin chat.
- Tenant isolation is enforced: one tenant cannot read another tenant's orders, profile, or revenue data.

## Scope

### Database
- `tenant_business_profile` table: one row per tenant — `id`, `tenant_id` (unique), `business_name`, `shop_description`, `entity_type` (enum: `sole_proprietor`, `llc`, `partnership`, `corporation`, `other`), `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `contact_email`, `contact_phone`, `website`, `shipping_policy`, `cancellation_policy`, `shipping_flat_rate_cents` (nullable), `shipping_weight_tiers` (JSONB, nullable — array of `{max_weight_g, rate_cents}`), `shipping_free_threshold_cents` (nullable), `created_at`, `updated_at`.
- `orders` table: `id`, `tenant_id`, `customer_name`, `customer_address_line1`, `customer_address_line2`, `customer_city`, `customer_state`, `customer_postal_code`, `customer_country`, `status` (enum: `pending`, `shipped`, `completed`, `cancelled`), `notes`, `created_at`, `updated_at`.
- `order_line_items` table: `id`, `order_id`, `tenant_id`, `product_id` (FK to products, nullable — allows custom line items), `description`, `quantity`, `unit_price_cents`, `created_at`.
- `order_shipping` table: `id`, `order_id` (unique — one shipping record per order), `tenant_id`, `carrier`, `tracking_number`, `shipping_cost_cents`, `shipped_at`, `created_at`.
- Alembic migration for all four tables; RLS enabled on all four.

### Backend — Admin Tools
- `get_business_profile(tenant_id)` → queries `tenant_business_profile`, returns Pydantic model; auto-creates empty profile row if none exists.
- `get_orders(tenant_id, status=None, from_date=None, to_date=None, limit=20)` → queries orders + line items + shipping, returns list of order models.
- `create_order_draft(customer_name, customer_address, line_items, notes="")` → calls `create_task` with a structured description; does not write to `orders` directly; returns the task id.
- `get_revenue_summary(tenant_id, from_date, to_date)` → aggregates sum of `unit_price_cents * quantity` from `order_line_items` joined to completed orders in the date range; returns `{total_orders, total_revenue_cents, avg_order_value_cents, period_start, period_end}`.

### Backend — WebSocket A2UI streaming
- `ws_agent.py`: after streaming text tokens, detect tool call results from the agent. When the agent invokes `render_ui`, send a `{type: "a2ui", surface: <surface_name>, components: [...]}` frame over the WebSocket before the `{type: "done"}` frame.
- The `render_ui` tool's return value contains `component` and `props`; the WS handler must serialise this as an A2UI payload.

### Frontend — AgentShell A2UI handling
- `AgentShell.tsx`: handle `{type: "a2ui"}` WebSocket frames; append an A2UI message to the chat thread.
- Render the A2UI message using `<A2UISurface surface={...} components={...} agentRole={agent.role} />` in the message list alongside text bubbles.

### Frontend — New A2UI Surface Components
- `InvoiceCard` (`frontend/src/components/a2ui/surfaces/InvoiceCard.tsx`): order id, customer name, status pill, date label, line items table (description, qty, unit price), total amount. Uses: `OrderRow`, `LineItemRow`, `StatusPill`, `DateLabel`, `CurrencyAmount`, `Table`.
- `BusinessProfileCard` (`surfaces/BusinessProfileCard.tsx`): business name, entity type, address block, contact email/phone/website, a summary panel. Uses: `SummaryPanel`, `StatRow`.
- `ShippingPolicyCard` (`surfaces/ShippingPolicyCard.tsx`): shipping policy text, cancellation policy text, flat rate, free-threshold note. Uses: `SummaryPanel`, `StatRow`, `CurrencyAmount`.
- `OrdersTable` (`surfaces/OrdersTable.tsx`): table of orders — order id, customer name, status, total, date. Uses: `Table`, `OrderRow`, `StatusPill`, `DateLabel`, `CurrencyAmount`.
- `RevenueSummaryCard` (`surfaces/RevenueSummaryCard.tsx`): KPI stat rows — total orders, total revenue, avg order value, period. Uses: `SummaryPanel`, `StatRow`, `CurrencyAmount`.
- All five registered in `A2UISurface.tsx` renderer and in the admin catalog entry.

## Non-Goals

- Order entry UI page (CRUD UI for orders is a separate feature; Admin agent can create drafts via chat only).
- Business profile settings page (profile is writable via a future settings feature; Admin agent reads only).
- Expense tracking (separate from revenue; not in scope for this feature).
- Invoice PDF generation (Admin report templates already cover this in feature 13).
- Shipment carrier API integration (tracking number is stored but not polled).
- Order editing or cancellation via agent chat (create draft only in v1).

## Scenarios

**Happy path — business profile query:**
- Artisan asks Admin: "What's my current shipping policy?"
- Agent calls `get_business_profile`, calls `render_ui` with a `ShippingPolicyCard`.
- WebSocket emits `{type: "a2ui", surface: "shipping_policy", components: [...]}`.
- Frontend renders `ShippingPolicyCard` inline in the chat thread.

**Happy path — order list:**
- Artisan asks Admin: "Show me pending orders."
- Agent calls `get_orders(status="pending")`, calls `render_ui` with an `OrdersTable`.
- Frontend renders the orders table inline; each order row shows customer name, total, status pill.

**Happy path — new order draft:**
- Artisan says: "Add an order for Jane Smith, 2 mugs at $18 each."
- Agent calls `create_order_draft`, a pending task appears in the task queue.
- Agent responds: "I've created a draft order for Jane Smith — approve it in your task queue to save it."

**Happy path — revenue summary:**
- Artisan asks: "How much revenue did I make this month?"
- Agent calls `get_revenue_summary`, calls `render_ui` with a `RevenueSummaryCard`.
- Card shows total orders, total revenue, avg order value for the current month.

**Edge case — no business profile yet:**
- First-time tenant has no profile row; `get_business_profile` auto-creates an empty profile and returns it; agent tells user to fill in their profile settings.

**Edge case — no orders:**
- `get_orders` returns empty list; agent says "No orders found for that filter."

**Tenant isolation:**
- Tenant A's orders are invisible to Tenant B; cross-tenant queries return empty result, not an error leak.

**A2UI type not in admin catalog:**
- If agent attempts to render a fragment not in the admin catalog (e.g. `MarketInsightChart`), `A2UISurface` renders `RedactedFragment` — does not crash.

## Constraints

- All new tables follow RLS pattern: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- Admin tools are `async` functions; DB session injected via dependency, not instantiated in tool body.
- `create_order_draft` must go through the existing task approval flow — it never writes directly to `orders`.
- Monetary values stored as integer cents; display formatting handled in frontend components.
- `order_shipping` is one-to-one per order (unique constraint on `order_id`).
- A2UI surface component files live in `frontend/src/components/a2ui/surfaces/`; they compose existing atoms and rows — no new atoms or rows added in this feature.
- `AgentShell.tsx` must handle `{type: "a2ui"}` without breaking existing `token` / `done` / `error` / `session_id` handling.
- Alembic migration must be a single new revision that does not modify existing tables.

## Implementation Routing

- Required skills: coding-python-backend, coding-frontend, coding-proof-author
