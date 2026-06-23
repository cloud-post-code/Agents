"""brand_dna table

Revision ID: f1a2b3c4d5e6
Revises: eac08e40c76f
Create Date: 2026-06-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f1a2b3c4d5e6"
down_revision = "5507c62d344f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brand_dna",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("brand_name", sa.String(256), nullable=True),
        sa.Column("tagline", sa.String(512), nullable=True),
        sa.Column("overview", sa.Text, nullable=True),
        sa.Column("product_category", sa.String(256), nullable=True),
        sa.Column("target_audience", sa.Text, nullable=True),
        sa.Column("tone_adjectives", postgresql.JSONB, nullable=True),
        sa.Column("writing_style", sa.Text, nullable=True),
        sa.Column("primary_color", sa.String(16), nullable=True),
        sa.Column("primary_color_inverse", sa.String(16), nullable=True),
        sa.Column("secondary_color", sa.String(16), nullable=True),
        sa.Column("secondary_color_inverse", sa.String(16), nullable=True),
        sa.Column("logo_url", sa.String(1024), nullable=True),
        sa.Column("logo_ratio", sa.String(16), nullable=True),
        sa.Column("font_family", sa.String(128), nullable=True),
        sa.Column("font_weights", postgresql.JSONB, nullable=True),
        sa.Column("background_style", sa.Text, nullable=True),
        sa.Column("imagery_style", sa.Text, nullable=True),
        sa.Column("typography_vibe", sa.Text, nullable=True),
        sa.Column("source", sa.String(64), nullable=True),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("raw_extraction", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_brand_dna_tenant_id", "brand_dna", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_brand_dna_tenant_id", table_name="brand_dna")
    op.drop_table("brand_dna")
