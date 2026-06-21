"""product_discounts table

Revision ID: d1e2f3a4b5c6
Revises: add_product_images_table
Create Date: 2026-06-21 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'add_product_images_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_discounts',
        sa.Column('id', postgresql.UUID(as_uuid=False), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('discount_type', sa.String(32), nullable=False),
        sa.Column('name', sa.String(256), nullable=False),
        # sale fields
        sa.Column('sale_price_cents', sa.Integer, nullable=True),
        sa.Column('sale_percent', sa.Numeric(5, 2), nullable=True),
        # coupon fields
        sa.Column('coupon_code', sa.String(64), nullable=True),
        sa.Column('coupon_discount_cents', sa.Integer, nullable=True),
        sa.Column('coupon_discount_percent', sa.Numeric(5, 2), nullable=True),
        sa.Column('max_uses', sa.Integer, nullable=True),
        sa.Column('uses_count', sa.Integer, server_default='0', nullable=False),
        # bulk fields
        sa.Column('bulk_min_quantity', sa.Integer, nullable=True),
        sa.Column('bulk_discount_percent', sa.Numeric(5, 2), nullable=True),
        sa.Column('bulk_discount_cents_per_unit', sa.Integer, nullable=True),
        # common
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active', sa.Boolean, server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Unique coupon_code per tenant (partial index — only for non-null codes)
    op.create_index(
        'uq_product_discounts_tenant_coupon_code',
        'product_discounts',
        ['tenant_id', 'coupon_code'],
        unique=True,
        postgresql_where=sa.text('coupon_code IS NOT NULL'),
    )

    op.execute("ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE product_discounts FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY product_discounts_tenant_isolation ON product_discounts "
        "USING (tenant_id::uuid = current_setting('app.tenant_id')::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS product_discounts_tenant_isolation ON product_discounts")
    op.drop_index('uq_product_discounts_tenant_coupon_code', table_name='product_discounts')
    op.drop_table('product_discounts')
