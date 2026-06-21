from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.engine import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.services.auth import login_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    business_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    onboarding: bool = False


class MeResponse(BaseModel):
    user: dict
    tenant: dict


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    try:
        result = await register_user(db, body.email, body.password, body.business_name)
    except (ValueError, IntegrityError) as exc:
        if "email_taken" in str(exc) or "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise
    return TokenResponse(token=result.token, onboarding=True)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        result = await login_user(db, body.email, body.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return TokenResponse(token=result.token)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    payload = current_user._token_payload  # type: ignore[attr-defined]
    jti = payload.get("jti")
    exp = payload.get("exp")

    if jti and exp:
        redis = request.app.state.redis
        ttl = int(exp - datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await redis.setex(f"blocklist:{jti}", ttl, "1")


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    tenant = await db.scalar(select(Tenant).where(Tenant.id == current_user.tenant_id))
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return MeResponse(
        user={
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.role,
            "tenant_id": str(current_user.tenant_id),
        },
        tenant={
            "id": str(tenant.id),
            "slug": tenant.slug,
            "display_name": tenant.display_name,
            "plan_tier": tenant.plan_tier,
        },
    )
