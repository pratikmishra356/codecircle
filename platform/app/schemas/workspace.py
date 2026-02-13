"""Pydantic schemas for workspace API requests and responses."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ConnectServiceRequest(BaseModel):
    """Link a service organization to this workspace."""
    service: str = Field(..., pattern=r"^(fixai|metrics|logs|code_parser)$")
    org_id: str = Field(..., min_length=1)
    repo_id: str | None = None  # only for code_parser


class CreateFixAIOrgRequest(BaseModel):
    """Create a FixAI org from CodeCircle, pre-populated with connected service details."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


# ── Response schemas ─────────────────────────────────────────────────


class ServiceIds(BaseModel):
    fixai_org_id: str | None = None
    metrics_org_id: str | None = None
    logs_org_id: str | None = None
    code_parser_org_id: str | None = None
    code_parser_repo_id: str | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    service_ids: ServiceIds = Field(default_factory=ServiceIds)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListItem(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    service_ids: ServiceIds = Field(default_factory=ServiceIds)
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


class ServiceOrg(BaseModel):
    """Generic representation of an org from any service."""
    id: str
    name: str
    slug: str | None = None
    description: str | None = None
