"""Real tool implementations for product ingestion."""
import base64
import uuid

from langchain_core.tools import tool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.user import User
from app.services.ingestion import ProductIngestionService


async def _ingest_product_from_image_impl(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    image_base64: str,
    price: float,
    quantity: int,
    unique_id: str,
    sku: str = "",
) -> dict:
    """Implementation of product ingestion from image."""
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_base64)
        
        # Create service
        service = ProductIngestionService(db=db, tenant_id=tenant_id)
        
        # Prepare user input
        user_input = {
            "price": price,
            "quantity": quantity,
            "unique_id": unique_id,
            "sku": sku if sku else None,
        }
        
        # Ingest
        products = await service.ingest_from_image(
            image_data=image_bytes,
            user_input=user_input,
        )
        
        if products:
            return {
                "status": "success",
                "message": f"Successfully imported {len(products)} product(s) from image",
                "products": products,
            }
        else:
            return {
                "status": "error",
                "message": "No products could be extracted from image",
                "products": [],
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to ingest product: {str(e)}",
            "products": [],
        }


async def _ingest_products_from_csv_impl(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    csv_base64: str,
) -> dict:
    """Implementation of bulk product ingestion from CSV."""
    try:
        # Decode base64 CSV
        csv_bytes = base64.b64decode(csv_base64)
        
        # Create service
        service = ProductIngestionService(db=db, tenant_id=tenant_id)
        
        # Ingest
        result = await service.ingest_from_csv(csv_data=csv_bytes)
        
        return {
            "status": "success" if result["success"] > 0 else "error",
            "message": f"Imported {result['success']} products. {len(result['errors'])} errors.",
            "imported": result["success"],
            "errors": result["errors"],
            "products": result["products"],
        }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to process CSV: {str(e)}",
            "imported": 0,
            "errors": [{"error": str(e)}],
            "products": [],
        }
