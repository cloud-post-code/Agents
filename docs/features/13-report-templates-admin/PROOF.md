# Proof: Report Templates — Admin (4 Reports)

## Primary Proof Command

```bash
pytest backend/tests/test_reports_admin.py -v
```

## Green State

1. Each of the 4 report data pipelines returns correct rows for a seeded tenant
2. Each report renders to valid HTML (no Jinja2 errors)
3. WeasyPrint converts each HTML to non-empty PDF bytes starting with `%PDF`
4. Monthly Financial Statement groups events correctly and net total is mathematically accurate
5. Orders Log includes all orders in date range; excludes orders outside range
6. Order Line Items has one row per line item with correct product/variant names
7. Fulfillment Performance calculates on-time rate correctly (shipped_at - created_at ≤ 3 days)
8. All 4 reports scoped to tenant (no cross-tenant data)

## Executable Proof File

`backend/tests/test_reports_admin.py`

```python
import pytest
from decimal import Decimal

@pytest.mark.asyncio
async def test_orders_log_date_filter(db, tenant, seeded_orders):
    from app.reports.pipelines.orders_log import fetch_data
    rows = await fetch_data(tenant.id, date_from="2026-01-01", date_to="2026-01-31")
    assert all(row["created_at"].startswith("2026-01") for row in rows)
    assert len(rows) == seeded_orders.january_count

@pytest.mark.asyncio
async def test_monthly_statement_net_total(db, tenant, seeded_financials):
    from app.reports.pipelines.monthly_financial_statement import fetch_data
    data = await fetch_data(tenant.id, year=2026, month=1)
    expected_net = seeded_financials.gross - seeded_financials.fees - seeded_financials.refunds
    assert abs(data["net_total"] - expected_net) < Decimal("0.01")

@pytest.mark.asyncio
async def test_fulfillment_performance_on_time_rate(db, tenant, seeded_orders_with_ship_dates):
    from app.reports.pipelines.fulfillment_performance import fetch_data
    data = await fetch_data(tenant.id, date_from="2026-01-01", date_to="2026-01-31")
    # 8 of 10 orders shipped within 3 days
    assert abs(data["on_time_rate"] - 0.80) < 0.01

@pytest.mark.asyncio
async def test_all_admin_reports_render_to_pdf(db, tenant, seeded_orders):
    from app.reports.renderer import render_report_to_pdf
    for template_id in [
        "monthly_financial_statement",
        "orders_log",
        "order_line_items",
        "fulfillment_performance"
    ]:
        pdf_bytes = await render_report_to_pdf(template_id, {}, str(tenant.id))
        assert pdf_bytes[:4] == b"%PDF"
        assert len(pdf_bytes) > 1000
```
