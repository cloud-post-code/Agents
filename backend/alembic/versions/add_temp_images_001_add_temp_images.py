"""Add temp_images table for temporary image storage.

Revision ID: add_temp_images_001
Revises: g2b3c4d5e6f7
Create Date: 2026-06-25 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "add_temp_images_001"
down_revision = "g2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "temp_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("image_data", sa.Text, nullable=False),
        sa.Column("content_type", sa.String(64), nullable=False, server_default="image/jpeg"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("temp_images")
