"""AI / LLM configuration — global default or per-workspace."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AIConfig(Base):
    __tablename__ = "ai_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # When null: global default. When set: workspace-specific config.
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, unique=True
    )

    # Provider: "claude" (direct API) or "bedrock" (AWS Bedrock proxy)
    provider: Mapped[str] = mapped_column(String(50), default="bedrock")

    # API key / token (stored as plain text — local dev only)
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Bedrock / proxy base URL
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Model identifier
    model_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Max tokens (shared sensible default)
    max_tokens: Mapped[int] = mapped_column(default=4096)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
