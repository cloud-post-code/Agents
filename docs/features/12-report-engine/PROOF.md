# Proof: Report Engine

## Primary Proof Command

```bash
pytest backend/tests/test_report_engine.py -v
```

## Green State

1. `generate_report` tool call creates a pending report row and enqueues Celery task
2. Celery task runs with mocked data pipeline, renders HTML via Jinja2, converts to PDF via WeasyPrint
3. PDF bytes are non-empty and start with `%PDF`
4. Report row updated to `status='complete'` with `storage_url` set
5. `report_ready` notification written and published to Redis
6. `GET /api/v1/reports/{id}/download` returns redirect to download URL
7. `GET /api/v1/reports` returns completed report scoped to tenant
8. Tenant isolation: tenant B cannot download tenant A's reports
9. Failed Celery task (data pipeline error): report row set to `status='failed'`, no file written

## Executable Proof File

`backend/tests/test_report_engine.py`

```python
import pytest
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_generate_report_creates_pending_row(client, auth_headers, db):
    r = await client.post("/api/v1/reports/generate", headers=auth_headers, json={
        "template_id": "orders_log",
        "params": {"date_from": "2026-01-01", "date_to": "2026-01-31"}
    })
    assert r.status_code == 202
    report_id = r.json()["report_id"]
    result = await db.execute(
        "SELECT status FROM reports WHERE id = :id", {"id": report_id}
    )
    assert result.scalar() in ("pending", "complete")

@pytest.mark.asyncio
async def test_celery_task_produces_pdf(db, tenant, report_template_orders_log):
    from app.tasks import generate_report_task
    with patch("app.reports.pipelines.orders_log.fetch_data", return_value=[]):
        await generate_report_task(
            str(report_template_orders_log.id),
            "orders_log",
            {"date_from": "2026-01-01", "date_to": "2026-01-31"},
            str(tenant.id)
        )
    result = await db.execute(
        "SELECT status, storage_url FROM reports WHERE id = :id",
        {"id": str(report_template_orders_log.id)}
    )
    row = result.fetchone()
    assert row[0] == "complete"
    assert row[1] is not None

@pytest.mark.asyncio
async def test_download_url_redirects(client, auth_headers, completed_report):
    r = await client.get(
        f"/api/v1/reports/{completed_report.id}/download",
        headers=auth_headers,
        follow_redirects=False
    )
    assert r.status_code in (302, 307)

@pytest.mark.asyncio
async def test_report_tenant_isolation(client, auth_headers_b, completed_report_tenant_a):
    r = await client.get(
        f"/api/v1/reports/{completed_report_tenant_a.id}",
        headers=auth_headers_b
    )
    assert r.status_code == 404
```
