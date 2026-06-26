"""Real implementations for product manager tools."""
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


async def get_product_count_impl(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Get total product count for tenant."""
    result = await db.execute(
        select(func.count(Product.id)).where(Product.tenant_id == tenant_id)
    )
    count = result.scalar()
    
    return {
        "total_products": count,
        "message": f"You have {count} product{'s' if count != 1 else ''} in your catalog.",
    }


async def get_catalog_summary_impl(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Get catalog summary statistics."""
    # Total count
    count_result = await db.execute(
        select(func.count(Product.id)).where(Product.tenant_id == tenant_id)
    )
    total_products = count_result.scalar() or 0
    
    # Low stock count (stock_qty <= reorder_point)
    low_stock_result = await db.execute(
        select(func.count(Product.id))
        .where(Product.tenant_id == tenant_id)
        .where(Product.stock_qty <= Product.reorder_point)
    )
    low_stock_count = low_stock_result.scalar() or 0
    
    # Total inventory value (price * stock_qty)
    value_result = await db.execute(
        select(func.sum(Product.price * Product.stock_qty))
        .where(Product.tenant_id == tenant_id)
        .where(Product.price.isnot(None))
    )
    total_value = float(value_result.scalar() or 0)
    
    # Average price
    avg_result = await db.execute(
        select(func.avg(Product.price))
        .where(Product.tenant_id == tenant_id)
        .where(Product.price.isnot(None))
    )
    average_price = float(avg_result.scalar() or 0)
    
    return {
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "total_value": round(total_value, 2),
        "average_price": round(average_price, 2),
        "message": (
            f"📊 Catalog Summary:\n"
            f"• Total products: {total_products}\n"
            f"• Low stock items: {low_stock_count}\n"
            f"• Total inventory value: ${total_value:,.2f}\n"
            f"• Average price: ${average_price:,.2f}"
        ),
    }


async def search_catalog_impl(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    query: str,
    limit: int = 10,
) -> dict:
    """Search products by name, description, or SKU with fuzzy partial matching."""
    # Allow single-character queries — strip but never require length > 1
    query = (query or "").strip()

    # Direct UUID lookup — when the query is a product ID, fetch by primary key
    _uuid_query: uuid.UUID | None = None
    if query:
        try:
            _uuid_query = uuid.UUID(query)
        except ValueError:
            pass

    if _uuid_query is not None:
        result = await db.execute(
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.deleted_at.is_(None))
            .where(Product.id == _uuid_query)
        )
    else:
        search_term = f"%{query.lower()}%" if query else "%"
        result = await db.execute(
            select(Product)
            .where(Product.tenant_id == tenant_id)
            .where(Product.deleted_at.is_(None))
            .where(
                (func.lower(Product.name).like(search_term)) |
                (func.lower(Product.description).like(search_term)) |
                (func.lower(Product.sku).like(search_term))
            )
            .limit(limit)
        )

    products = result.scalars().all()

    # Load first image from product_images table for any products missing image_url
    from app.models.product import ProductImage
    product_ids = [p.id for p in products]
    pi_result = await db.execute(
        select(ProductImage.product_id, ProductImage.image_url)
        .where(ProductImage.product_id.in_(product_ids))
        .where(ProductImage.tenant_id == tenant_id)
        .order_by(ProductImage.product_id, ProductImage.image_order)
    )
    pi_rows = pi_result.fetchall()
    # Keep only the first image per product
    pi_map: dict = {}
    for row in pi_rows:
        pid = str(row[0])
        if pid not in pi_map:
            pi_map[pid] = row[1]

    items = []
    for product in products:
        # Extract tags from metadata
        tags = []
        if product.extra_data and isinstance(product.extra_data, dict):
            tags = product.extra_data.get("tags", [])

        # Build image URL: product.image_url → product_images table → image_data base64
        image_url = product.image_url or pi_map.get(str(product.id))
        if not image_url and product.image_data:
            image_url = f"data:image/jpeg;base64,{product.image_data}"
        
        items.append({
            "id": str(product.id),
            "name": product.name,
            "sku": product.sku,
            "price": float(product.price) if product.price else None,
            "stock_qty": product.stock_qty,
            "description": product.description,
            "image_url": image_url,  # Include image
            "tags": tags,
        })

    # "Did you mean" hint when no results and query is non-empty
    did_you_mean: list[str] = []
    if not items and query:
        # Fetch all product names and find partial matches by word overlap
        all_result = await db.execute(
            select(Product.name)
            .where(Product.tenant_id == tenant_id)
            .where(Product.deleted_at.is_(None))
            .limit(200)
        )
        all_names = [row[0] for row in all_result.fetchall() if row[0]]
        query_words = set(query.lower().split())
        for name in all_names:
            name_words = set(name.lower().split())
            if query_words & name_words:  # any word overlap
                did_you_mean.append(name)
            if len(did_you_mean) >= 3:
                break

    response: dict = {"results": items, "count": len(items)}
    if did_you_mean:
        response["did_you_mean"] = did_you_mean
    return response
