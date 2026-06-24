"""Feature 10: Inventory Core — products, variants, stock adjustments."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.product import Product, ProductImage, ProductVariant, StockAdjustment
from app.models.user import User

router = APIRouter(prefix="/products", tags=["inventory"])


def _product_dict(p: Product, variants: list = None) -> dict:
    d = {
        "id": str(p.id),
        "tenant_id": str(p.tenant_id),
        "name": p.name,
        "sku": p.sku,
        "description": p.description,
        "price": float(p.price) if p.price is not None else None,
        "cost": float(p.cost) if p.cost is not None else None,
        "stock_qty": p.stock_qty,
        "reorder_point": p.reorder_point,
        "weight_grams": p.weight_grams,
        "metadata": p.extra_data,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if variants is not None:
        d["variants"] = [_variant_dict(v) for v in variants]
    return d


def _variant_dict(v: ProductVariant) -> dict:
    return {
        "id": str(v.id),
        "product_id": str(v.product_id),
        "name": v.name,
        "sku": v.sku,
        "price": float(v.price) if v.price is not None else None,
        "cost": float(v.cost) if v.cost is not None else None,
        "stock_qty": v.stock_qty,
    }


class CreateProductRequest(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_qty: int = 0
    reorder_point: int = 5
    weight_grams: Optional[int] = None


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    reorder_point: Optional[int] = None
    weight_grams: Optional[int] = None


class StockAdjustmentRequest(BaseModel):
    delta: int
    reason: str = "manual"


class CreateVariantRequest(BaseModel):
    name: str
    sku: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_qty: int = 0


@router.get("")
async def list_products(
    low_stock: bool = Query(False),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product).where(Product.tenant_id == current_user.tenant_id)
    if not include_deleted:
        q = q.where(Product.deleted_at.is_(None))
    if low_stock:
        q = q.where(Product.stock_qty <= Product.reorder_point)
    q = q.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    products = result.scalars().all()
    return {"items": [_product_dict(p) for p in products], "page": page, "page_size": page_size}


@router.post("", status_code=201)
async def create_product(
    body: CreateProductRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = Product(
        tenant_id=current_user.tenant_id,
        name=body.name,
        sku=body.sku,
        description=body.description,
        price=body.price,
        cost=body.cost,
        stock_qty=body.stock_qty,
        reorder_point=body.reorder_point,
        weight_grams=body.weight_grams,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await _check_low_stock(db, product, current_user.tenant_id)
    return _product_dict(product)


@router.get("/{product_id}")
async def get_product(
    product_id: uuid.UUID,
    include_deleted: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product).where(
        Product.id == product_id,
        Product.tenant_id == current_user.tenant_id,
    )
    if not include_deleted:
        q = q.where(Product.deleted_at.is_(None))
    product = await db.scalar(q)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    variants_result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
    )
    variants = variants_result.scalars().all()
    return _product_dict(product, variants=variants)


@router.patch("/{product_id}")
async def update_product(
    product_id: uuid.UUID,
    body: UpdateProductRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return _product_dict(product)


class BulkUpdateItem(BaseModel):
    id: str
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_qty: Optional[int] = None
    reorder_point: Optional[int] = None
    description: Optional[str] = None
    weight_grams: Optional[int] = None


class BulkUpdateRequest(BaseModel):
    updates: list[BulkUpdateItem]


@router.post("/bulk-update")
async def bulk_update_products(
    body: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple products in one request. Returns list of updated products."""
    updated = []
    errors = []
    for item in body.updates:
        try:
            product = await db.scalar(
                select(Product).where(
                    Product.id == uuid.UUID(item.id),
                    Product.tenant_id == current_user.tenant_id,
                    Product.deleted_at.is_(None),
                )
            )
            if product is None:
                errors.append({"id": item.id, "error": "not found"})
                continue
            fields = item.model_dump(exclude_none=True, exclude={"id"})
            for field, value in fields.items():
                setattr(product, field, value)
            updated.append(product)
        except Exception as e:
            errors.append({"id": item.id, "error": str(e)})
    if updated:
        await db.commit()
        for p in updated:
            await db.refresh(p)
    return {
        "updated": [_product_dict(p) for p in updated],
        "errors": errors,
        "updated_count": len(updated),
    }


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{product_id}/stock-adjustment")
async def adjust_stock(
    product_id: uuid.UUID,
    body: StockAdjustmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.stock_qty += body.delta
    adj = StockAdjustment(
        tenant_id=current_user.tenant_id,
        product_id=product_id,
        delta=body.delta,
        reason=body.reason,
    )
    db.add(adj)
    await db.commit()
    await db.refresh(product)
    await _check_low_stock(db, product, current_user.tenant_id)
    return _product_dict(product)


class UpdateVariantRequest(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    stock_qty: Optional[int] = None


@router.patch("/{product_id}/variants/{variant_id}")
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    body: UpdateVariantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    variant = await db.scalar(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
            ProductVariant.tenant_id == current_user.tenant_id,
        )
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(variant, field, value)
    await db.commit()
    await db.refresh(variant)
    return _variant_dict(variant)


@router.post("/{product_id}/variants", status_code=201)
async def create_variant(
    product_id: uuid.UUID,
    body: CreateVariantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    variant = ProductVariant(
        tenant_id=current_user.tenant_id,
        product_id=product_id,
        name=body.name,
        sku=body.sku,
        price=body.price,
        cost=body.cost,
        stock_qty=body.stock_qty,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return _variant_dict(variant)


class AddProductImageRequest(BaseModel):
    image_url: str
    image_order: int = 0


def _image_dict(img: ProductImage) -> dict:
    return {
        "id": str(img.id),
        "product_id": str(img.product_id),
        "image_url": img.image_url,
        "image_order": img.image_order,
        "created_at": img.created_at.isoformat() if img.created_at else None,
    }


@router.get("/{product_id}/images")
async def list_product_images(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.image_order)
    )
    images = result.scalars().all()
    return {"items": [_image_dict(img) for img in images]}


@router.post("/{product_id}/images", status_code=201)
async def add_product_image(
    product_id: uuid.UUID,
    body: AddProductImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == current_user.tenant_id,
            Product.deleted_at.is_(None),
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    img = ProductImage(
        product_id=product_id,
        tenant_id=current_user.tenant_id,
        image_url=body.image_url,
        image_order=body.image_order,
    )
    db.add(img)
    # Also set product.image_url to the first image if not set
    if product.image_url is None and body.image_order == 0:
        product.image_url = body.image_url
    await db.commit()
    await db.refresh(img)
    return _image_dict(img)


async def _check_low_stock(db: AsyncSession, product: Product, tenant_id: uuid.UUID):
    """Write a low_stock notification when stock falls to/below reorder_point."""
    if product.stock_qty <= product.reorder_point:
        import json
        from app.models.notification import Notification
        notif = Notification(
            tenant_id=tenant_id,
            type="low_stock",
            payload={
                "product_id": str(product.id),
                "product_name": product.name,
                "stock_qty": product.stock_qty,
                "reorder_point": product.reorder_point,
            },
        )
        db.add(notif)
        await db.commit()
