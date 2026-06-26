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
    """Get the total number of products in the catalog."""
    return {
        "total_products": 0,
        "message": "Product count tool - implementation needed",
    }


@tool
def get_catalog_summary() -> dict:
    """
    Get a quick summary of the product catalog.

    Returns total product count, low stock count, total inventory value, average price.
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
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def ingest_products_from_csv(csv_base64: str) -> dict:
    """
    Ingest multiple products from a CSV file.

    CSV should contain columns for: name, price, quantity, description, unique_id
    Optional columns: sku, cost

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
def update_product_stock(product_id: str, delta: int) -> dict:
    """
    Increase or decrease the stock quantity of a product.

    Args:
        product_id: UUID of the product
        delta: Positive to add stock, negative to subtract (e.g. 5 or -3)

    Returns:
        Dict with new stock_qty and product name
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


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
    previous_caption: str = "",
) -> dict:
    """
    Generate an expert social media caption for a single product on one platform.
    Uses two AI calls: first analyzes the product photo with vision, then writes the caption.

    For iteration: pass the previous caption in previous_caption and put edit instructions
    in creative_brief — the new caption will incorporate the requested changes.

    Args:
        product_id: UUID of the product from the catalog
        platform: Target platform — instagram, facebook, tiktok, twitter, pinterest
        post_type: Content format — feed_post, story, reel, carousel
        creative_brief: Creative direction, special offer, or edit instructions for iteration
        previous_caption: Previous caption to iterate on (leave empty for a fresh generation)

    Returns:
        Dict with caption, product details, platform info, and image_analysis
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_social_post_batch(
    product_id: str,
    platforms: list = ["instagram", "facebook", "tiktok"],  # noqa: B006
    post_type: str = "feed_post",
    creative_brief: str = "",
    previous_caption: str = "",
) -> dict:
    """
    Generate captions for multiple social platforms at once for a single product.
    Uses two AI calls: one vision call for the product photo, then one caption per platform.

    For iteration: pass the previous caption in previous_caption and put edit instructions
    in creative_brief — all platform captions will incorporate the requested changes.

    Args:
        product_id: UUID of the product
        platforms: List of platforms to generate for
        post_type: Content format for all platforms
        creative_brief: Creative direction or edit instructions for iteration
        previous_caption: Previous caption to iterate on (leave empty for fresh generation)

    Returns:
        Dict with a 'posts' array, each containing platform and caption, plus image_analysis
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_multi_product_post(
    product_ids: list,
    platforms: list = ["instagram", "facebook", "tiktok"],  # noqa: B006
    post_type: str = "feed_post",
    creative_brief: str = "",
) -> dict:
    """
    Generate social media captions featuring multiple products at once.

    Use this when the user wants to promote several products together in one post
    (e.g. a collection, a bundle, a sale on multiple items).

    Args:
        product_ids: List of product UUIDs to feature together
        platforms: Target platforms to generate captions for
        post_type: Content format — feed_post, story, reel, carousel
        creative_brief: Optional creative direction (e.g. 'holiday sale', 'new arrivals')

    Returns:
        Dict with posts array (per platform) and product details for all products
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
    Generate a branded flier spec for a single product using the brand DNA.

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


@tool
def generate_multi_product_flier(
    product_ids: list,
    headline: str = "",
    subheadline: str = "",
    call_to_action: str = "Shop Now",
    promo_text: str = "",
    format: str = "landscape",
) -> dict:
    """
    Generate a branded flier featuring multiple products (collection/sale flier).

    Use when the user wants a flier showcasing several products together.

    Args:
        product_ids: List of product UUIDs to feature (2–6 recommended)
        headline: Main headline (e.g. 'New Arrivals', 'Holiday Sale')
        subheadline: Supporting copy
        call_to_action: CTA text shared across all products
        promo_text: Optional promo badge (e.g. 'UP TO 30% OFF')
        format: square, portrait, or landscape (landscape recommended for multi-product)

    Returns:
        Structured multi-product flier spec
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_flier_image(
    product_id: str,
    headline: str = "",
    subheadline: str = "",
    call_to_action: str = "Shop Now",
    promo_text: str = "",
    format: str = "square",
) -> dict:
    """
    Generate a photorealistic AI marketing image for a single-product flier using DALL-E 3.
    Uses two AI calls: first analyzes the product photo with vision, then generates the flier image.
    Returns a flier spec with an ai_image_url field containing the generated image.

    For iteration: adjust the headline, subheadline, promo_text, or call_to_action to regenerate
    with updated copy — the vision analysis of the product photo is always re-run fresh.

    Args:
        product_id: UUID of the product
        headline: Main headline text
        subheadline: Supporting copy
        call_to_action: CTA text
        promo_text: Optional promo badge text
        format: square, portrait, or landscape

    Returns:
        Full flier spec with ai_image_url and image_analysis added
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


@tool
def generate_multi_flier_image(
    product_ids: list,
    headline: str = "",
    subheadline: str = "",
    call_to_action: str = "Shop Now",
    promo_text: str = "",
    format: str = "landscape",
) -> dict:
    """
    Generate a photorealistic AI marketing image for a multi-product collection flier using DALL-E 3.
    Returns a multi-flier spec with an ai_image_url field containing the generated image.

    Args:
        product_ids: List of product UUIDs
        headline: Collection headline
        subheadline: Supporting copy
        call_to_action: CTA text
        promo_text: Optional promo badge text
        format: square, portrait, or landscape

    Returns:
        Full multi-flier spec with ai_image_url added
    """
    return {"status": "stub", "message": "handled by _execute_tool"}


SHARED_TOOLS = [render_ui, generate_report]
PRODUCT_MANAGER_TOOLS = SHARED_TOOLS + [
    search_catalog,
    get_product_count,
    get_catalog_summary,
    ingest_product_from_image,
    ingest_products_from_csv,
    update_product_stock,
]
MARKETER_TOOLS = SHARED_TOOLS + [
    search_catalog,
    get_brand_dna,
    generate_social_post,
    generate_social_post_batch,
    generate_multi_product_post,
    generate_flier,
    generate_flier_image,
    generate_multi_product_flier,
    generate_multi_flier_image,
]
