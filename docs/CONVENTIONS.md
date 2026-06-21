# Conventions

## API

- All routes are prefixed `/api/v1/`
- WebSocket routes: `/ws/agent/{role}/chat`
- SSE route: `/api/events/stream`
- Route handlers never accept `tenant_id` from request body or query params — always from session
- HTTP errors use RFC 7807 problem detail format: `{type, title, status, detail}`
- All timestamps are UTC, stored as `TIMESTAMPTZ`, serialized as ISO 8601

## Database

- Table names: plural snake_case (`agent_messages`, `calendar_events`)
- Primary keys: `UUID` generated with `gen_random_uuid()`
- Every tenant-scoped table: `tenant_id UUID NOT NULL` as second column after `id`
- RLS policy name pattern: `{table}_tenant_isolation`
- Migrations: Alembic, one migration per schema change, never squash migrations in prod
- Indexes named: `idx_{table}_{columns}`

## Backend (Python)

- Python 3.12, strict type hints throughout
- Pydantic v2 for all request/response models and tool call schemas
- SQLAlchemy async session injected via FastAPI dependency
- Service layer between route handlers and DB — handlers never query DB directly
- Agent tool functions: async, return Pydantic models, raise `ToolError` on failure
- Environment config via `pydantic-settings`, loaded from `.env`

## Frontend (TypeScript)

- Strict TypeScript throughout
- Components: PascalCase files, named exports
- A2UI fragment components live in `frontend/src/components/a2ui/`
- Agent surface compositions live in `frontend/src/components/surfaces/`
- API calls via a typed fetch wrapper in `frontend/src/lib/api.ts`
- WebSocket connection managed by CopilotKit; do not manage raw WebSocket state manually

## Naming

- Agent roles in code: `strategist`, `product_manager`, `marketer`, `admin` (snake_case enum values)
- Agent roles in UI: "Strategist", "Product Manager", "Marketer", "Admin"
- Report template IDs: `business_health_summary`, `revenue_over_time`, etc. (snake_case)
- Feature slugs: kebab-case (`auth-email-password`, `inventory-core`)

## Git

- Branch naming: `feature/{slug}`, `fix/{slug}`
- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
- One feature per branch; squash merge to main
