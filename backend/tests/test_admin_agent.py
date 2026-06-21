"""Feature 16: Admin Agent Full Wiring — proof tests.

Covers:
  - Migration: all 4 new tables exist with RLS enabled
  - Admin API routes: GET /api/v1/admin/profile, GET /api/v1/admin/orders,
    POST /api/v1/admin/orders/draft, GET /api/v1/admin/revenue
  - Tool behaviour: get_business_profile auto-creates empty profile
  - Tool behaviour: create_order_draft creates a task, not an order row
  - Tool behaviour: get_revenue_summary aggregates completed order line items
  - Tenant isolation: tenant B cannot see tenant A's orders or profile
  - WebSocket: admin chat emits {type: "a2ui"} frames when render_ui is invoked
"""
from __future__ import annotations

import json
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from httpx_ws import aconnect_ws
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def read_until_done(ws, max_messages: int = 60, timeout: float = 10.0) -> list[dict]:
    messages: list[dict] = []
    for _ in range(max_messages):
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=timeout)
            data = json.loads(raw)
            messages.append(data)
            if data.get("type") == "done":
                break
        except (asyncio.TimeoutError, Exception):
            break
    return messages


# ---------------------------------------------------------------------------
# 1. Migration — tables exist and RLS is active
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_new_tables_exist(db: AsyncSession):
    """All four new tables must be present after migration."""
    for table in ("tenant_business_profile", "orders", "order_line_items", "order_shipping"):
        result = await db.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :t"
            ),
            {"t": table},
        )
        assert result.scalar() == 1, f"Table '{table}' missing"


@pytest.mark.asyncio
async def test_new_tables_have_rls(db: AsyncSession):
    """RLS must be enabled on all four new tables."""
    for table in ("tenant_business_profile", "orders", "order_line_items", "order_shipping"):
        result = await db.execute(
            text(
                "SELECT rowsecurity FROM pg_class "
                "WHERE relname = :t AND relkind = 'r'"
            ),
            {"t": table},
        )
        row = result.fetchone()
        assert row is not None, f"Table '{table}' not found in pg_class"
        assert row[0] is True, f"RLS not enabled on '{table}'"


