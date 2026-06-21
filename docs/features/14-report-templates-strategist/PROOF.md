# Proof: Report Templates — Strategist (5 Reports)

## Primary Proof Command

```bash
pytest backend/tests/test_reports_strategist.py -v
```

## Green State

1. Business Health Summary: MTD revenue and margin are mathematically accurate for seeded data
2. Business Health Summary: LLM summary paragraph is non-empty (mocked LLM in tests)
3. Revenue Over Time: daily granularity returns one row per day in range
4. Gross Profit by Product: products with `cost=NULL` appear in warning section, not main table
5. Gross Profit by Product: margin calculation `(net_sales - cogs) / net_sales` is accurate
6. Channel Revenue Comparison: returns one row per distinct channel; totals match order sums
7. Customer Segments: returning customer defined as `customer_email` with >1 order; correctly classified
8. All 5 reports render to valid PDF bytes

## Executable Proof File

`backend/tests/test_reports_strategist.py`

```python
import pytest
from decimal import Decimal
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_business_health_mtd_revenue(db, tenant, seeded_orders_current_month):
    from app.reports.pipelines.business_health_summary import fetch_data
    data = await fetch_data(tenant.id)
    assert data["revenue_mtd"] == seeded_orders_current_month.total_net

@pytest.mark.asyncio
async def test_gross_profit_cost_not_set_warning(db, tenant, products_with_and_without_cost):
    from app.reports.pipelines.gross_profit_by_product import fetch_data
    data = await fetch_data(tenant.id, year=2026, month=1)
    no_cost_names = [p["name"] for p in data["products_no_cost"]]
    with_cost_names = [p["name"] for p in data["products_with_cost"]]
    assert "No Cost Candle" in no_cost_names
    assert "Ceramic Bowl" in with_cost_names
    # Margin calculation
    bowl = next(p for p in data["products_with_cost"] if p["name"] == "Ceramic Bowl")
    expected_margin = (bowl["net_sales"] - bowl["cogs"]) / bowl["net_sales"]
    assert abs(bowl["gross_margin"] - expected_margin) < 0.001

@pytest.mark.asyncio
async def test_customer_segments_new_vs_returning(db, tenant, seeded_mixed_customers):
    from app.reports.pipelines.customer_segments import fetch_data
    data = await fetch_data(tenant.id, year=2026, month=1)
    assert data["new_customer_count"] == seeded_mixed_customers.new_count
    assert data["returning_customer_count"] == seeded_mixed_customers.returning_count

@pytest.mark.asyncio
async def test_all_strategist_reports_render_to_pdf(db, tenant, seeded_orders):
    from app.reports.renderer import render_report_to_pdf
    with patch("app.reports.pipelines.business_health_summary.llm_summarize",
               new_callable=AsyncMock, return_value="Summary text."):
        for template_id in [
            "business_health_summary", "revenue_over_time",
            "gross_profit_by_product", "channel_revenue_comparison",
            "customer_segments"
        ]:
            pdf_bytes = await render_report_to_pdf(template_id, {}, str(tenant.id))
            assert pdf_bytes[:4] == b"%PDF"
```
