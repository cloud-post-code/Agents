"""Celery task for report generation."""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from app.worker import celery_app


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_report_task(self, report_id: str, template_id: str, params: dict, tenant_id: str):
    asyncio.run(_generate_async(report_id, template_id, params, tenant_id))


async def _generate_async(report_id: str, template_id: str, params: dict, tenant_id: str):
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import text
    from app.core.config import settings
    from app.reports.renderer import render_html, render_pdf, save_report_file

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as db:
            await db.execute(text(f"SET app.tenant_id = '{tenant_id}'"))

            from app.reports import pipelines
            pipeline_fn = getattr(pipelines, f"fetch_{template_id}", None)
            data = await pipeline_fn(tenant_id, **params) if pipeline_fn else {}

            html = render_html(template_id, {"data": data, "tenant_id": tenant_id, **params})
            pdf_bytes = render_pdf(html)

            filename = f"{tenant_id}/{report_id}_{template_id}.pdf"
            storage_url = save_report_file(pdf_bytes, filename, "pdf")

            await db.execute(
                text(
                    "UPDATE reports SET status='complete', storage_url=:url, size_bytes=:size "
                    "WHERE id=:id"
                ),
                {"url": storage_url, "size": len(pdf_bytes), "id": report_id},
            )
            await db.execute(
                text(
                    "INSERT INTO notifications (id, tenant_id, type, payload, report_id) "
                    "VALUES (gen_random_uuid(), :tid, 'report_ready', :payload, :rid)"
                ),
                {
                    "tid": tenant_id,
                    "payload": json.dumps({"report_id": report_id, "template_id": template_id}),
                    "rid": report_id,
                },
            )
            await db.commit()
    except Exception as exc:
        async with session_factory() as db:
            await db.execute(text(f"SET app.tenant_id = '{tenant_id}'"))
            await db.execute(
                text("UPDATE reports SET status='failed' WHERE id=:id"),
                {"id": report_id},
            )
            await db.commit()
        raise
    finally:
        await engine.dispose()
