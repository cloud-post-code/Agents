# Feature: Database Schema + Row Level Security

## What to Build

All domain tables with tenant isolation enforced at the database layer.

### Tables to Create (Alembic migration)

```
tenants, users (already from feature 01 — add plan_tier, onboarded_at)
products         — id, tenant_id, name, sku, description, price, cost, stock_qty, reorder_point, metadata JSONB, embedding vector(1536), created_at, updated_at
agent_sessions   — id, tenant_id, agent_role, title, created_at
agent_messages   — id, session_id, tenant_id, role, content, tool_calls JSONB, a2ui_surfaces JSONB, created_at
tasks            — id, tenant_id, created_by, assigned_to, title, description, status (task_status enum), priority, due_at, celery_task_id, output JSONB, error_detail, created_at, updated_at
task_approvals   — id, task_id, action, reason, decided_at
reports          — id, tenant_id, generated_by, session_id, title, format (report_format enum), storage_url, size_bytes, metadata JSONB, created_at
calendar_events  — id, tenant_id, created_by, title, description, starts_at, ends_at, all_day, related_task_id, metadata JSONB, created_at
notifications    — id, tenant_id, type, payload JSONB, report_id, read_at, created_at
integrations     — id, tenant_id, type, label, credentials JSONB, enabled, created_at
```

### Enums

```sql
CREATE TYPE agent_role AS ENUM ('strategist', 'product_manager', 'marketer', 'admin');
CREATE TYPE task_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed');
CREATE TYPE report_format AS ENUM ('pdf', 'html');
CREATE TYPE plan_tier AS ENUM ('starter', 'grow', 'pro');
CREATE TYPE user_role AS ENUM ('owner', 'member');
```

### RLS Policies

Enable RLS with FORCE ROW LEVEL SECURITY on every tenant-scoped table. Uniform policy:

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
CREATE POLICY {table}_tenant_isolation ON {table}
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The `tenants` and `users` tables use a different policy since they are the auth boundary.

### Indexes

```sql
CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_tasks_status ON tasks(tenant_id, status) WHERE status IN ('pending', 'approved', 'in_progress');
CREATE INDEX idx_messages_session ON agent_messages(session_id, created_at);
CREATE INDEX idx_notifications_tenant_unread ON notifications(tenant_id, created_at) WHERE read_at IS NULL;
CREATE INDEX idx_reports_tenant ON reports(tenant_id, generated_by, created_at DESC);
CREATE INDEX idx_calendar_tenant_range ON calendar_events(tenant_id, starts_at, ends_at);
```

## Out of Scope

- No seed data
- No API endpoints (those are in later features)
- No pgvector embeddings population (that's in inventory/search features)
