"""Feature 12: Report Engine proof tests."""
import uuid
from unittest.mock import patch, AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_generate_report_creates_pending_row(client: AsyncClient, auth_headers: dict, db: AsyncSession):
    with patch("app.tasks.report_generation.generate_report_task.delay") as mock_delay:
        r = await client.post("/api/v1/reports/generate", headers=auth_headers, json={
            "template_id": "orders_log",
            "params": {"date_from": "2026-01-01", "date_to": "2026-01-31"},
        })
    assert r.status_code == 202
    report_id = r.json()["report_id"]
    assert r.json()["status"] == "pending"
    mock_delay.assert_called_once()

    result = await db.execute(
        text("SELECT status FROM reports WHERE id = :id"), {"id": report_id}
    )
    assert result.scalar() == "pending"


@pytest.mark.asyncio
async def test_celery_task_produces_pdf(db: AsyncSession):
    """Report generation task renders HTML and produces PDF bytes."""
    tenant_id = str(uuid.uuid4())
    report_id = str(uuid.uuid4())

    await db.execute(
        text("INSERT INTO tenants (id, slug, display_name, plan_tier) VALUES (:id, :s, 'T', 'starter')"),
        {"id": tenant_id, "s": f"t-{tenant_id[:8]}"},
    )
    await db.execute(
        text(
            "INSERT INTO reports (id, tenant_id, title, template_id, format, status) "
            "VALUES (:id, :tid, 'Orders Log', 'orders_log', 'pdf', 'pending')"
        ),
        {"id": report_id, "tid": tenant_id},
    )
    await db.commit()

    fake_pdf = b"%PDF-1.4 fake pdf content for testing"
    with patch("app.reports.renderer.render_pdf", return_value=fake_pdf):
        from app.tasks.report_generation import _generate_async
        await _generate_async(report_id, "orders_log", {}, tenant_id)

    result = await db.execute(
        text("SELECT status, storage_url FROM reports WHERE id = :id"), {"id": report_id}
    )
    row = result.fetchone()
    assert row[0] == "complete"
    assert row[1] is not None

    import os
    assert os.path.exists(row[1])
    with open(row[1], "rb") as f:
        pdf_bytes = f.read()
    assert pdf_bytes[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_list_reports_scoped_to_tenant(client: AsyncClient, auth_headers: dict, auth_headers_b: dict):
    with patch("app.tasks.report_generation.generate_report_task.delay"):
        r = await client.post("/api/v1/reports/generate", headers=auth_headers, json={
            "template_id": "orders_log", "params": {},
        })
    report_id = r.json()["report_id"]

    r2 = await client.get("/api/v1/reports", headers=auth_headers_b)
    ids = [rep["id"] for rep in r2.json()["items"]]
    assert report_id not in ids


@pytest.mark.asyncio
async def test_get_report_tenant_isolation(client: AsyncClient, auth_headers: dict, auth_headers_b: dict):
    with patch("app.tasks.report_generation.generate_report_task.delay"):
        r = await client.post("/api/v1/reports/generate", headers=auth_headers, json={
            "template_id": "orders_log", "params": {},
        })
    report_id = r.json()["report_id"]

    r2 = await client.get(f"/api/v1/reports/{report_id}", headers=auth_headers_b)
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_report_completion_writes_notification(db: AsyncSession):
    """Completed report generates a report_ready notification."""
    tenant_id = str(uuid.uuid4())
    report_id = str(uuid.uuid4())

    await db.execute(
        text("INSERT INTO tenants (id, slug, display_name, plan_tier) VALUES (:id, :s, 'T2', 'starter')"),
        {"id": tenant_id, "s": f"t2-{tenant_id[:8]}"},
    )
    await db.execute(
        text(
            "INSERT INTO reports (id, tenant_id, title, template_id, format, status) "
            "VALUES (:id, :tid, 'Orders Log', 'orders_log', 'pdf', 'pending')"
        ),
        {"id": report_id, "tid": tenant_id},
    )
    await db.commit()

    with patch("app.reports.renderer.render_pdf", return_value=b"%PDF-fake"):
        from app.tasks.report_generation import _generate_async
        await _generate_async(report_id, "orders_log", {}, tenant_id)

    result = await db.execute(
        text("SELECT id FROM notifications WHERE type='report_ready' AND report_id=:rid"),
        {"rid": report_id},
    )
    assert result.fetchone() is not None
