from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.engine import get_db

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_tenant(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Set RLS context on this connection
    await db.execute(
        __import__("sqlalchemy").text("SET LOCAL app.tenant_id = :tid"),
        {"tid": tenant_id},
    )
    return {"user_id": payload["sub"], "tenant_id": tenant_id, "role": payload.get("role")}


CurrentTenant = Annotated[dict, Depends(get_current_tenant)]
