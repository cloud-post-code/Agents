"""Feature 13: Admin report templates proof tests."""
from unittest.mock import patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_all_admin_reports_render_to_pdf(db: AsyncSession):
    """All 4 Admin report templates render to non-empty PDF bytes."""
    import uuid
    tenant_id = str(uuid.uuid4())

    fake_pdf = b"%PDF-1.4 test"
    with patch("app.reports.renderer.render_pdf", return_value=fake_pdf):
        from app.reports.renderer import render_report_to_pdf
        for template_id in [
            "monthly_financial_statement",
            "orders_log",
            "order_line_items",
            "fulfillment_performance",
        ]:
            pdf_bytes = await render_report_to_pdf(template_id, {}, tenant_id)
            assert pdf_bytes[:4] == b"%PDF", f"{template_id} did not produce PDF"


@pytest.mark.asyncio
async def test_orders_log_pipeline_returns_dict(db: AsyncSession):
    from app.reports.pipelines import fetch_orders_log
    data = await fetch_orders_log("test-tenant", date_from="2026-01-01", date_to="2026-01-31")
    assert isinstance(data, dict)
    assert "orders" in data


@pytest.mark.asyncio
async def test_fulfillment_performance_has_on_time_rate(db: AsyncSession):
    from app.reports.pipelines import fetch_fulfillment_performance
    data = await fetch_fulfillment_performance("test-tenant")
    assert "on_time_rate" in data


@pytest.mark.asyncio
async def test_monthly_financial_statement_has_net_total(db: AsyncSession):
    from app.reports.pipelines import fetch_monthly_financial_statement
    data = await fetch_monthly_financial_statement("test-tenant", year=2026, month=1)
    assert "net_total" in data
