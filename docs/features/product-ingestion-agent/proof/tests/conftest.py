"""Test fixtures for product ingestion proof tests."""
import os
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker


# Set test environment
os.environ["APP_ENV"] = "test"


@pytest_asyncio.fixture
async def db_session():
    """Create a test database session."""
    # Import after env is set
    from app.core.config import settings
    from app.models.product import Product, ProductVariant, StockAdjustment
    
    # Use test database from env
    engine = create_async_engine(
        settings.database_url,  # lowercase
        echo=False,
    )

    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Product.__table__.create, checkfirst=True)
        await conn.run_sync(ProductVariant.__table__.create, checkfirst=True)
        await conn.run_sync(StockAdjustment.__table__.create, checkfirst=True)

    # Create session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()
        
        # Clean up test data
        await session.execute(Product.__table__.delete())
        await session.execute(ProductVariant.__table__.delete())
        await session.execute(StockAdjustment.__table__.delete())
        await session.commit()

    await engine.dispose()


@pytest.fixture
def mock_vision_model():
    """Create a mock vision/AI model for testing."""
    mock_model = AsyncMock()
    mock_response = AsyncMock()
    mock_response.content = "Mock AI response"
    mock_model.ainvoke = AsyncMock(return_value=mock_response)
    return mock_model
