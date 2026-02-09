"""Pydantic schemas for workspace API requests and responses."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class AIConfig(BaseModel):
    llm_provider: str = Field(..., pattern=r"^(anthropic|bedrock)$")
    llm_api_key: str | None = None
    llm_bedrock_url: str | None = None
    llm_model_id: str | None = None


class MetricsConfig(BaseModel):
    provider: str = Field(..., pattern=r"^(datadog|prometheus|grafana)$")
    # Datadog
    api_key: str | None = None
    app_key: str | None = None
    site: str | None = None  # e.g. "datadoghq.com"
    # Prometheus / Grafana
    endpoint_url: str | None = None
    bearer_token: str | None = None
    username: str | None = None
    password: str | None = None


class LogsConfig(BaseModel):
    provider: str = Field(default="splunk_cloud", pattern=r"^(splunk_cloud)$")
    host_url: str
    cookie: str | None = None
    csrf_token: str | None = None


class CodeConfig(BaseModel):
    repo_path: str
    repo_name: str | None = None


class SetupWizardRequest(BaseModel):
    """Complete setup in one shot, or step-by-step."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    ai: AIConfig | None = None
    metrics: MetricsConfig | None = None
    logs: LogsConfig | None = None
    code: CodeConfig | None = None


# ── Response schemas ─────────────────────────────────────────────────


class ServiceIds(BaseModel):
    fixai_org_id: uuid.UUID | None = None
    metrics_org_id: uuid.UUID | None = None
    logs_org_id: uuid.UUID | None = None
    code_parser_org_id: str | None = None
    code_parser_repo_id: str | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str

    llm_provider: str | None = None
    llm_model_id: str | None = None
    has_llm_key: bool = False

    metrics_provider: str | None = None
    metrics_endpoint_url: str | None = None
    has_metrics_credentials: bool = False

    logs_provider: str | None = None
    logs_host_url: str | None = None
    has_logs_credentials: bool = False

    code_repo_path: str | None = None
    code_repo_name: str | None = None

    service_ids: ServiceIds = Field(default_factory=ServiceIds)

    error_message: str | None = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListItem(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    llm_provider: str | None = None
    metrics_provider: str | None = None
    logs_provider: str | None = None
    code_repo_name: str | None = None
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthStatus(BaseModel):
    service: str
    url: str
    healthy: bool
    latency_ms: float | None = None
    error: str | None = None


class PlatformHealth(BaseModel):
    platform: str = "ok"
    services: list[HealthStatus] = []
