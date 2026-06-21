"""FastAPI dependencies for authentication and DB session."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.engine import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_redis(request: Request):
    return request.app.state.redis


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    jti = payload.get("jti")
    tenant_id = payload.get("tenant_id")
    user_id = payload.get("sub")

    # Check Redis blocklist
    redis = request.app.state.redis
    if jti and await redis.exists(f"blocklist:{jti}"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    # Set tenant context on DB connection
    await db.execute(text(f"SET LOCAL app.tenant_id = '{tenant_id}'"))

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Attach token payload to user object for logout
    user._token_payload = payload  # type: ignore[attr-defined]
    user._token = token  # type: ignore[attr-defined]
    return user
