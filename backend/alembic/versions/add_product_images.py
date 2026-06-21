"""
Add image_url and image_data columns to products table.

Revision ID: add_product_images
Revises: c1d2e3f4a5b6
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_product_images'
down_revision = 'c1d2e3f4a5b6'  # Updated to latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add image_url column for storing CDN/S3 URLs
    op.add_column('products', sa.Column('image_url', sa.String(1024), nullable=True))
    
    # Add image_data column for storing base64 images (optional, for small images)
    op.add_column('products', sa.Column('image_data', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'image_data')
    op.drop_column('products', 'image_url')
