from fastapi import APIRouter

from app.middleware.tenant import CurrentTenant

router = APIRouter(prefix="/products", tags=["products"])


@router.get("")
async def list_products(tenant: CurrentTenant) -> dict:
    # Stub — implemented in feature 10
    return {"items": [], "total": 0}
