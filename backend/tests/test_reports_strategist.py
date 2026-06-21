"""Feature 14: Strategist report templates proof tests."""
from unittest.mock import patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_all_strategist_reports_render_to_pdf(db: AsyncSession):
    import uuid
    tenant_id = str(uuid.uuid4())

    fake_pdf = b"%PDF-1.4 test"
    with patch("app.reports.renderer.render_pdf", return_value=fake_pdf):
        from app.reports.renderer import render_report_to_pdf
        for template_id in [
            "business_health_summary",
            "revenue_over_time",
            "gross_profit_by_product",
            "channel_revenue_comparison",
            "customer_segments",
        ]:
            pdf_bytes = await render_report_to_pdf(template_id, {}, tenant_id)
            assert pdf_bytes[:4] == b"%PDF", f"{template_id} did not produce PDF"


@pytest.mark.asyncio
async def test_business_health_summary_has_revenue(db: AsyncSession):
    from app.reports.pipelines import fetch_business_health_summary
    data = await fetch_business_health_summary("test-tenant")
    assert "revenue_mtd" in data


@pytest.mark.asyncio
async def test_gross_profit_separates_products_without_cost(db: AsyncSession):
    from app.reports.pipelines import fetch_gross_profit_by_product
    data = await fetch_gross_profit_by_product("test-tenant", year=2026, month=1)
    assert "products_with_cost" in data
    assert "products_no_cost" in data


@pytest.mark.asyncio
async def test_customer_segments_has_counts(db: AsyncSession):
    from app.reports.pipelines import fetch_customer_segments
    data = await fetch_customer_segments("test-tenant")
    assert "new_customer_count" in data
    assert "returning_customer_count" in data
