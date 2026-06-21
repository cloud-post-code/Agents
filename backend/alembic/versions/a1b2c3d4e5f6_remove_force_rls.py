"""remove FORCE ROW LEVEL SECURITY — app user still subject to RLS, superuser bypasses for ops

Revision ID: a1b2c3d4e5f6
Revises: 947bcf42abfd
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '947bcf42abfd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TENANT_TABLES = [
    "products", "agent_sessions", "agent_messages", "tasks",
    "reports", "calendar_events", "notifications", "integrations",
]


def upgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
