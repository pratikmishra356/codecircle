"""Pydantic schemas for AI / LLM configuration."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AIConfigUpdate(BaseModel):
    """Request body for saving AI config."""

    provider: str = Field("bedrock", pattern=r"^(claude|bedrock)$")
    api_key: str | None = None
    base_url: str | None = None
    model_id: str | None = None
    max_tokens: int = Field(4096, ge=1, le=100000)


class AIConfigResponse(BaseModel):
    """Response body for AI config."""

    provider: str
    api_key_set: bool  # Never expose the raw key — just whether it's configured
    api_key_preview: str | None = None  # Last 8 chars for identification
    base_url: str | None
    model_id: str | None
    max_tokens: int
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
