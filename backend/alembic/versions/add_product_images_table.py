"""
Add product_images table for multiple images per product.

Revision ID: add_product_images_table
Revises: add_product_images
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_product_images_table'
down_revision = 'add_product_images'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'product_images',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('image_url', sa.String(1024), nullable=False),
        sa.Column('image_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_product_images_product_id', 'product_images', ['product_id'])
    op.create_index('ix_product_images_tenant_id', 'product_images', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_product_images_tenant_id', table_name='product_images')
    op.drop_index('ix_product_images_product_id', table_name='product_images')
    op.drop_table('product_images')
