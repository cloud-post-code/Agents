# Proof Plan

## Definition Of Done

- `tenant_business_profile`, `orders`, `order_line_items`, and `order_shipping` tables exist in PostgreSQL after `alembic upgrade head` with RLS enabled on all four.
- `GET /api/v1/admin/profile` returns an auto-created empty profile for a new tenant; calling it twice returns the same record id.
- `POST /api/v1/admin/orders/draft` creates a pending task row and zero rows in `orders`.
- `GET /api/v1/admin/orders` returns orders filtered by status; returns empty list when no orders exist.
- `GET /api/v1/admin/revenue` returns zero totals for an empty period; correctly aggregates `unit_price_cents * quantity` for `completed` orders only within the requested date range.
- Tenant B cannot see Tenant A's orders, line items, or business profile (raw RLS tests and API isolation tests both pass).
- Admin WebSocket chat emits at least one `{type: "a2ui", surface: ..., components: [...]}` frame when the agent calls `render_ui`; the `{type: "done"}` frame still arrives after the `a2ui` frame.
- All five Admin A2UI surface components (`InvoiceCard`, `BusinessProfileCard`, `ShippingPolicyCard`, `OrdersTable`, `RevenueSummaryCard`) render without crash with representative props.
- Cross-agent fragments are still redacted when `agentRole="admin"` is used.

## Primary Proof

Type: integration (backend API + WS + real PostgreSQL test DB) + component (frontend Vitest)

### Backend proof command
```bash
cd artisan-platform && pytest backend/tests/test_admin_agent.py -v
```

### Frontend proof command
```bash
cd artisan-platform/frontend && npx vitest run src/components/a2ui/surfaces/
```

Expected evidence — backend:
- `test_new_tables_exist` — PASSED × 4 tables
- `test_new_tables_have_rls` — PASSED × 4 tables
- `test_get_profile_auto_creates` — PASSED (200, `business_name` key present)
- `test_get_profile_idempotent` — PASSED (same `id` on second call)
- `test_profile_tenant_isolation` — PASSED (tenant A and B have different profile ids)
- `test_create_order_draft_creates_task` — PASSED (201, `task_id` present, `status == "pending"`)
- `test_create_order_draft_does_not_create_order_row` — PASSED (`COUNT(*) FROM orders == 0`)
- `test_list_orders_empty` — PASSED (200, `items == []`)
- `test_list_orders_with_data` — PASSED (seeded order id appears in response)
- `test_list_orders_status_filter` — PASSED (shipped order present, pending order absent)
- `test_orders_tenant_isolation` — PASSED (tenant B sees empty list)
- `test_revenue_summary_empty_period` — PASSED (`total_orders == 0`, `total_revenue_cents == 0`)
- `test_revenue_summary_aggregates_completed_orders` — PASSED (`total_revenue_cents == 5400`)
- `test_revenue_excludes_non_completed_orders` — PASSED (`total_revenue_cents == 0`)
- `test_admin_ws_emits_a2ui_frame` — PASSED (≥1 frame with `type == "a2ui"`, `surface` and `components` keys)
- `test_admin_ws_a2ui_does_not_break_done` — PASSED (`"done"` in received types)
- `test_order_line_items_tenant_isolation` — PASSED (line item invisible under tenant B RLS context)
- `test_business_profile_tenant_isolation_raw` — PASSED (profile row invisible under tenant B RLS context)

Expected evidence — frontend:
- All `InvoiceCard` tests pass (id, customer, status, line item, total rendered)
- All `BusinessProfileCard` tests pass (name, entity type, address, contact rendered)
- All `ShippingPolicyCard` tests pass (policy text, flat rate rendered; no crash on missing optional props)
- All `OrdersTable` tests pass (ids, customer names, status pills; empty state message)
- All `RevenueSummaryCard` tests pass (order count, revenue, zero state)
- All `A2UISurface` integration tests pass (InvoiceCard and RevenueSummaryCard render; cross-agent fragment redacted; BusinessProfileCard renders)

Secondary guards:
- `alembic upgrade head && alembic check` — no pending migrations
- TypeScript `tsc --noEmit` — zero errors in `frontend/src/components/a2ui/surfaces/`

## Environment And Data

- Local PostgreSQL test DB: `postgresql://postgres:postgres@localhost:5434/artisan_test` (per `conftest.py`)
- Test DB must have migrations applied: `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/artisan_test alembic upgrade head`
- Docker Compose postgres service running: `docker compose up -d postgres`
- No real orders needed — tests seed directly via DB fixtures or create via API
- Frontend: Node.js ≥20, `npm install` run in `/frontend`; React Testing Library + Vitest configured

## Anti-Gaming Constraints

- Backend tests must NOT mock the database — all queries hit real PostgreSQL with RLS enforced.
- RLS isolation tests must use the real `SET app.tenant_id` mechanism — not Python-level filtering.
- `test_create_order_draft_does_not_create_order_row` must query the real `orders` table row count, not check the API response alone.
- `test_admin_ws_emits_a2ui_frame` must receive the actual WebSocket frame over the ASGI transport — the test must not inspect agent internals or tool return values directly.
- Frontend tests must `render()` the real surface components — no snapshot-only assertions.

## Repo Safety Gate

Command:
```bash
$HOME/.claude/scripts/gate
```

## Manual Gaps

- Live A2UI rendering in browser: after implementing `AgentShell` A2UI frame handling, manually open the Admin chat, send "Show me my business profile", and verify the `BusinessProfileCard` renders inline in the chat thread (not as raw JSON or invisible).
- Reason: the WebSocket A2UI frame test proves the frame is emitted; the browser render confirms the `AgentShell.tsx` client-side handler correctly mounts `A2UISurface` inline.
