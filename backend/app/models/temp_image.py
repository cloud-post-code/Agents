import uuid
from datetime import datetime
from sqlalchemy import DateTime, Text, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.engine import Base


class TempImage(Base):
    __tablename__ = "temp_images"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    image_data: Mapped[str] = mapped_column(Text, nullable=False)  # raw base64 (no data: prefix)
    content_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
