"""Admin business profile API — get and upsert tenant_business_profile."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/admin", tags=["admin-profile"])


VALID_SHIPPING_METHODS = {"flat_rate", "weight_based", "free_threshold", "none"}


class ProfileIn(BaseModel):
    business_name: Optional[str] = None
    shop_description: Optional[str] = None
    entity_type: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    shipping_policy: Optional[str] = None
    cancellation_policy: Optional[str] = None
    shipping_flat_rate_cents: Optional[int] = None
    shipping_free_threshold_cents: Optional[int] = None
    shipping_method: Optional[str] = None


class ProfileOut(BaseModel):
    id: str
    tenant_id: str
    business_name: Optional[str]
    shop_description: Optional[str]
    entity_type: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    website: Optional[str]
    shipping_policy: Optional[str]
    cancellation_policy: Optional[str]
    shipping_flat_rate_cents: Optional[int]
    shipping_free_threshold_cents: Optional[int]
    shipping_method: Optional[str]


def _row_to_dict(row) -> dict:
    return {
        "id": str(row.id),
        "tenant_id": str(row.tenant_id),
        "business_name": row.business_name,
        "shop_description": row.shop_description,
        "entity_type": row.entity_type,
        "address_line1": row.address_line1,
        "address_line2": row.address_line2,
        "city": row.city,
        "state": row.state,
        "postal_code": row.postal_code,
        "country": row.country,
        "contact_email": row.contact_email,
        "contact_phone": row.contact_phone,
        "website": row.website,
        "shipping_policy": row.shipping_policy,
        "cancellation_policy": row.cancellation_policy,
        "shipping_flat_rate_cents": row.shipping_flat_rate_cents,
        "shipping_free_threshold_cents": row.shipping_free_threshold_cents,
        "shipping_method": row.shipping_method,
    }


async def _get_or_create_profile(db: AsyncSession, tenant_id: uuid.UUID):
    from sqlalchemy import text as sqlt
    result = await db.execute(
        text("SELECT * FROM tenant_business_profile WHERE tenant_id = :tid"),
        {"tid": str(tenant_id)},
    )
    row = result.fetchone()
    if row is None:
        new_id = uuid.uuid4()
        await db.execute(
            text(
                "INSERT INTO tenant_business_profile (id, tenant_id) "
                "VALUES (:id, :tid)"
            ),
            {"id": str(new_id), "tid": str(tenant_id)},
        )
        await db.commit()
        result2 = await db.execute(
            text("SELECT * FROM tenant_business_profile WHERE tenant_id = :tid"),
            {"tid": str(tenant_id)},
        )
        row = result2.fetchone()
    return row


@router.get("/profile", response_model=ProfileOut)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text(f"SET app.tenant_id = '{current_user.tenant_id}'"))
    row = await _get_or_create_profile(db, current_user.tenant_id)
    return _row_to_dict(row)


@router.post("/profile", response_model=ProfileOut)
async def save_profile(
    body: ProfileIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert the tenant business profile with the provided fields."""
    await db.execute(text(f"SET app.tenant_id = '{current_user.tenant_id}'"))

    if body.shipping_method is not None and body.shipping_method not in VALID_SHIPPING_METHODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"shipping_method must be one of: {', '.join(VALID_SHIPPING_METHODS)}",
        )

    # Build SET clause for only provided fields
    updates = {k: v for k, v in body.model_dump().items() if v is not None}

    if not updates:
        row = await _get_or_create_profile(db, current_user.tenant_id)
        return _row_to_dict(row)

    # Ensure profile row exists
    await _get_or_create_profile(db, current_user.tenant_id)

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    params = {**updates, "tid": str(current_user.tenant_id)}
    await db.execute(
        text(f"UPDATE tenant_business_profile SET {set_clause}, updated_at = now() WHERE tenant_id = :tid"),
        params,
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM tenant_business_profile WHERE tenant_id = :tid"),
        {"tid": str(current_user.tenant_id)},
    )
    return _row_to_dict(result.fetchone())
