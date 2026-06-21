"""facebook sync — product_sync_status and integration_sync_errors tables

Revision ID: b2c3d4e5f6a7
Revises: 1001883849f1
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = '1001883849f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_sync_status',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('integration_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(64), nullable=False, server_default='pending'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('facebook_catalog_item_id', sa.String(256), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['integration_id'], ['integrations.id']),
        sa.UniqueConstraint('tenant_id', 'product_id', 'integration_id',
                           name='uq_product_sync_status'),
    )

    op.create_table(
        'integration_sync_errors',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('integration_id', sa.UUID(), nullable=True),
        sa.Column('product_id', sa.UUID(), nullable=True),
        sa.Column('error_code', sa.String(128), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text('now()')),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('integration_sync_errors')
    op.drop_table('product_sync_status')
