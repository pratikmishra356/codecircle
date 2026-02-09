"""Workspace model — the central concept that unifies organizations across all services."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String, Text
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

    # ── AI / LLM configuration ───────────────────────────────────────
    llm_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "anthropic" | "bedrock"
    llm_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_bedrock_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    llm_model_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Metrics provider configuration ───────────────────────────────
    metrics_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "datadog" | "prometheus" | "grafana"
    metrics_credentials_encrypted: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metrics_endpoint_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Logs provider configuration ──────────────────────────────────
    logs_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "splunk_cloud"
    logs_credentials_encrypted: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    logs_host_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Code configuration ───────────────────────────────────────────
    code_repo_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    code_repo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Service-side IDs (populated during provisioning) ─────────────
    fixai_org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    metrics_org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    logs_org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    code_parser_org_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    code_parser_repo_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Status ───────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(50), default="setup")  # setup | provisioning | ready | error
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ───────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
