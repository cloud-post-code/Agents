"""persistent_agent_sessions_unique_per_role

Revision ID: 5507c62d344f
Revises: eac08e40c76f
Create Date: 2026-06-21 14:58:35.986482

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '5507c62d344f'
down_revision: Union[str, None] = 'eac08e40c76f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add updated_at to agent_sessions for recency tracking
    op.add_column(
        "agent_sessions",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Deduplicate existing rows before adding the unique constraint:
    # keep the earliest session per (tenant_id, agent_role), delete the rest.
    op.execute("""
        DELETE FROM agent_sessions
        WHERE id NOT IN (
            SELECT DISTINCT ON (tenant_id, agent_role) id
            FROM agent_sessions
            ORDER BY tenant_id, agent_role, created_at ASC
        )
    """)

    # One persistent thread per (tenant, role)
    op.create_unique_constraint(
        "uq_agent_sessions_tenant_role",
        "agent_sessions",
        ["tenant_id", "agent_role"],
    )

    # Index for fast get-or-create lookup
    op.create_index(
        "idx_agent_sessions_tenant_role",
        "agent_sessions",
        ["tenant_id", "agent_role"],
    )


def downgrade() -> None:
    op.drop_index("idx_agent_sessions_tenant_role", table_name="agent_sessions")
    op.drop_constraint("uq_agent_sessions_tenant_role", "agent_sessions", type_="unique")
    op.drop_column("agent_sessions", "updated_at")
