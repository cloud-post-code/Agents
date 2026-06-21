"""Feature 12: Report Engine — generate, list, download."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_TEMPLATES = [
    "business_health_summary", "revenue_over_time", "gross_profit_by_product",
    "channel_revenue_comparison", "customer_segments",
    "monthly_financial_statement", "orders_log", "order_line_items",
    "returns_and_refunds", "payment_deposits_log",
    "inventory_health", "inventory_movement",
    "product_performance", "traffic_sources", "top_search_terms",
    "conversion_funnel", "supplier_spend", "fulfillment_performance",
]


def _report_dict(r: Report) -> dict:
    return {
        "id": str(r.id),
        "tenant_id": str(r.tenant_id),
        "title": r.title,
        "template_id": r.template_id,
        "format": r.format,
        "status": r.status,
        "storage_url": r.storage_url,
        "size_bytes": r.size_bytes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class GenerateReportRequest(BaseModel):
    template_id: str
    params: dict = {}
    format: str = "pdf"


@router.post("/generate", status_code=202)
async def generate_report(
    body: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.template_id not in VALID_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {body.template_id}")

    report = Report(
        tenant_id=current_user.tenant_id,
        title=body.template_id.replace("_", " ").title(),
        template_id=body.template_id,
        format=body.format,
        status="pending",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Enqueue Celery task
    from app.tasks.report_generation import generate_report_task
    generate_report_task.delay(
        str(report.id),
        body.template_id,
        body.params,
        str(current_user.tenant_id),
    )

    return {"report_id": str(report.id), "status": "pending", "estimated_seconds": 30}


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    generated_by: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Report).where(
        Report.tenant_id == current_user.tenant_id
    ).order_by(Report.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    reports = result.scalars().all()
    return {"items": [_report_dict(r) for r in reports], "page": page}


@router.get("/{report_id}")
async def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.scalar(
        select(Report).where(
            Report.id == report_id,
            Report.tenant_id == current_user.tenant_id,
        )
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_dict(report)


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.scalar(
        select(Report).where(
            Report.id == report_id,
            Report.tenant_id == current_user.tenant_id,
        )
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.storage_url is None:
        raise HTTPException(status_code=404, detail="Report not yet generated")
    # Serve local file
    return FileResponse(
        path=report.storage_url,
        filename=f"{report.template_id or 'report'}.pdf",
        media_type="application/pdf",
    )
