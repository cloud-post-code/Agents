"""report engine — add status and template_id columns

Revision ID: eac08e40c76f
Revises: b2c3d4e5f6a7
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'eac08e40c76f'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reports', sa.Column('template_id', sa.String(128), nullable=True))
    op.add_column('reports', sa.Column('status', sa.String(32), server_default='pending', nullable=False))


def downgrade() -> None:
    op.drop_column('reports', 'status')
    op.drop_column('reports', 'template_id')
