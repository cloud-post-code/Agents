"""Stubbed tools for all Artisan agents."""
from langchain_core.tools import tool


@tool
def create_task(title: str, description: str = "", priority: int = 0) -> dict:
    """Create a task that requires human approval before execution."""
    return {
        "task_id": "stub-task-id",
        "title": title,
        "status": "pending",
        "message": "Task created and queued for approval.",
    }


@tool
def render_ui(component: str, props: dict = {}) -> dict:  # noqa: B006
    """Render an A2UI component surface in the chat."""
    return {
        "component": component,
        "props": props,
        "rendered": True,
    }


@tool
def generate_report(title: str, format: str = "pdf", sections: list = []) -> dict:  # noqa: B006
    """Generate a structured report and return a download URL."""
    return {
        "report_id": "stub-report-id",
        "title": title,
        "format": format,
        "status": "queued",
        "message": f"Report '{title}' is being generated.",
    }


@tool
def search_catalog(query: str, limit: int = 10) -> list:
    """Search the product catalog by name, description, or SKU."""
    return [
        {
            "id": "stub-product-id",
            "name": f"Result for: {query}",
            "sku": "STUB-001",
            "price": 25.00,
            "stock_qty": 5,
        }
    ]


SHARED_TOOLS = [create_task, render_ui, generate_report]
PRODUCT_MANAGER_TOOLS = SHARED_TOOLS + [search_catalog]
