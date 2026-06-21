"""Feature 15: Marketer + PM report templates proof tests."""
from unittest.mock import patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_all_marketer_pm_reports_render_to_pdf(db: AsyncSession):
    import uuid
    tenant_id = str(uuid.uuid4())

    fake_pdf = b"%PDF-1.4 test"
    with patch("app.reports.renderer.render_pdf", return_value=fake_pdf):
        from app.reports.renderer import render_report_to_pdf
        for template_id in [
            "returns_and_refunds",
            "product_performance",
            "traffic_sources",
            "top_search_terms",
            "conversion_funnel",
            "inventory_health",
            "inventory_movement",
            "supplier_spend",
        ]:
            pdf_bytes = await render_report_to_pdf(template_id, {}, tenant_id)
            assert pdf_bytes[:4] == b"%PDF", f"{template_id} did not produce PDF"


@pytest.mark.asyncio
async def test_inventory_health_has_products(db: AsyncSession):
    from app.reports.pipelines import fetch_inventory_health
    data = await fetch_inventory_health("test-tenant")
    assert "products" in data
    assert "total_skus" in data


@pytest.mark.asyncio
async def test_traffic_sources_empty_state(db: AsyncSession):
    from app.reports.pipelines import fetch_traffic_sources
    data = await fetch_traffic_sources("test-tenant-no-channels")
    assert "insufficient_data" in data


@pytest.mark.asyncio
async def test_conversion_funnel_has_stages(db: AsyncSession):
    from app.reports.pipelines import fetch_conversion_funnel
    data = await fetch_conversion_funnel("test-tenant")
    assert "stages" in data


@pytest.mark.asyncio
async def test_supplier_spend_has_suppliers(db: AsyncSession):
    from app.reports.pipelines import fetch_supplier_spend
    data = await fetch_supplier_spend("test-tenant")
    assert "suppliers" in data
    assert "total_spend" in data
