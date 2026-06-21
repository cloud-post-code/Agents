"""File upload endpoint for agent chat - images and CSV files."""
import base64
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.agent import AgentMessage, AgentSession
from app.models.user import User
from app.services.ingestion import ProductIngestionService

router = APIRouter(prefix="/agent/upload", tags=["agent-upload"])


# Maximum file sizes
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_CSV_SIZE = 50 * 1024 * 1024    # 50MB

# Allowed file types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
ALLOWED_CSV_TYPES = {"text/csv", "application/csv", "text/plain"}


@router.post("/image")
async def upload_image_for_ingestion(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    quantity: Optional[int] = Form(None),
    unique_id: Optional[str] = Form(None),
    sku: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an image for product ingestion.
    
    Can be used in two modes:
    1. With metadata (price, quantity, unique_id) - immediately ingests product
    2. Without metadata - stores image and returns file_id for agent to process
    """
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Read file
    contents = await file.read()
    
    # Validate size
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large. Maximum size: {MAX_IMAGE_SIZE / 1024 / 1024}MB"
        )
    
    # If complete metadata provided, ingest immediately
    if price is not None and quantity is not None and unique_id:
        service = ProductIngestionService(db=db, tenant_id=current_user.tenant_id)
        
        user_input = {
            "price": price,
            "quantity": quantity,
            "unique_id": unique_id,
            "sku": sku,
        }
        
        try:
            products = await service.ingest_from_image(
                image_data=contents,
                user_input=user_input,
            )
            
            # Log to agent session if provided
            if session_id:
                await _log_to_session(
                    db=db,
                    session_id=session_id,
                    tenant_id=current_user.tenant_id,
                    content=f"[Image uploaded and ingested: {len(products)} product(s) created]",
                )
            
            return {
                "status": "success",
                "message": f"Successfully imported {len(products)} product(s)",
                "products": products,
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to ingest product: {str(e)}"
            )
    
    # Otherwise, store image and return for agent to process
    image_base64 = base64.b64encode(contents).decode()
    file_id = str(uuid.uuid4())
    
    # Store in session for agent access
    # TODO: Store in temporary file storage or database
    # For now, return base64 for agent to process
    
    # Log to agent session
    if session_id:
        await _log_to_session(
            db=db,
            session_id=session_id,
            tenant_id=current_user.tenant_id,
            content=f"[Image uploaded: {file.filename}, size: {len(contents)} bytes]",
        )
    
    return {
        "status": "uploaded",
        "file_id": file_id,
        "filename": file.filename,
        "size": len(contents),
        "content_type": file.content_type,
        "image_base64": image_base64,  # For immediate agent processing
        "message": "Image uploaded. Provide price, quantity, and unique_id to ingest.",
    }


@router.post("/csv")
async def upload_csv_for_ingestion(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    auto_ingest: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a CSV file for bulk product ingestion.
    
    Parameters:
    - file: CSV file with product data
    - auto_ingest: If true, immediately processes CSV. If false, returns preview.
    - session_id: Optional agent session to log to
    """
    # Validate file type
    if file.content_type not in ALLOWED_CSV_TYPES and not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Must be CSV."
        )
    
    # Read file
    contents = await file.read()
    
    # Validate size
    if len(contents) > MAX_CSV_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV too large. Maximum size: {MAX_CSV_SIZE / 1024 / 1024}MB"
        )
    
    if auto_ingest:
        # Process CSV immediately
        service = ProductIngestionService(db=db, tenant_id=current_user.tenant_id)
        
        try:
            result = await service.ingest_from_csv(csv_data=contents)
            
            # Log to agent session
            if session_id:
                await _log_to_session(
                    db=db,
                    session_id=session_id,
                    tenant_id=current_user.tenant_id,
                    content=f"[CSV uploaded and processed: {result['success']} products imported, {len(result['errors'])} errors]",
                )
            
            return {
                "status": "success",
                "message": f"Imported {result['success']} products. {len(result['errors'])} errors.",
                "imported": result["success"],
                "errors": result["errors"],
                "products": result["products"],
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process CSV: {str(e)}"
            )
    else:
        # Return preview only
        csv_base64 = base64.b64encode(contents).decode()
        
        # Log to agent session
        if session_id:
            await _log_to_session(
                db=db,
                session_id=session_id,
                tenant_id=current_user.tenant_id,
                content=f"[CSV uploaded: {file.filename}, size: {len(contents)} bytes - preview mode]",
            )
        
        return {
            "status": "uploaded",
            "filename": file.filename,
            "size": len(contents),
            "csv_base64": csv_base64,
            "message": "CSV uploaded. Set auto_ingest=true to process.",
        }


async def _log_to_session(
    db: AsyncSession,
    session_id: str,
    tenant_id: uuid.UUID,
    content: str,
):
    """Log a system message to an agent session."""
    try:
        # Verify session exists
        result = await db.execute(
            select(AgentSession).where(AgentSession.id == uuid.UUID(session_id))
        )
        session = result.scalar_one_or_none()
        
        if session:
            msg = AgentMessage(
                session_id=uuid.UUID(session_id),
                tenant_id=tenant_id,
                role="system",
                content=content,
            )
            db.add(msg)
            await db.commit()
    except Exception:
        # Don't fail upload if logging fails
        pass
