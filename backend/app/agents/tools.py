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
    image_url: str,
    price: float = 0.0,
    quantity: int = 0,
    sku: str = "",
    save: bool = False,
) -> dict:
    """
    Analyze a product image with vision AI and optionally save to catalog.

    When save=False (default): analyzes the image and returns extracted name,
    description, and detected variants — does NOT save anything yet.
    When save=True: saves the product to the catalog with provided price/quantity.

    Args:
        image_url: URL of the uploaded product image (from file upload)
        price: Selling price (required when save=True)
        quantity: Stock quantity available (required when save=True)
        sku: Optional SKU / unique identifier
        save: When True, saves the product; when False, returns extracted info only

    Returns:
        Dict with extracted product info (and product_id if saved)
    """
    # Real execution handled by _execute_tool in base.py
    return {"status": "stub", "message": "handled by _execute_tool"}


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


@tool
def get_brand_dna() -> dict:
    """Retrieve the current brand DNA profile (name, colors, fonts, tone, voice)."""
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_social_post(
    product_id: str,
    platform: str = "instagram",
    post_type: str = "feed_post",
    creative_brief: str = "",
) -> dict:
    """
    Generate an expert social media caption for a product.

    Args:
        product_id: UUID of the product from the catalog
        platform: Target platform — instagram, facebook, tiktok, twitter, pinterest
        post_type: Content format — feed_post, story, reel, carousel
        creative_brief: Optional creative direction or special offer to highlight

    Returns:
        Dict with caption, product details, and platform info
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_social_post_batch(
    product_id: str,
    platforms: list = ["instagram", "facebook", "tiktok"],  # noqa: B006
    post_type: str = "feed_post",
    creative_brief: str = "",
) -> dict:
    """
    Generate captions for multiple social platforms at once for a single product.

    Args:
        product_id: UUID of the product
        platforms: List of platforms to generate for
        post_type: Content format for all platforms
        creative_brief: Optional creative direction

    Returns:
        Dict with a 'posts' array, each containing platform and caption
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_flier(
    product_id: str,
    headline: str = "",
    subheadline: str = "",
    call_to_action: str = "Shop Now",
    promo_text: str = "",
    format: str = "square",
) -> dict:
    """
    Generate a branded flier spec for a product using the brand DNA.

    Args:
        product_id: UUID of the product
        headline: Main headline text (defaults to product name)
        subheadline: Supporting copy (defaults to truncated description)
        call_to_action: Button/CTA text (e.g. 'Shop Now', 'Learn More', '20% Off Today')
        promo_text: Optional promotional banner text (e.g. 'LIMITED TIME OFFER')
        format: Flier dimensions — square (1080×1080), portrait (1080×1350), landscape (1200×628)

    Returns:
        Structured flier spec with brand, product, copy, and style data
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


SHARED_TOOLS = [render_ui, generate_report]
PRODUCT_MANAGER_TOOLS = SHARED_TOOLS + [
    search_catalog,
    get_product_count,
    get_catalog_summary,
    ingest_product_from_image,
    ingest_products_from_csv,
]
MARKETER_TOOLS = SHARED_TOOLS + [
    search_catalog,
    get_brand_dna,
    generate_social_post,
    generate_social_post_batch,
    generate_flier,
]
