# Testing

## Strategy

- **Red/green TDD** for all backend features: write a failing test, implement, make it pass
- **No mocking the database** — tests use a real PostgreSQL test database with RLS enabled
- **No bypassing RLS** in tests — test tenant isolation explicitly
- Integration tests over unit tests for agent tools (tool functions hit real DB, not mocks)
- Frontend: component tests for A2UI fragments; E2E tests for critical chat + approval flows

## Backend Test Stack

- `pytest` + `pytest-asyncio`
- `httpx.AsyncClient` for FastAPI route tests
- Test DB: PostgreSQL spun up via Docker Compose for local runs; Railway test environment for CI
- Fixtures: `tenant_fixture`, `user_fixture`, `auth_headers_fixture` — always create isolated tenant per test
- Test DB teardown: truncate all tenant-scoped tables after each test; never drop and recreate

## Test Database Setup

```bash
# Start test DB
docker compose up -d postgres

# Run migrations against test DB
DATABASE_URL=postgresql://... alembic upgrade head

# Run tests
pytest backend/tests/ -v
```

## Frontend Test Stack

- Vitest for unit/component tests
- Playwright for E2E
- A2UI fragment tests: render each fragment with all prop combinations, assert no layout overflow

## Proof Command Patterns

Each feature's `PROOF.md` defines a primary proof command. Patterns used:

```bash
# Backend feature proof
pytest backend/tests/test_{feature}.py -v

# Frontend component proof
npx vitest run src/components/a2ui/

# E2E proof
npx playwright test tests/{feature}.spec.ts

# Migration proof
alembic upgrade head && alembic check
```

## Gate

The repo gate runs all of the above:
```bash
~/.claude/scripts/gate
```

Gate must pass before any feature is marked complete.

## RLS Test Pattern

Every feature that touches tenant-scoped data must include a cross-tenant isolation test:

```python
def test_tenant_isolation(tenant_a, tenant_b, db):
    # Create record as tenant A
    # Attempt to read it as tenant B
    # Assert 404 or empty result — never a data leak
```
