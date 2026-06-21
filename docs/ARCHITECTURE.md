# Architecture

## Service Map

```
GitHub Repo (monorepo)
├── /frontend     → Railway service: Next.js 15 App Router
├── /backend      → Railway service: FastAPI (Python 3.12)
├── /worker       → Railway service: Celery worker (reuses /backend image, CMD override)
├── Railway: PostgreSQL 16
└── Railway: Redis
```

File artifacts (PDF/HTML reports) are stored on a Railway Volume in dev and Cloudflare R2 in prod.

## Frontend

- **Framework:** Next.js 15 App Router
- **Agent UI:** CopilotKit AG-UI — handles WebSocket chat, streaming tokens, and `useFrontendTool` hook for A2UI surface rendering
- **A2UI renderer:** Mounted as a React component tree; agent `render_ui` tool calls are mapped to named surface compositions
- **Server Components:** Report archive, calendar, task queue, notification feed pages
- **Client Components:** Chat interfaces, A2UI surfaces, notification badge

## Backend

- **Framework:** FastAPI (async)
- **Agent framework:** LangGraph — one compiled subgraph per agent role, shared graph structure via `BaseArtisanAgent`
- **ORM:** SQLAlchemy (async) with Alembic migrations
- **Streaming:** WebSocket for chat (`/ws/agent/{role}/chat`), SSE for notifications (`/api/events/stream`)
- **Task execution:** Celery with Redis broker; Celery Beat for scheduled report generation
- **PDF generation:** WeasyPrint — Jinja2 HTML templates → PDF bytes

## Database

- **Engine:** PostgreSQL 16 + pgvector extension
- **Isolation:** Row Level Security on every tenant-scoped table; `FORCE ROW LEVEL SECURITY`
- **RLS pattern:** `USING (tenant_id = current_setting('app.tenant_id')::uuid)`
- **Tenant context:** Set by FastAPI middleware from authenticated session before every DB operation — never from request body
- **Semantic search:** pgvector on `products.embedding` for catalog search

## Agent Architecture

```
/backend/app/agents/
  base.py           — BaseArtisanAgent: shared LangGraph graph, shared tools, interrupt node
  strategist.py     — tools, system prompt, A2UI catalog
  product_manager.py
  marketer.py
  admin.py
  registry.py       — {role: AgentClass} instantiated per request

/backend/app/tools/
  shared/           — create_task, render_ui, generate_report, search_catalog
  strategist/       — get_market_trends, analyze_pricing, find_suppliers, generate_forecast
  product_manager/  — update_inventory, manage_catalog, manage_suppliers, track_materials
  marketer/         — generate_seo, optimize_listing, analyze_channel, manage_campaign
  admin/            — get_financials, get_shipping, manage_expenses, approve_task
```

All agents run in the same FastAPI process. LangGraph persists graph state (checkpoints) to PostgreSQL, enabling human-in-the-loop interrupts: when an agent creates a task requiring approval, the graph suspends and resumes when the human approves via the API.

## Data Flow: Agent Chat with A2UI

```
1. User message → WebSocket → FastAPI
2. FastAPI invokes LangGraph subgraph (streaming)
3. LangGraph streams:
   a. Text tokens → {type: "token", content: "..."} over WebSocket
   b. Tool call render_ui → validated against Pydantic catalog schema
      → {type: "a2ui", payload: ...} over WebSocket
   c. Tool call create_task → DB write + graph interrupt
4. Frontend:
   a. Tokens → appended to chat bubble
   b. A2UI payload → CopilotKit useFrontendTool → A2UI surface rendered inline
   c. Task created → SSE push to notification feed
```

## Data Flow: Report Generation

```
1. Agent calls generate_report tool
2. FastAPI enqueues Celery task, returns {task_id, estimated_seconds}
3. Chat shows "Generating report, I'll notify you when ready"
4. Celery worker:
   a. Queries DB for report data
   b. LLM synthesis pass
   c. Jinja2 → HTML → WeasyPrint → PDF
   d. Writes to Railway Volume / R2
   e. Updates reports table, publishes "report_ready" to Redis pub/sub
5. FastAPI SSE → browser notification → report archive link
```

## Key Schema Tables

```sql
tenants          — id, slug, display_name, plan_tier, created_at, onboarded_at
users            — id, tenant_id, email, password_hash, role, created_at
products         — id, tenant_id, name, sku, description, price, cost, stock_qty, metadata JSONB, embedding vector(1536)
agent_sessions   — id, tenant_id, agent_role, title, created_at
agent_messages   — id, session_id, tenant_id, role, content, tool_calls JSONB, a2ui_surfaces JSONB
tasks            — id, tenant_id, created_by, assigned_to, title, status, priority, due_at, celery_task_id, output JSONB
task_approvals   — id, task_id, action, reason, decided_at
reports          — id, tenant_id, generated_by, title, format, storage_url, size_bytes, metadata JSONB
calendar_events  — id, tenant_id, created_by, title, starts_at, ends_at, related_task_id
notifications    — id, tenant_id, type, payload JSONB, report_id, read_at, created_at
integrations     — id, tenant_id, type, label, credentials JSONB, enabled
```

## A2UI Component Catalog

Agents assemble surfaces from atomic fragments. Three tiers:

1. **Atomic fragments (27):** PriceTag, CurrencyAmount, PercentChange, MarginPill, StockBadge, StatusPill, TrendArrow, ApprovalTag, FulfillmentDot, PriorityFlag, DelayWarning, AvatarChip, AgentBadge, SupplierTag, ChannelBadge, CustomerTier, DateLabel, DueBadge, LeadTimePill, SeasonTag, QuantityCount, RatingStars, ConversionRate, ScoreBadge, UnitsSold, CostBreakdown, RevenueBar
2. **Row fragments (15):** ProductRow, VariantRow, MaterialRow, OrderRow, LineItemRow, ReturnRow, TaskRow, ExpenseRow, SupplierRow, ChannelRow, ListingRow, CampaignRow, MetricRow, ForecastRow, CompetitorRow
3. **Section containers (8):** Table, GroupedTable, CardGrid, StatRow, TimelineList, ApprovalBlock, CompareGrid, SummaryPanel
4. **Named surfaces (8):** SURFACE:inventory, SURFACE:orders, SURFACE:financials, SURFACE:suppliers, SURFACE:channels, SURFACE:campaigns, SURFACE:strategy, SURFACE:tasks

Composition rules: max 3 nesting levels, fragment ownership = access control (cross-agent fragments render as [Redacted]), ApprovalBlock degrades to Table without ApprovalTag children.

## Deployment

```
Railway project
├── frontend service   (root: /frontend, builder: nixpacks)
├── backend service    (root: /backend, builder: nixpacks)
├── worker service     (root: /backend, builder: nixpacks, start: celery -A app.worker worker)
├── beat service       (root: /backend, start: celery -A app.worker beat)
├── PostgreSQL plugin
└── Redis plugin
```

Environment variables set in Railway, pulled via `railway run` locally. Private networking between services via Railway's internal DNS (`backend.railway.internal`).

Report files: Railway Volume mounted at `/app/reports` in dev; boto3 to Cloudflare R2 in prod (same interface, env-switched).

## Conventions

- See `docs/CONVENTIONS.md` for naming, API patterns, and code style.
- See `docs/TESTING.md` for test strategy and proof command patterns.
