# Feature: Backend Foundation

## What to Build

Bootstrap the FastAPI backend service with all infrastructure wiring in place:

- FastAPI app with lifespan context manager (startup/shutdown)
- SQLAlchemy async engine + session factory connected to PostgreSQL
- Alembic migration setup (initial empty migration, `alembic upgrade head` runnable)
- Redis connection via `redis.asyncio`
- Celery app instance with Redis broker configured
- Tenant middleware: resolves `tenant_id` from JWT on every request, sets `app.tenant_id` on the DB connection before the handler runs
- JWT auth: `/api/v1/auth/register` and `/api/v1/auth/login` endpoints (email + password)
- Health check: `GET /api/v1/health` returns `{status: "ok", db: "ok", redis: "ok"}`
- `.env` config via `pydantic-settings`
- `Procfile` and `railway.toml` for Railway deployment
- `docker-compose.yml` for local dev (PostgreSQL + Redis)

## Skill

`coding-python-backend`

## Out of Scope

- No agent logic
- No frontend
- No RLS policies (those are in feature 02)
- No business domain tables (those are in feature 02)
