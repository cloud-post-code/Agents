"""Feature 02: Database Schema + RLS proof tests."""
import uuid

import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_all_tables_exist(db):
    tables = [
        "tenants", "users", "products", "agent_sessions", "agent_messages",
        "tasks", "task_approvals", "reports", "calendar_events",
        "notifications", "integrations",
    ]
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
    assert row is not None, "embedding column missing on products"
    # pgvector columns show as USER-DEFINED
    assert row[0] in ("USER-DEFINED", "vector"), f"Unexpected data_type: {row[0]}"


@pytest.mark.asyncio
async def test_enums_exist(db):
    enums = ["agent_role", "task_status", "report_format", "plan_tier", "user_role"]
    for enum in enums:
        result = await db.execute(
            text("SELECT typname FROM pg_type WHERE typname = :e AND typtype = 'e'"),
            {"e": enum},
        )
        assert result.fetchone() is not None, f"Enum {enum} missing"


@pytest.mark.asyncio
async def test_rls_cross_tenant_isolation(db, tenant_a, tenant_b):
    """
    Superusers bypass RLS. We use SET ROLE to a non-superuser app role
    so that FORCE ROW LEVEL SECURITY applies.
    """
    product_id = uuid.uuid4()

    # Insert product as tenant A (superuser can bypass RLS for setup)
    await db.execute(
        text(
            "INSERT INTO products (id, tenant_id, name, price, stock_qty, reorder_point) "
            "VALUES (:id, :tid, 'Ceramic Bowl', 45.00, 10, 0)"
        ),
        {"id": str(product_id), "tid": str(tenant_a.id)},
    )
    await db.commit()

    # Switch to app_user role (non-superuser) so RLS applies
    await db.execute(text("SET ROLE app_user"))
    # Set tenant B context
    await db.execute(text(f"SET app.tenant_id = '{tenant_b.id}'"))

    # Tenant B should NOT be able to see tenant A's product
    result = await db.execute(
        text("SELECT id FROM products WHERE id = :id"), {"id": str(product_id)}
    )
    row = result.fetchone()

    # Reset role before asserting so cleanup still works
    await db.execute(text("RESET ROLE"))

    assert row is None, "RLS failed: tenant B can read tenant A's product"


@pytest.mark.asyncio
async def test_rls_enabled_on_all_tenant_tables(db):
    tables = [
        "products", "agent_sessions", "agent_messages", "tasks",
        "reports", "calendar_events", "notifications", "integrations",
    ]
    for table in tables:
        result = await db.execute(
            text("SELECT rowsecurity FROM pg_tables WHERE tablename = :t"),
            {"t": table},
        )
        row = result.fetchone()
        assert row and row[0] is True, f"RLS not enabled on {table}"


@pytest.mark.asyncio
async def test_indexes_exist(db):
    indexes = [
        "idx_tasks_status",
        "idx_messages_session",
        "idx_notifications_tenant_unread",
        "idx_reports_tenant",
        "idx_calendar_tenant_range",
    ]
    for idx in indexes:
        result = await db.execute(
            text("SELECT indexname FROM pg_indexes WHERE indexname = :i"),
            {"i": idx},
        )
        assert result.fetchone() is not None, f"Index {idx} missing"
