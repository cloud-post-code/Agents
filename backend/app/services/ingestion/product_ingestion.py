"""Product ingestion service - handles image and CSV-based product import."""
import uuid
from typing import Any, Optional

import pandas as pd
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product, ProductVariant


class ProductIngestionService:
    """Service for ingesting products from images and CSV files."""

    def __init__(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        vision_model: Optional[ChatOpenAI] = None,
    ):
        self.db = db
        self.tenant_id = tenant_id
        # Allow dependency injection for testing
        self.vision_model = vision_model or ChatOpenAI(model="gpt-4o", max_tokens=1024)

    async def ingest_from_image(
        self,
        image_data: bytes | str,
        user_input: dict[str, Any],
    ) -> list[dict]:
        """
        Ingest products from image with user-provided price/quantity.

        Args:
            image_data: Image bytes or base64 string
            user_input: Dict with price, quantity, unique_id, optional sku

        Returns:
            List of created product dicts
        """
        # Convert image to base64 if it's bytes
        import base64
        if isinstance(image_data, bytes):
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        else:
            image_base64 = image_data
        
        # Extract product info from image using vision AI
        product_info = await self._extract_from_image(image_data)

        # Merge with user input
        products_to_create = []
        for item in product_info.get("items", []):
            product_data = {
                "name": item.get("name"),
                "description": item.get("description"),
                "price": user_input.get("price"),
                "stock_qty": user_input.get("quantity"),
                "unique_id": user_input.get("unique_id"),
                "sku": user_input.get("sku"),
                "tags": item.get("tags", []),
                "variants": item.get("variants", []),
                "image_data": image_base64,  # Store the image
            }
            products_to_create.append(product_data)

        # Validate and create products
        created = []
        for product_data in products_to_create:
            validated = await self._validate_product(product_data)
            if validated["valid"]:
                product = await self._create_product(product_data)
                created.append(product)
            else:
                # TODO: Handle validation errors
                pass

        return created

    async def ingest_from_csv(self, csv_data: bytes | str) -> dict:
        """
        Ingest products from CSV file with auto-detection.

        Args:
            csv_data: CSV file content as bytes or string

        Returns:
            Dict with success count, errors, created products
        """
        # Auto-detect CSV structure
        df = self._detect_csv_structure(csv_data)

        results = {"success": 0, "errors": [], "products": []}

        for idx, row in df.iterrows():
            try:
                product_data = self._map_csv_row(row)
                validated = await self._validate_product(product_data)

                if validated["valid"]:
                    product = await self._create_product(product_data)
                    results["products"].append(product)
                    results["success"] += 1
                else:
                    results["errors"].append({
                        "row": idx,
                        "errors": validated["errors"],
                    })
            except Exception as e:
                results["errors"].append({"row": idx, "error": str(e)})

        return results

    async def _extract_from_image(self, image_data: bytes | str) -> dict:
        """Use vision AI to extract product information from image."""
        prompt = """Analyze this product image and extract:
        1. Product name
        2. Detailed description (what it is, materials, features, use cases)
        3. Identify if there are multiple distinct products in the image
        4. Identify if there are variants (different colors/sizes of same product)
        5. Generate relevant tags (categories, materials, style, use case)

        Return as JSON with structure:
        {
            "items": [
                {
                    "name": "Product Name",
                    "description": "Detailed description",
                    "tags": ["tag1", "tag2"],
                    "variants": [{"name": "variant", "description": ""}]
                }
            ]
        }
        """

        # Prepare message with image
        if isinstance(image_data, bytes):
            import base64
            image_b64 = base64.b64encode(image_data).decode()
        else:
            image_b64 = image_data

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                },
            ]
        )

        response = await self.vision_model.ainvoke([message])
        
        # Parse JSON response
        import json
        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            # Fallback if not valid JSON
            result = {
                "items": [{
                    "name": "Product",
                    "description": response.content,
                    "tags": [],
                    "variants": [],
                }]
            }

        return result

    def _detect_csv_structure(self, csv_data: bytes | str) -> pd.DataFrame:
        """Auto-detect CSV delimiter and structure."""
        import io

        if isinstance(csv_data, bytes):
            csv_data = csv_data.decode("utf-8")

        # Try different delimiters
        for sep in [",", "\t", "|", ";"]:
            try:
                df = pd.read_csv(io.StringIO(csv_data), sep=sep)
                if len(df.columns) > 1:  # Valid multi-column CSV
                    return df
            except Exception:
                continue

        # Default to comma
        return pd.read_csv(io.StringIO(csv_data))

    def _map_csv_row(self, row: pd.Series) -> dict:
        """Map CSV row to product data structure."""
        # Smart column mapping
        column_map = {}
        for col in row.index:
            col_lower = col.lower().strip()
            if col_lower in ["name", "product_name", "title"]:
                column_map["name"] = col
            elif col_lower in ["price", "selling_price", "retail_price"]:
                column_map["price"] = col
            elif col_lower in ["quantity", "stock", "stock_qty", "qty", "inventory"]:
                column_map["stock_qty"] = col
            elif col_lower in ["description", "desc", "details"]:
                column_map["description"] = col
            elif col_lower in ["unique_id", "id", "product_id"]:
                column_map["unique_id"] = col
            elif col_lower in ["sku", "sku_code"]:
                column_map["sku"] = col
            elif col_lower in ["cost", "cost_price"]:
                column_map["cost"] = col

        return {
            "name": row.get(column_map.get("name")),
            "price": float(row.get(column_map.get("price", ""), 0)),
            "stock_qty": int(row.get(column_map.get("stock_qty", ""), 0)),
            "description": row.get(column_map.get("description", "")),
            "unique_id": str(row.get(column_map.get("unique_id", ""))),
            "sku": row.get(column_map.get("sku")),
            "cost": float(row.get(column_map.get("cost", ""), 0)) or None,
        }

    async def _validate_product(self, product_data: dict) -> dict:
        """Validate product data against requirements."""
        errors = []

        # Required fields
        if not product_data.get("name"):
            errors.append("name is required")
        if not product_data.get("price"):
            errors.append("price is required")
        if product_data.get("stock_qty") is None:
            errors.append("quantity is required")
        if not product_data.get("description"):
            errors.append("description is required")
        if not product_data.get("unique_id"):
            errors.append("unique_id is required")

        # Check duplicate unique_id
        if product_data.get("unique_id"):
            existing = await self.db.execute(
                select(Product).where(
                    Product.tenant_id == self.tenant_id,
                    Product.extra_data["unique_id"].astext == product_data["unique_id"],
                )
            )
            if existing.scalar_one_or_none():
                errors.append(f"duplicate unique_id: {product_data['unique_id']}")

        # Check duplicate SKU (if provided)
        if product_data.get("sku"):
            existing = await self.db.execute(
                select(Product).where(
                    Product.tenant_id == self.tenant_id,
                    Product.sku == product_data["sku"],
                )
            )
            if existing.scalar_one_or_none():
                errors.append(f"duplicate sku: {product_data['sku']}")

        return {"valid": len(errors) == 0, "errors": errors}

    async def _create_product(self, product_data: dict) -> dict:
        """Create product in database."""
        # Enrich description with AI
        enriched_description = await self._enrich_description(
            product_data.get("description", ""),
            product_data.get("name", ""),
        )

        # Generate tags with AI
        tags = await self._generate_tags(
            product_data.get("name", ""),
            enriched_description,
        )

        # Create product
        product = Product(
            tenant_id=self.tenant_id,
            name=product_data["name"],
            price=product_data.get("price"),
            cost=product_data.get("cost"),
            stock_qty=product_data.get("stock_qty", 0),
            sku=product_data.get("sku"),
            description=enriched_description,
            image_url=product_data.get("image_url"),  # External URL if provided
            image_data=product_data.get("image_data"),  # Base64 image data
            extra_data={
                "unique_id": product_data["unique_id"],
                "tags": tags,
            },
        )

        self.db.add(product)
        await self.db.flush()

        # Create variants if any
        for variant_data in product_data.get("variants", []):
            variant = ProductVariant(
                tenant_id=self.tenant_id,
                product_id=product.id,
                name=variant_data.get("name", ""),
                sku=variant_data.get("sku"),
                price=variant_data.get("price"),
                stock_qty=variant_data.get("stock_qty", 0),
            )
            self.db.add(variant)

        await self.db.commit()

        return {
            "id": str(product.id),
            "name": product.name,
            "description": product.description,
            "tags": tags,
            "price": float(product.price) if product.price else None,
            "stock_qty": product.stock_qty,
            "image_url": product.image_url,
            "image_data": product.image_data,  # Return for display
        }

    async def _enrich_description(self, description: str, name: str) -> str:
        """Use AI to enrich product description."""
        if not description or len(description) < 20:
            # Generate from scratch
            prompt = f"Write a detailed, compelling product description for: {name}. Focus on materials, features, benefits, and use cases. 2-3 sentences."
        else:
            # Enhance existing
            prompt = f"Enhance this product description to be more detailed and compelling: {description}"

        response = await self.vision_model.ainvoke([HumanMessage(content=prompt)])
        return response.content.strip()

    async def _generate_tags(self, name: str, description: str) -> list[str]:
        """Generate relevant tags using AI."""
        prompt = f"""Generate 5-8 relevant tags for this product.
Product: {name}
Description: {description}

Tags should include: category, materials, style, use case, target audience.
Return as comma-separated list."""

        response = await self.vision_model.ainvoke([HumanMessage(content=prompt)])
        tags_text = response.content.strip()

        # Parse tags
        tags = [tag.strip() for tag in tags_text.split(",")]
        return tags[:8]  # Limit to 8 tags
