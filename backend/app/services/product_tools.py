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
) -> list:
    """Search products by name, description, or SKU."""
    search_term = f"%{query.lower()}%"
    
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .where(
            (func.lower(Product.name).like(search_term)) |
            (func.lower(Product.description).like(search_term)) |
            (func.lower(Product.sku).like(search_term))
        )
        .limit(limit)
    )
    
    products = result.scalars().all()
    
    return [
        {
            "id": str(product.id),
            "name": product.name,
            "sku": product.sku,
            "price": float(product.price) if product.price else None,
            "stock_qty": product.stock_qty,
            "description": product.description,
        }
        for product in products
    ]
