"""r2_storage_migration: add temp_images.image_url, deprecate image_data columns

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "h3c4d5e6f7a8"
down_revision = "add_temp_images_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add image_url column to temp_images for R2 URLs
    op.add_column(
        "temp_images",
        sa.Column("image_url", sa.String(1024), nullable=True),
    )

    # Make image_data nullable — new rows won't set it
    op.alter_column("temp_images", "image_data", nullable=True)

    # Index for TTL-based cleanup task
    op.create_index("ix_temp_images_created_at", "temp_images", ["created_at"])

    # Document deprecation intent via DB comments
    op.execute(
        "COMMENT ON COLUMN products.image_data IS "
        "'DEPRECATED: use image_url. Legacy base64 records only — not written by new code.'"
    )
    op.execute(
        "COMMENT ON COLUMN temp_images.image_data IS "
        "'DEPRECATED: use image_url. Legacy base64 records only — not written by new code.'"
    )


def downgrade() -> None:
    op.drop_index("ix_temp_images_created_at", table_name="temp_images")
    op.alter_column("temp_images", "image_data", nullable=False)
    op.drop_column("temp_images", "image_url")
