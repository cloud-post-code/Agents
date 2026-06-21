"""Report rendering: Jinja2 HTML → WeasyPrint PDF."""
from __future__ import annotations

import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent / "templates"
REPORTS_DIR = Path(os.getenv("REPORTS_DIR", "/tmp/artisan_reports"))
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def render_html(template_id: str, context: dict) -> str:
    """Render a Jinja2 HTML template for the given report."""
    template = _jinja_env.get_template(f"{template_id}.html")
    return template.render(**context)


def render_pdf(html: str) -> bytes:
    """Convert HTML string to PDF bytes via WeasyPrint."""
    from weasyprint import HTML
    return HTML(string=html).write_pdf()


def save_report_file(content: bytes, filename: str, format: str) -> str:
    """Save report file to local volume. Returns storage path."""
    path = REPORTS_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return str(path)


async def render_report_to_pdf(template_id: str, params: dict, tenant_id: str) -> bytes:
    """Convenience: fetch data, render HTML, convert to PDF. Returns PDF bytes."""
    from app.reports import pipelines
    pipeline_fn = getattr(pipelines, f"fetch_{template_id}", None)
    data = await pipeline_fn(tenant_id, **params) if pipeline_fn else {}
    html = render_html(template_id, {"data": data, "tenant_id": tenant_id, **params})
    return render_pdf(html)
