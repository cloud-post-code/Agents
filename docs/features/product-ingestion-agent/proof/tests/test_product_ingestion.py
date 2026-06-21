"""
Feature proof tests for Product Ingestion Agent.

Tests the ability to ingest products from images and CSV files.
"""
import base64
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.product import Product, ProductVariant
from app.services.ingestion import ProductIngestionService


FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


# Mock AI responses for deterministic testing
MOCK_VISION_RESPONSE_SINGLE = {
    "items": [
        {
            "name": "Handmade Lavender Soap",
            "description": "Natural artisan soap handcrafted with pure lavender essential oils, shea butter, and organic ingredients. Perfect for sensitive skin.",
            "tags": ["handmade", "soap", "lavender", "natural", "skincare"],
            "variants": []
        }
    ]
}

MOCK_DESCRIPTION_ENRICHMENT = "Premium handcrafted artisan product made with natural materials and expert craftsmanship. Features exceptional quality and attention to detail."

MOCK_TAGS = ["handmade", "artisan", "premium", "natural", "craft"]


@pytest.mark.asyncio
async def test_ingest_single_product_from_image(db_session):
    """Test ingesting a single product from an image with AI extraction."""
    tenant_id = uuid.uuid4()
    
    # Create a mock vision model
    mock_model = AsyncMock()
    mock_response = AsyncMock()
    mock_response.content = '{"items": [{"name": "Handmade Lavender Soap", "description": "Natural artisan soap", "tags": ["handmade", "soap"], "variants": []}]}'
    mock_model.ainvoke = AsyncMock(return_value=mock_response)
    
    service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_model)

    # Create a simple test image (1x1 pixel)
    import io
    from PIL import Image
    
    img = Image.new('RGB', (100, 100), color='blue')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    image_bytes = buf.getvalue()

    user_input = {
        "price": 12.00,
        "quantity": 25,
        "unique_id": "TEST-PROD-001",
        "sku": "SOAP-TEST-001",
    }

    # Ingest product
    created_products = await service.ingest_from_image(
        image_data=image_bytes,
        user_input=user_input,
    )

    assert len(created_products) >= 1
    product = created_products[0]
    
    assert product["price"] == 12.00
    assert product["stock_qty"] == 25
    assert product["description"]  # AI should generate description
    assert product["tags"]  # AI should generate tags
    assert len(product["tags"]) > 0

    # Verify in database
    result = await db_session.execute(
        select(Product).where(Product.tenant_id == tenant_id)
    )
    db_product = result.scalar_one()
    assert db_product.price == 12.00
    assert db_product.stock_qty == 25
    assert db_product.extra_data["unique_id"] == "TEST-PROD-001"


@pytest.mark.asyncio
async def test_ingest_multiple_products_from_image(db_session):
    """Test detecting and ingesting multiple products from a single image."""
    # This test would use a mock that returns multiple items
    # For now, we'll skip since it requires actual multi-product image
    pytest.skip("Requires multi-product image fixture")


@pytest.mark.asyncio
async def test_ingest_product_variants_from_images(db_session):
    """Test detecting variants across multiple images."""
    pytest.skip("Requires variant detection implementation")


@pytest.mark.asyncio
async def test_ingest_products_from_csv(db_session):
    """Test bulk import from CSV file."""
    tenant_id = uuid.uuid4()
    
    # Create mock model that returns mock responses
    mock_model = AsyncMock()
    mock_response = AsyncMock()
    mock_response.content = MOCK_DESCRIPTION_ENRICHMENT
    mock_model.ainvoke = AsyncMock(return_value=mock_response)
    
    service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_model)

    # Load sample CSV
    csv_path = FIXTURES_DIR / "csv" / "sample_products.csv"
    with open(csv_path, "rb") as f:
        csv_data = f.read()

    # Mock tag generation to return comma-separated string
    with patch.object(service, '_generate_tags', return_value=MOCK_TAGS):
        # Ingest from CSV
        result = await service.ingest_from_csv(csv_data)

        assert result["success"] == 5  # 5 products in sample CSV
        assert len(result["errors"]) == 0
        assert len(result["products"]) == 5

        # Verify in database
        db_result = await db_session.execute(
            select(Product).where(Product.tenant_id == tenant_id)
        )
        products = db_result.scalars().all()
        assert len(products) == 5

        # Verify first product
        first_product = products[0]
        assert first_product.name == "Handmade Lavender Soap"
        assert first_product.sku == "SOAP-001"
        assert float(first_product.price) == 12.00
        assert first_product.stock_qty == 25


@pytest.mark.asyncio
async def test_csv_auto_detection(db_session, mock_vision_model):
    """Test auto-detection of CSV column structure."""
    tenant_id = uuid.uuid4()
    
    # Configure mock for tag generation
    mock_vision_model.ainvoke.return_value.content = ", ".join(MOCK_TAGS)
    
    service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_vision_model)

    # CSV with different column names
    csv_data = """product_name|selling_price|qty|details|id
Soap|10.00|5|Test soap|PROD-X"""

    with patch.object(service, '_generate_tags', return_value=MOCK_TAGS):
        result = await service.ingest_from_csv(csv_data)

        assert result["success"] == 1
        assert len(result["products"]) == 1
        product = result["products"][0]
        assert product["name"] == "Soap"
        assert product["price"] == 10.00
        assert product["stock_qty"] == 5


