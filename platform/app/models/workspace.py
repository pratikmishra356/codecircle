"""Workspace model — top-level container that links to organizations in each service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # ── Linked service organization IDs ───────────────────────────────
    fixai_org_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metrics_org_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logs_org_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    code_parser_org_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    code_parser_repo_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Status ────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(50), default="active")  # active

    # ── Timestamps ────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