# ---------------------------------------------------------------------------
# 2. Business Profile API
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_profile_auto_creates(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/admin/profile creates and returns an empty profile for a new tenant."""
    r = await client.get("/api/v1/admin/profile", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "business_name" in body
    assert "shipping_policy" in body
    assert "entity_type" in body


@pytest.mark.asyncio
async def test_get_profile_idempotent(client: AsyncClient, auth_headers: dict):
    """Calling GET /api/v1/admin/profile twice returns the same record."""
    r1 = await client.get("/api/v1/admin/profile", headers=auth_headers)
    r2 = await client.get("/api/v1/admin/profile", headers=auth_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_profile_tenant_isolation(
    client: AsyncClient, auth_headers: dict, auth_headers_b: dict
):
    """Tenant B's profile is separate from Tenant A's."""
    r_a = await client.get("/api/v1/admin/profile", headers=auth_headers)
    r_b = await client.get("/api/v1/admin/profile", headers=auth_headers_b)
    assert r_a.status_code == 200
    assert r_b.status_code == 200
    assert r_a.json()["id"] != r_b.json()["id"]


# ---------------------------------------------------------------------------
# 3. Orders API
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_order_draft_creates_task(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/admin/orders/draft creates a pending task, not an order row."""
    r = await client.post(
        "/api/v1/admin/orders/draft",
        headers=auth_headers,
        json={
            "customer_name": "Jane Smith",
            "customer_address": "123 Main St, Portland, OR 97201",
            "line_items": [
                {"description": "Ceramic Mug", "quantity": 2, "unit_price_cents": 1800},
            ],
            "notes": "Gift wrap please",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert "task_id" in body
    assert body.get("status") == "pending"


@pytest.mark.asyncio
async def test_create_order_draft_does_not_create_order_row(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
):
    """Draft order must not write to the orders table — goes to task queue only."""
    await client.post(
        "/api/v1/admin/orders/draft",
        headers=auth_headers,
        json={
            "customer_name": "Draft Test",
            "customer_address": "1 Draft Lane",
            "line_items": [{"description": "Widget", "quantity": 1, "unit_price_cents": 500}],
        },
    )
    # Superuser bypass: count orders table directly
    result = await db.execute(text("SELECT COUNT(*) FROM orders"))
    assert result.scalar() == 0, "Draft must not create an order row"


@pytest.mark.asyncio
async def test_list_orders_empty(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/admin/orders returns empty list when no orders exist."""
    r = await client.get("/api/v1/admin/orders", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_list_orders_with_data(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    """GET /api/v1/admin/orders returns orders for the authenticated tenant."""
    # Seed via auth-bypass SQL (superuser session bypasses RLS)
    tenant_result = await db.execute(
        text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
    )
    tenant_row = tenant_result.fetchone()
    assert tenant_row is not None, "Expected a tenant from registration"
    tid = tenant_row[0]

    order_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO orders (id, tenant_id, customer_name, status) "
            "VALUES (:id, :tid, :name, 'pending')"
        ),
        {"id": order_id, "tid": str(tid), "name": "Alice"},
    )
    await db.commit()

    r = await client.get("/api/v1/admin/orders", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["items"]
    ids = [o["id"] for o in items]
    assert order_id in ids


@pytest.mark.asyncio
async def test_list_orders_status_filter(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    """GET /api/v1/admin/orders?status=shipped filters by status."""
    tenant_result = await db.execute(
        text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
    )
    tid = tenant_result.fetchone()[0]

    pending_id = str(uuid.uuid4())
    shipped_id = str(uuid.uuid4())
    for oid, status in ((pending_id, "pending"), (shipped_id, "shipped")):
        await db.execute(
            text(
                "INSERT INTO orders (id, tenant_id, customer_name, status) "
                "VALUES (:id, :tid, :name, :status)"
            ),
            {"id": oid, "tid": str(tid), "name": "Customer", "status": status},
        )
    await db.commit()

    r = await client.get("/api/v1/admin/orders?status=shipped", headers=auth_headers)
    assert r.status_code == 200
    returned_ids = [o["id"] for o in r.json()["items"]]
    assert shipped_id in returned_ids
    assert pending_id not in returned_ids


@pytest.mark.asyncio
async def test_orders_tenant_isolation(
    client: AsyncClient, auth_headers: dict, auth_headers_b: dict, db: AsyncSession
):
    """Tenant B cannot see Tenant A's orders."""
    # Seed an order for tenant A
    tenant_result = await db.execute(
        text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
    )
    tid = tenant_result.fetchone()[0]
    order_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO orders (id, tenant_id, customer_name, status) "
            "VALUES (:id, :tid, 'Isolated Order', 'pending')"
        ),
        {"id": order_id, "tid": str(tid)},
    )
    await db.commit()

    r = await client.get("/api/v1/admin/orders", headers=auth_headers_b)
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()["items"]]
    assert order_id not in ids, "Tenant B must not see Tenant A orders"


# ---------------------------------------------------------------------------
# 4. Revenue Summary API
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_revenue_summary_empty_period(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/admin/revenue returns zero totals when no completed orders exist."""
    r = await client.get(
        "/api/v1/admin/revenue",
        headers=auth_headers,
        params={"from_date": "2024-01-01", "to_date": "2024-01-31"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_orders"] == 0
    assert body["total_revenue_cents"] == 0


@pytest.mark.asyncio
async def test_revenue_summary_aggregates_completed_orders(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
):
    """Revenue summary sums line item totals for completed orders only."""
    tenant_result = await db.execute(
        text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
    )
    tid = tenant_result.fetchone()[0]

    order_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO orders (id, tenant_id, customer_name, status, created_at) "
            "VALUES (:id, :tid, 'Revenue Customer', 'completed', '2024-06-15')"
        ),
        {"id": order_id, "tid": str(tid)},
    )
    await db.execute(
        text(
            "INSERT INTO order_line_items "
            "(id, order_id, tenant_id, description, quantity, unit_price_cents) "
            "VALUES (:id, :oid, :tid, 'Mug', 3, 1800)"
        ),
        {"id": str(uuid.uuid4()), "oid": order_id, "tid": str(tid)},
    )
    await db.commit()

    r = await client.get(
        "/api/v1/admin/revenue",
        headers=auth_headers,
        params={"from_date": "2024-06-01", "to_date": "2024-06-30"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_orders"] == 1
    assert body["total_revenue_cents"] == 5400  # 3 * 1800


@pytest.mark.asyncio
async def test_revenue_excludes_non_completed_orders(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
):
    """Pending and shipped orders must not count toward revenue."""
    tenant_result = await db.execute(
        text("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
    )
    tid = tenant_result.fetchone()[0]

    for status in ("pending", "shipped", "cancelled"):
        oid = str(uuid.uuid4())
        await db.execute(
            text(
                "INSERT INTO orders (id, tenant_id, customer_name, status, created_at) "
                "VALUES (:id, :tid, 'Non-Rev', :status, '2024-06-15')"
            ),
            {"id": oid, "tid": str(tid), "status": status},
        )
        await db.execute(
            text(
                "INSERT INTO order_line_items "
                "(id, order_id, tenant_id, description, quantity, unit_price_cents) "
                "VALUES (:id, :oid, :tid, 'Item', 1, 999)"
            ),
            {"id": str(uuid.uuid4()), "oid": oid, "tid": str(tid)},
        )
    await db.commit()

    r = await client.get(
        "/api/v1/admin/revenue",
        headers=auth_headers,
        params={"from_date": "2024-06-01", "to_date": "2024-06-30"},
    )
    assert r.status_code == 200
    assert r.json()["total_revenue_cents"] == 0


# ---------------------------------------------------------------------------
# 5. WebSocket — A2UI frame emitted when render_ui is called
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_ws_emits_a2ui_frame(ws_client: AsyncClient, ws_auth_headers: dict):
    """Admin chat must emit at least one {type: 'a2ui'} frame when agent calls render_ui."""
    async with aconnect_ws(
        "ws://test/ws/agent/admin/chat",
        ws_client,
        headers=ws_auth_headers,
    ) as ws:
        # Prompt specifically triggers render_ui per Admin system prompt constraints
        await ws.send_text(json.dumps({
            "type": "message",
            "content": "Show me my business profile as a card",
        }))
        messages = await read_until_done(ws, max_messages=80, timeout=15.0)

    a2ui_frames = [m for m in messages if m.get("type") == "a2ui"]
    assert len(a2ui_frames) > 0, (
        "Expected at least one {type: 'a2ui'} frame; "
        f"got types: {[m.get('type') for m in messages]}"
    )
    frame = a2ui_frames[0]
    assert "surface" in frame, "a2ui frame must include 'surface' key"
    assert "components" in frame, "a2ui frame must include 'components' key"
    assert isinstance(frame["components"], list)


@pytest.mark.asyncio
async def test_admin_ws_a2ui_does_not_break_done(ws_client: AsyncClient, ws_auth_headers: dict):
    """Emitting an a2ui frame must not prevent the 'done' frame from being sent."""
    async with aconnect_ws(
        "ws://test/ws/agent/admin/chat",
        ws_client,
        headers=ws_auth_headers,
    ) as ws:
        await ws.send_text(json.dumps({
            "type": "message",
            "content": "Show me pending orders as a table",
        }))
        messages = await read_until_done(ws, max_messages=80, timeout=15.0)

    types = [m.get("type") for m in messages]
    assert "done" in types, f"Expected 'done' frame after a2ui; got: {types}"


# ---------------------------------------------------------------------------
# 6. Order line items and shipping rows respect RLS
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_order_line_items_tenant_isolation(db: AsyncSession):
    """Order line items for tenant A are invisible when queried as tenant B."""
    tid_a = uuid.uuid4()
    tid_b = uuid.uuid4()
    for tid, name in ((tid_a, "A"), (tid_b, "B")):
        await db.execute(
            text(
                "INSERT INTO tenants (id, slug, display_name, plan_tier) "
                "VALUES (:id, :slug, :name, 'starter')"
            ),
            {"id": str(tid), "slug": f"iso-{tid}", "name": f"Tenant {name}"},
        )

    # Create order + line item for tenant A (superuser session bypasses RLS)
    order_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO orders (id, tenant_id, customer_name, status) "
            "VALUES (:id, :tid, 'Isolation Test', 'pending')"
        ),
        {"id": order_id, "tid": str(tid_a)},
    )
    li_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO order_line_items "
            "(id, order_id, tenant_id, description, quantity, unit_price_cents) "
            "VALUES (:id, :oid, :tid, 'Secret Item', 1, 100)"
        ),
        {"id": li_id, "oid": order_id, "tid": str(tid_a)},
    )
    await db.commit()

    # Switch context to tenant B and verify line item is invisible
    await db.execute(text(f"SET app.tenant_id = '{tid_b}'"))
    result = await db.execute(
        text("SELECT id FROM order_line_items WHERE id = :id"),
        {"id": li_id},
    )
    assert result.fetchone() is None, "Line item from tenant A must be invisible to tenant B"


@pytest.mark.asyncio
async def test_business_profile_tenant_isolation_raw(db: AsyncSession):
    """Business profile for tenant A is invisible when RLS context is set to tenant B."""
    tid_a = uuid.uuid4()
    tid_b = uuid.uuid4()
    for tid, name in ((tid_a, "ProfileA"), (tid_b, "ProfileB")):
        await db.execute(
            text(
                "INSERT INTO tenants (id, slug, display_name, plan_tier) "
                "VALUES (:id, :slug, :name, 'starter')"
            ),
            {"id": str(tid), "slug": f"prof-{tid}", "name": name},
        )

    prof_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tenant_business_profile "
            "(id, tenant_id, business_name) VALUES (:id, :tid, 'Secret Shop')"
        ),
        {"id": prof_id, "tid": str(tid_a)},
    )
    await db.commit()

    await db.execute(text(f"SET app.tenant_id = '{tid_b}'"))
    result = await db.execute(
        text("SELECT id FROM tenant_business_profile WHERE id = :id"),
        {"id": prof_id},
    )
    assert result.fetchone() is None, "Business profile from tenant A must not be visible to tenant B"
