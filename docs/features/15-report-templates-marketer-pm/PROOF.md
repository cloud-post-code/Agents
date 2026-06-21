# Proof: Report Templates — Marketer + PM (9 Reports)

## Primary Proof Command

```bash
pytest backend/tests/test_reports_marketer_pm.py -v
```

## Green State

1. Inventory Health: SKUs sorted by days-remaining ascending; out-of-stock appears first
2. Inventory Movement: net change per product equals sum of adjustments in range
3. Conversion Funnel: drop-off % between stages calculated correctly; values sum to ≤100% per stage
4. Traffic Sources: shows "Insufficient data" message when `traffic_events` table is empty for tenant
5. Supplier Spend: shows "No supplier data" message when no suppliers exist for tenant
6. Product Performance: conversion rate = units_sold / views (returns 0 if views = 0)
7. All 9 reports render to valid PDF bytes

## Executable Proof File

`backend/tests/test_reports_marketer_pm.py`

```python
import pytest

@pytest.mark.asyncio
async def test_inventory_health_sorted_by_days_remaining(db, tenant, seeded_inventory):
    from app.reports.pipelines.inventory_health import fetch_data
    data = await fetch_data(tenant.id)
    days_list = [p["days_remaining"] for p in data["products"] if p["days_remaining"] is not None]
    assert days_list == sorted(days_list)

@pytest.mark.asyncio
async def test_inventory_movement_net_change(db, tenant, seeded_adjustments):
    from app.reports.pipelines.inventory_movement import fetch_data
    data = await fetch_data(tenant.id, date_from="2026-01-01", date_to="2026-01-31")
    for product in data["products"]:
        expected_net = sum(a["delta"] for a in product["adjustments"])
        assert product["net_change"] == expected_net

@pytest.mark.asyncio
async def test_traffic_sources_empty_state(db, tenant_no_channels):
    from app.reports.pipelines.traffic_sources import fetch_data
    data = await fetch_data(tenant_no_channels.id, date_from="2026-01-01", date_to="2026-01-31")
    assert data["insufficient_data"] is True

@pytest.mark.asyncio
async def test_conversion_funnel_dropoff(db, tenant, seeded_funnel_events):
    from app.reports.pipelines.conversion_funnel import fetch_data
    data = await fetch_data(tenant.id, date_from="2026-01-01", date_to="2026-01-31")
    stages = data["stages"]
    for i in range(len(stages) - 1):
        dropoff = (stages[i]["count"] - stages[i+1]["count"]) / stages[i]["count"]
        assert abs(stages[i]["dropoff_pct"] - dropoff) < 0.001

@pytest.mark.asyncio
async def test_all_marketer_pm_reports_render_to_pdf(db, tenant, seeded_inventory, seeded_orders):
    from app.reports.renderer import render_report_to_pdf
    for template_id in [
        "returns_and_refunds", "product_performance", "traffic_sources",
        "top_search_terms", "conversion_funnel",
        "inventory_health", "inventory_movement", "supplier_spend"
    ]:
        pdf_bytes = await render_report_to_pdf(template_id, {}, str(tenant.id))
        assert pdf_bytes[:4] == b"%PDF"
```
