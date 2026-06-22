from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.middleware.tenant import CurrentTenant
from app.models.product import Product
from app.models.user import User

router = APIRouter(prefix="/products", tags=["products"])


@router.get("")
async def list_products(
    tenant: CurrentTenant,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
) -> dict:
    """
    List all products for the current tenant.
    
    Returns products with images (image_url or image_data).
    """
    query = select(Product).where(
        Product.tenant_id == tenant.id,
        Product.deleted_at.is_(None)
    )
    
    # Optional search filter
    if search:
        search_term = f"%{search.lower()}%"
        from sqlalchemy import func, or_
        query = query.where(
            or_(
                func.lower(Product.name).like(search_term),
                func.lower(Product.sku).like(search_term),
                func.lower(Product.description).like(search_term),
            )
        )
    
    # Get total count
    from sqlalchemy import func as sql_func
    count_query = select(sql_func.count(Product.id)).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Product.created_at.desc())
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Format response with images
    items = []
    for product in products:
        # Extract tags from metadata
        tags = []
        if product.extra_data and isinstance(product.extra_data, dict):
            tags = product.extra_data.get("tags", [])
        
        # Build image URL (prefer image_url, fallback to base64 data URL)
        image_url = product.image_url
        if not image_url and product.image_data:
            # Convert base64 to data URL for frontend
            image_url = f"data:image/jpeg;base64,{product.image_data}"
        
        items.append({
            "id": str(product.id),
            "name": product.name,
            "sku": product.sku,
            "description": product.description,
            "price": float(product.price) if product.price else None,
            "cost": float(product.cost) if product.cost else None,
            "stock_qty": product.stock_qty,
            "reorder_point": product.reorder_point,
            "image_url": image_url,  # Include image
            "tags": tags,
            "created_at": product.created_at.isoformat(),
            "updated_at": product.updated_at.isoformat(),
        })
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{product_id}")
async def get_product(
    product_id: str,
    tenant: CurrentTenant,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single product by ID with image."""
    from uuid import UUID
    
    result = await db.execute(
        select(Product).where(
            Product.id == UUID(product_id),
            Product.tenant_id == tenant.id,
            Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Extract tags
    tags = []
    if product.extra_data and isinstance(product.extra_data, dict):
        tags = product.extra_data.get("tags", [])
    
    # Build image URL
    image_url = product.image_url
    if not image_url and product.image_data:
        image_url = f"data:image/jpeg;base64,{product.image_data}"
    
    return {
        "id": str(product.id),
        "name": product.name,
        "sku": product.sku,
        "description": product.description,
        "price": float(product.price) if product.price else None,
        "cost": float(product.cost) if product.cost else None,
        "stock_qty": product.stock_qty,
        "reorder_point": product.reorder_point,
        "image_url": image_url,
        "tags": tags,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
    }


@router.patch("/{product_id}")
async def update_product(
    product_id: str,
    updates: dict,
    tenant: CurrentTenant,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a product (for inline editing of SKU, stock, etc.)."""
    from uuid import UUID
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(Product).where(
            Product.id == UUID(product_id),
            Product.tenant_id == tenant.id,
            Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Update allowed fields
    allowed_fields = ["sku", "stock_qty", "price", "cost", "reorder_point", "name", "description"]
    for field, value in updates.items():
        if field in allowed_fields and hasattr(product, field):
            setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    
    # Return updated product with image
    image_url = product.image_url
    if not image_url and product.image_data:
        image_url = f"data:image/jpeg;base64,{product.image_data}"
    
    tags = []
    if product.extra_data and isinstance(product.extra_data, dict):
        tags = product.extra_data.get("tags", [])
    
    return {
        "id": str(product.id),
        "name": product.name,
        "sku": product.sku,
        "description": product.description,
        "price": float(product.price) if product.price else None,
        "cost": float(product.cost) if product.cost else None,
        "stock_qty": product.stock_qty,
        "reorder_point": product.reorder_point,
        "image_url": image_url,
        "tags": tags,
        "created_at": product.created_at.isoformat(),
        "updated_at": product.updated_at.isoformat(),
    }
