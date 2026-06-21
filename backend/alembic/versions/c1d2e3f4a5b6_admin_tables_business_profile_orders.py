"""admin_tables_business_profile_orders

Revision ID: c1d2e3f4a5b6
Revises: 5507c62d344f
Create Date: 2026-06-21 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = '5507c62d344f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # tenant_business_profile — one row per tenant
    op.create_table(
        'tenant_business_profile',
        sa.Column('id', postgresql.UUID(as_uuid=False), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=False, unique=True),
        sa.Column('business_name', sa.String(256), nullable=True),
        sa.Column('shop_description', sa.Text, nullable=True),
        sa.Column('entity_type', sa.String(64), nullable=True),
        sa.Column('address_line1', sa.String(256), nullable=True),
        sa.Column('address_line2', sa.String(256), nullable=True),
        sa.Column('city', sa.String(128), nullable=True),
        sa.Column('state', sa.String(64), nullable=True),
        sa.Column('postal_code', sa.String(32), nullable=True),
        sa.Column('country', sa.String(64), nullable=True),
        sa.Column('contact_email', sa.String(256), nullable=True),
        sa.Column('contact_phone', sa.String(64), nullable=True),
        sa.Column('website', sa.String(512), nullable=True),
        sa.Column('shipping_policy', sa.Text, nullable=True),
        sa.Column('cancellation_policy', sa.Text, nullable=True),
        sa.Column('shipping_flat_rate_cents', sa.Integer, nullable=True),
        sa.Column('shipping_weight_tiers', postgresql.JSONB, nullable=True),
        sa.Column('shipping_free_threshold_cents', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.execute("ALTER TABLE tenant_business_profile ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_business_profile FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_business_profile_tenant_isolation ON tenant_business_profile "
        "USING (tenant_id::uuid = current_setting('app.tenant_id')::uuid)"
    )
    op.create_index('idx_tenant_business_profile_tenant_id', 'tenant_business_profile', ['tenant_id'])

    # orders
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=False), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('customer_name', sa.String(256), nullable=False),
        sa.Column('customer_address_line1', sa.String(256), nullable=True),
        sa.Column('customer_address_line2', sa.String(256), nullable=True),
        sa.Column('customer_city', sa.String(128), nullable=True),
        sa.Column('customer_state', sa.String(64), nullable=True),
        sa.Column('customer_postal_code', sa.String(32), nullable=True),
        sa.Column('customer_country', sa.String(64), nullable=True),
        sa.Column('status', sa.String(32), server_default='pending', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.execute("ALTER TABLE orders ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE orders FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY orders_tenant_isolation ON orders "
        "USING (tenant_id::uuid = current_setting('app.tenant_id')::uuid)"
    )
    op.create_index('idx_orders_tenant_id', 'orders', ['tenant_id'])
    op.create_index('idx_orders_status', 'orders', ['tenant_id', 'status'])

    # order_line_items
    op.create_table(
        'order_line_items',
        sa.Column('id', postgresql.UUID(as_uuid=False), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('description', sa.String(512), nullable=False),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_price_cents', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.execute("ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE order_line_items FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY order_line_items_tenant_isolation ON order_line_items "
        "USING (tenant_id::uuid = current_setting('app.tenant_id')::uuid)"
    )
    op.create_index('idx_order_line_items_order_id', 'order_line_items', ['order_id'])

    # order_shipping
    op.create_table(
        'order_shipping',
        sa.Column('id', postgresql.UUID(as_uuid=False), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=False), sa.ForeignKey('orders.id'), nullable=False, unique=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('carrier', sa.String(128), nullable=True),
        sa.Column('tracking_number', sa.String(256), nullable=True),
        sa.Column('shipping_cost_cents', sa.Integer, nullable=True),
        sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.execute("ALTER TABLE order_shipping ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE order_shipping FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY order_shipping_tenant_isolation ON order_shipping "
        "USING (tenant_id::uuid = current_setting('app.tenant_id')::uuid)"
    )


def downgrade() -> None:
    op.drop_table('order_shipping')
    op.drop_table('order_line_items')
    op.drop_table('orders')
    op.drop_table('tenant_business_profile')
