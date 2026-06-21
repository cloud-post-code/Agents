"""Test product count and catalog summary tools."""
import uuid
import pytest
from sqlalchemy import select

from app.models.product import Product
from app.services.product_tools import (
    get_product_count_impl,
    get_catalog_summary_impl,
    search_catalog_impl,
)


@pytest.mark.asyncio
async def test_get_product_count_empty(db):
    """Test product count with no products."""
    tenant_id = uuid.uuid4()
    
    result = await get_product_count_impl(db=db, tenant_id=tenant_id)
    
    assert result["total_products"] == 0
    assert "0 products" in result["message"]


@pytest.mark.asyncio
async def test_get_product_count_with_products(db):
    """Test product count with products."""
    tenant_id = uuid.uuid4()
    
    # Create test products
    for i in range(5):
        product = Product(
            tenant_id=tenant_id,
            name=f"Product {i}",
            sku=f"SKU-{i}",
            price=10.00,
            stock_qty=5,
            reorder_point=2,
        )
        db.add(product)
    await db.commit()
    
    result = await get_product_count_impl(db=db, tenant_id=tenant_id)
    
    assert result["total_products"] == 5
    assert "5 products" in result["message"]


@pytest.mark.asyncio
async def test_get_catalog_summary(db):
    """Test catalog summary with various products."""
    tenant_id = uuid.uuid4()
    
    # Product 1: Normal stock
    p1 = Product(
        tenant_id=tenant_id,
        name="Normal Product",
        sku="NORM-001",
        price=20.00,
        stock_qty=10,
        reorder_point=5,
    )
    # Product 2: Low stock
    p2 = Product(
        tenant_id=tenant_id,
        name="Low Stock Product",
        sku="LOW-001",
        price=30.00,
        stock_qty=3,
        reorder_point=5,
    )
    # Product 3: High value
    p3 = Product(
        tenant_id=tenant_id,
        name="High Value Product",
        sku="HIGH-001",
        price=100.00,
        stock_qty=5,
        reorder_point=2,
    )
    
    db.add_all([p1, p2, p3])
    await db.commit()
    
    result = await get_catalog_summary_impl(db=db, tenant_id=tenant_id)
    
    assert result["total_products"] == 3
    assert result["low_stock_count"] == 1  # Only p2
    assert result["total_value"] == (20*10 + 30*3 + 100*5)  # 200 + 90 + 500 = 790
    assert result["average_price"] == round((20 + 30 + 100) / 3, 2)  # 50.00
    assert "3" in result["message"]  # Total count in message


@pytest.mark.asyncio
async def test_search_catalog(db):
    """Test catalog search."""
    tenant_id = uuid.uuid4()
    
    # Create products with different searchable fields
    p1 = Product(
        tenant_id=tenant_id,
        name="Lavender Soap",
        sku="SOAP-LAV-001",
        description="Natural lavender scented soap",
        price=12.00,
        stock_qty=25,
    )
    p2 = Product(
        tenant_id=tenant_id,
        name="Vanilla Candle",
        sku="CANDLE-VAN-001",
        description="Hand-poured vanilla candle",
        price=18.00,
        stock_qty=15,
    )
    p3 = Product(
        tenant_id=tenant_id,
        name="Lavender Candle",
        sku="CANDLE-LAV-001",
        description="Lavender scented candle",
        price=20.00,
        stock_qty=10,
    )
    
    db.add_all([p1, p2, p3])
    await db.commit()
    
    # Search by name
    results = await search_catalog_impl(
        db=db,
        tenant_id=tenant_id,
        query="lavender",
        limit=10,
    )
    
    assert len(results) == 2  # p1 and p3 match "lavender"
    assert any(r["name"] == "Lavender Soap" for r in results)
    assert any(r["name"] == "Lavender Candle" for r in results)
    
    # Search by SKU
    results = await search_catalog_impl(
        db=db,
        tenant_id=tenant_id,
        query="CANDLE",
        limit=10,
    )
    
    assert len(results) == 2  # p2 and p3 have "CANDLE" in SKU
    
    # Search with limit
    results = await search_catalog_impl(
        db=db,
        tenant_id=tenant_id,
        query="lavender",
        limit=1,
    )
    
    assert len(results) == 1  # Limit enforced


@pytest.mark.asyncio
async def test_tenant_isolation(db):
    """Test that counts and searches are tenant-isolated."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    
    # Create product for tenant A
    p_a = Product(
        tenant_id=tenant_a,
        name="Tenant A Product",
        sku="A-001",
        price=10.00,
        stock_qty=5,
    )
    # Create product for tenant B
    p_b = Product(
        tenant_id=tenant_b,
        name="Tenant B Product",
        sku="B-001",
        price=20.00,
        stock_qty=10,
    )
    
    db.add_all([p_a, p_b])
    await db.commit()
    
    # Tenant A should only see their product
    count_a = await get_product_count_impl(db=db, tenant_id=tenant_a)
    assert count_a["total_products"] == 1
    
    # Tenant B should only see their product
    count_b = await get_product_count_impl(db=db, tenant_id=tenant_b)
    assert count_b["total_products"] == 1
    
    # Search should be isolated
    search_a = await search_catalog_impl(db=db, tenant_id=tenant_a, query="Product")
    assert len(search_a) == 1
    assert search_a[0]["name"] == "Tenant A Product"
