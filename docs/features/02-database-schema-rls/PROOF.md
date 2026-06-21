# Proof: Database Schema + Row Level Security

## Primary Proof Command

```bash
pytest backend/tests/test_schema_rls.py -v
```

## Red State

Tests fail because tables, enums, indexes, and RLS policies do not exist.

## Green State

1. `alembic upgrade head` applies migration without error
2. All tables exist with correct columns and types
3. All enums exist
4. pgvector extension is installed; `products.embedding` column is `vector(1536)`
5. RLS is enabled and forced on all tenant-scoped tables
6. Cross-tenant isolation test: tenant A cannot read tenant B's products even with a direct DB query (RLS blocks it)
7. `alembic check` passes

## Executable Proof File

`backend/tests/test_schema_rls.py`

```python
import pytest
import uuid
from sqlalchemy import text

@pytest.mark.asyncio
async def test_all_tables_exist(db):
    tables = ["tenants", "users", "products", "agent_sessions", "agent_messages",
              "tasks", "task_approvals", "reports", "calendar_events",
              "notifications", "integrations"]
    for table in tables:
        result = await db.execute(
            text("SELECT to_regclass(:t)"), {"t": f"public.{table}"}
        )
        assert result.scalar() is not None, f"Table {table} missing"

@pytest.mark.asyncio
async def test_pgvector_embedding_column(db):
    result = await db.execute(text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_name='products' AND column_name='embedding'"
    ))
    row = result.fetchone()
    assert row is not None
    # pgvector columns show as USER-DEFINED
    assert row[0] in ("USER-DEFINED", "vector")

@pytest.mark.asyncio
async def test_rls_cross_tenant_isolation(db, tenant_a, tenant_b):
    # Insert product as tenant A
    product_id = uuid.uuid4()
    await db.execute(text("SET app.tenant_id = :tid"), {"tid": str(tenant_a.id)})
    await db.execute(text(
        "INSERT INTO products (id, tenant_id, name, price, stock_qty) "
        "VALUES (:id, :tid, 'Ceramic Bowl', 45.00, 10)"
    ), {"id": str(product_id), "tid": str(tenant_a.id)})
    await db.commit()

    # Switch to tenant B — product must not be visible
    await db.execute(text("SET app.tenant_id = :tid"), {"tid": str(tenant_b.id)})
    result = await db.execute(
        text("SELECT id FROM products WHERE id = :id"), {"id": str(product_id)}
    )
    assert result.fetchone() is None, "RLS failed: tenant B can read tenant A's product"

@pytest.mark.asyncio
async def test_rls_enabled_on_all_tenant_tables(db):
    tables = ["products", "agent_sessions", "agent_messages", "tasks",
              "reports", "calendar_events", "notifications", "integrations"]
    for table in tables:
        result = await db.execute(text(
            "SELECT rowsecurity FROM pg_tables WHERE tablename = :t"
        ), {"t": table})
        row = result.fetchone()
        assert row and row[0] is True, f"RLS not enabled on {table}"
```
