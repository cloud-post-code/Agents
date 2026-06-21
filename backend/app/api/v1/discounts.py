"""Discounts API — sale, coupon, and bulk discount management."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, model_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.product import ProductDiscount
from app.models.user import User

router = APIRouter(prefix="/discounts", tags=["discounts"])

VALID_DISCOUNT_TYPES = {"sale", "coupon", "bulk"}


class CreateDiscountRequest(BaseModel):
    discount_type: str
    name: str
    product_id: Optional[str] = None  # null = store-wide
    # sale fields
    sale_price_cents: Optional[int] = None
    sale_percent: Optional[float] = None
    # coupon fields
    coupon_code: Optional[str] = None
    coupon_discount_cents: Optional[int] = None
    coupon_discount_percent: Optional[float] = None
    max_uses: Optional[int] = None
    # bulk fields
    bulk_min_quantity: Optional[int] = None
    bulk_discount_percent: Optional[float] = None
    bulk_discount_cents_per_unit: Optional[int] = None
    # common
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_discount_fields(self) -> "CreateDiscountRequest":
        if self.discount_type not in VALID_DISCOUNT_TYPES:
            raise ValueError(f"discount_type must be one of: {', '.join(VALID_DISCOUNT_TYPES)}")

        if self.discount_type == "sale":
            if self.sale_price_cents is None and self.sale_percent is None:
                raise ValueError("sale discount requires sale_price_cents or sale_percent")

        elif self.discount_type == "coupon":
            if not self.coupon_code:
                raise ValueError("coupon discount requires coupon_code")
            if self.coupon_discount_cents is None and self.coupon_discount_percent is None:
                raise ValueError(
                    "coupon discount requires coupon_discount_cents or coupon_discount_percent"
                )

        elif self.discount_type == "bulk":
            if self.bulk_min_quantity is None:
                raise ValueError("bulk discount requires bulk_min_quantity")
            if self.bulk_discount_percent is None and self.bulk_discount_cents_per_unit is None:
                raise ValueError(
                    "bulk discount requires bulk_discount_percent or bulk_discount_cents_per_unit"
                )

        return self


def _discount_dict(d: ProductDiscount) -> dict:
    return {
        "id": str(d.id),
        "tenant_id": str(d.tenant_id),
        "product_id": str(d.product_id) if d.product_id else None,
        "discount_type": d.discount_type,
        "name": d.name,
        "sale_price_cents": d.sale_price_cents,
        "sale_percent": float(d.sale_percent) if d.sale_percent is not None else None,
        "coupon_code": d.coupon_code,
        "coupon_discount_cents": d.coupon_discount_cents,
        "coupon_discount_percent": float(d.coupon_discount_percent) if d.coupon_discount_percent is not None else None,
        "max_uses": d.max_uses,
        "uses_count": d.uses_count,
        "bulk_min_quantity": d.bulk_min_quantity,
        "bulk_discount_percent": float(d.bulk_discount_percent) if d.bulk_discount_percent is not None else None,
        "bulk_discount_cents_per_unit": d.bulk_discount_cents_per_unit,
        "starts_at": d.starts_at.isoformat() if d.starts_at else None,
        "ends_at": d.ends_at.isoformat() if d.ends_at else None,
        "active": d.active,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


@router.get("")
async def list_discounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active discounts for the current tenant."""
    await db.execute(text(f"SET app.tenant_id = '{current_user.tenant_id}'"))
    result = await db.execute(
        select(ProductDiscount)
        .where(
            ProductDiscount.tenant_id == current_user.tenant_id,
            ProductDiscount.active.is_(True),
        )
        .order_by(ProductDiscount.created_at.desc())
    )
    discounts = result.scalars().all()
    return {"items": [_discount_dict(d) for d in discounts]}


@router.post("", status_code=201)
async def create_discount(
    body: CreateDiscountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new discount."""
    await db.execute(text(f"SET app.tenant_id = '{current_user.tenant_id}'"))

    product_id = uuid.UUID(body.product_id) if body.product_id else None

    discount = ProductDiscount(
        tenant_id=current_user.tenant_id,
        product_id=product_id,
        discount_type=body.discount_type,
        name=body.name,
        sale_price_cents=body.sale_price_cents,
        sale_percent=body.sale_percent,
        coupon_code=body.coupon_code,
        coupon_discount_cents=body.coupon_discount_cents,
        coupon_discount_percent=body.coupon_discount_percent,
        max_uses=body.max_uses,
        bulk_min_quantity=body.bulk_min_quantity,
        bulk_discount_percent=body.bulk_discount_percent,
        bulk_discount_cents_per_unit=body.bulk_discount_cents_per_unit,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
    )
    db.add(discount)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        if "uq_product_discounts_tenant_coupon_code" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A discount with this coupon code already exists for this tenant.",
            )
        raise
    await db.refresh(discount)
    return _discount_dict(discount)


@router.delete("/{discount_id}", status_code=204)
async def delete_discount(
    discount_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a discount (set active=False)."""
    await db.execute(text(f"SET app.tenant_id = '{current_user.tenant_id}'"))
    discount = await db.scalar(
        select(ProductDiscount).where(
            ProductDiscount.id == discount_id,
            ProductDiscount.tenant_id == current_user.tenant_id,
            ProductDiscount.active.is_(True),
        )
    )
    if discount is None:
        raise HTTPException(status_code=404, detail="Discount not found")
    discount.active = False
    await db.commit()
