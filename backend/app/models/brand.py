"""Brand DNA model — stores per-tenant brand identity, visual config, and voice profile."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.engine import Base


class BrandDNA(Base):
    __tablename__ = "brand_dna"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)

    # Identity
    brand_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(512), nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_category: Mapped[str | None] = mapped_column(String(256), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Voice
    tone_adjectives: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # ["Elegant", ...]
    writing_style: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Visual
    primary_color: Mapped[str | None] = mapped_column(String(16), nullable=True)    # #ffea00
    primary_color_inverse: Mapped[str | None] = mapped_column(String(16), nullable=True)
    secondary_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    secondary_color_inverse: Mapped[str | None] = mapped_column(String(16), nullable=True)

    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    logo_ratio: Mapped[str | None] = mapped_column(String(16), nullable=True)  # "1:1" | "16:9"

    # Typography — Google Fonts only
    font_family: Mapped[str | None] = mapped_column(String(128), nullable=True)      # "Lato"
    font_weights: Mapped[list | None] = mapped_column(JSONB, nullable=True)          # [300, 400, 700]

    # Imagery & background direction
    background_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    imagery_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    typography_vibe: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source tracking
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)  # "website"|"upload"|"qa"
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Raw extraction cache
    raw_extraction: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
