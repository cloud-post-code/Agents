import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.tenant import Tenant
from app.models.user import User


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    slug = slug[:48] if len(slug) > 48 else slug
    suffix = uuid.uuid4().hex[:4]
    return f"{slug}-{suffix}" if slug else suffix


@dataclass
class RegisteredUser:
    token: str
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    onboarding: bool = True


async def register_user(
    db: AsyncSession, email: str, password: str, business_name: str
) -> RegisteredUser:
    tenant = Tenant(slug=_slugify(business_name), display_name=business_name)
    db.add(tenant)
    await db.flush()  # populate tenant.id before referencing it

    # Set tenant context so RLS allows the user INSERT and subsequent reads
    await db.execute(text(f"SET LOCAL app.tenant_id = '{tenant.id}'"))

    user = User(
        tenant_id=tenant.id,
        email=email,
        password_hash=hash_password(password),
        role="owner",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(
        {"sub": str(user.id), "tenant_id": str(tenant.id), "role": user.role}
    )
    return RegisteredUser(token=token, user_id=user.id, tenant_id=tenant.id)


@dataclass
class LoginResult:
    token: str
    user_id: uuid.UUID
    tenant_id: uuid.UUID


async def login_user(db: AsyncSession, email: str, password: str) -> LoginResult:
    # Raw query bypasses RLS — email is unique across all tenants
    row = (await db.execute(
        text("SELECT id, tenant_id, password_hash, role FROM users WHERE email = :email"),
        {"email": email},
    )).fetchone()
    if not row or not verify_password(password, row.password_hash):
        raise ValueError("invalid_credentials")

    token = create_access_token(
        {"sub": str(row.id), "tenant_id": str(row.tenant_id), "role": row.role}
    )
    return LoginResult(token=token, user_id=row.id, tenant_id=row.tenant_id)
