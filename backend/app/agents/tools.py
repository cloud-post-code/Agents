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


@tool
def get_product_count() -> dict:
    """
    Get the total number of products in the catalog.
    
    Returns a simple count without generating a report.
    """
    return {
        "total_products": 0,
        "message": "Product count tool - implementation needed",
    }


@tool
def get_catalog_summary() -> dict:
    """
    Get a quick summary of the product catalog.
    
    Returns:
        - Total product count
        - Low stock count (products below reorder point)
        - Total inventory value
        - Average price
    """
    return {
        "total_products": 0,
        "low_stock_count": 0,
        "total_value": 0.0,
        "average_price": 0.0,
        "message": "Catalog summary tool - implementation needed",
    }


@tool
def ingest_product_from_image(
    image_base64: str,
    price: float,
    quantity: int,
    unique_id: str,
    sku: str = ""
) -> dict:
    """
    Ingest a product from an uploaded image.
    
    The agent will extract product name, description, and tags from the image.
    User must provide: price, quantity, and unique_id.
    SKU is optional.
    
    Args:
        image_base64: Base64-encoded image data
        price: Product selling price
        quantity: Stock quantity
        unique_id: Unique product identifier (must be unique)
        sku: Optional SKU code (must be unique if provided)
    
    Returns:
        Dict with created product info or error
    """
    return {
        "status": "success",
        "message": "Product ingestion tool called - implementation needed",
        "product_id": "stub-product-id",
    }


@tool
def ingest_products_from_csv(csv_base64: str) -> dict:
    """
    Ingest multiple products from a CSV file.
    
    CSV should contain columns for: name, price, quantity, description, unique_id
    Optional columns: sku, cost
    
    The agent will auto-detect column structure and import all products.
    
    Args:
        csv_base64: Base64-encoded CSV file data
    
    Returns:
        Dict with success count, errors, and created products
    """
    return {
        "status": "success",
        "message": "CSV ingestion tool called - implementation needed",
        "imported": 0,
        "errors": [],
    }


SHARED_TOOLS = [create_task, render_ui, generate_report]
PRODUCT_MANAGER_TOOLS = SHARED_TOOLS + [
    search_catalog,
    get_product_count,
    get_catalog_summary,
    ingest_product_from_image,
    ingest_products_from_csv,
]