@pytest.mark.asyncio
async def test_duplicate_unique_id_rejected(db_session, mock_vision_model):
    """Test that duplicate unique_id is prevented."""
    tenant_id = uuid.uuid4()
    
    # Configure mock
    mock_vision_model.ainvoke.return_value.content = MOCK_DESCRIPTION_ENRICHMENT
    
    with patch.object(ProductIngestionService, '_generate_tags', return_value=MOCK_TAGS):
        service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_vision_model)

        # Create first product
        product_data = {
            "name": "Test Product",
            "price": 10.00,
            "stock_qty": 5,
            "description": "Test description",
            "unique_id": "DUPLICATE-ID",
            "sku": "SKU-1",
        }

        await service._create_product(product_data)

        # Try to create second product with same unique_id
        validation = await service._validate_product(product_data)
        
        assert not validation["valid"]
        assert any("duplicate unique_id" in error for error in validation["errors"])


@pytest.mark.asyncio
async def test_duplicate_sku_rejected(db_session, mock_vision_model):
    """Test that duplicate SKU is prevented."""
    tenant_id = uuid.uuid4()
    
    # Configure mock
    mock_vision_model.ainvoke.return_value.content = MOCK_DESCRIPTION_ENRICHMENT
    
    with patch.object(ProductIngestionService, '_generate_tags', return_value=MOCK_TAGS):
        service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_vision_model)

        # Create first product
        product_data_1 = {
            "name": "Product 1",
            "price": 10.00,
            "stock_qty": 5,
            "description": "Test",
            "unique_id": "UNIQUE-1",
            "sku": "DUPLICATE-SKU",
        }

        await service._create_product(product_data_1)

        # Try to create second product with same SKU
        product_data_2 = {
            "name": "Product 2",
            "price": 15.00,
            "stock_qty": 3,
            "description": "Test 2",
            "unique_id": "UNIQUE-2",
            "sku": "DUPLICATE-SKU",
        }

        validation = await service._validate_product(product_data_2)
        
        assert not validation["valid"]
        assert any("duplicate sku" in error for error in validation["errors"])


@pytest.mark.asyncio
async def test_ai_description_generation(db_session):
    """Test that AI generates enhanced descriptions."""
    tenant_id = uuid.uuid4()
    
    with patch('app.services.ingestion.product_ingestion.ChatOpenAI') as mock_openai:
        # Mock the AI response
        mock_response = AsyncMock()
        mock_response.content = MOCK_DESCRIPTION_ENRICHMENT
        mock_openai.return_value.ainvoke = AsyncMock(return_value=mock_response)
        
        service = ProductIngestionService(db=db_session, tenant_id=tenant_id)

        # Test with minimal description
        enriched = await service._enrich_description(
            description="soap",
            name="Lavender Soap",
        )

        assert len(enriched) > 20  # Should be more detailed
        assert enriched == MOCK_DESCRIPTION_ENRICHMENT


@pytest.mark.asyncio
async def test_ai_tag_generation(db_session):
    """Test that AI generates relevant tags."""
    tenant_id = uuid.uuid4()
    
    with patch('app.services.ingestion.product_ingestion.ChatOpenAI') as mock_openai:
        # Mock the AI response
        mock_response = AsyncMock()
        mock_response.content = ", ".join(MOCK_TAGS)
        mock_openai.return_value.ainvoke = AsyncMock(return_value=mock_response)
        
        service = ProductIngestionService(db=db_session, tenant_id=tenant_id)

        tags = await service._generate_tags(
            name="Handmade Lavender Soap",
            description="Natural artisan soap made with lavender essential oils",
        )

        assert len(tags) >= 3
        assert len(tags) <= 8
        assert all(isinstance(tag, str) for tag in tags)
        assert all(len(tag) > 0 for tag in tags)


@pytest.mark.asyncio
async def test_required_field_validation(db_session):
    """Test validation of required fields."""
    tenant_id = uuid.uuid4()
    
    # Use a mock model to avoid API key requirement
    mock_model = AsyncMock()
    service = ProductIngestionService(db=db_session, tenant_id=tenant_id, vision_model=mock_model)

    # Missing name
    result = await service._validate_product({
        "price": 10.00,
        "stock_qty": 5,
        "description": "Test",
        "unique_id": "TEST-1",
    })
    assert not result["valid"]
    assert any("name is required" in error for error in result["errors"])

    # Missing price
    result = await service._validate_product({
        "name": "Test",
        "stock_qty": 5,
        "description": "Test",
        "unique_id": "TEST-1",
    })
    assert not result["valid"]
    assert any("price is required" in error for error in result["errors"])

    # Missing unique_id
    result = await service._validate_product({
        "name": "Test",
        "price": 10.00,
        "stock_qty": 5,
        "description": "Test",
    })
    assert not result["valid"]
    assert any("unique_id is required" in error for error in result["errors"])


@pytest.mark.asyncio
async def test_tenant_isolation(db_session, mock_vision_model):
    """Test that products are properly isolated by tenant."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()

    # Configure mock
    mock_vision_model.ainvoke.return_value.content = MOCK_DESCRIPTION_ENRICHMENT
    
    with patch.object(ProductIngestionService, '_generate_tags', return_value=MOCK_TAGS):
        service_a = ProductIngestionService(db=db_session, tenant_id=tenant_a, vision_model=mock_vision_model)
        service_b = ProductIngestionService(db=db_session, tenant_id=tenant_b, vision_model=mock_vision_model)

        # Create product for tenant A
        product_data = {
            "name": "Tenant A Product",
            "price": 10.00,
            "stock_qty": 5,
            "description": "Test",
            "unique_id": "A-PROD-1",
        }
        await service_a._create_product(product_data)

        # Tenant B should not see tenant A's products
        result = await db_session.execute(
            select(Product).where(Product.tenant_id == tenant_b)
        )
        assert result.scalar_one_or_none() is None

        # Tenant A should see their product
        result = await db_session.execute(
            select(Product).where(Product.tenant_id == tenant_a)
        )
        assert result.scalar_one() is not None
