"""AI / LLM configuration endpoints — single global config.

On save, pushes the config to all connected FixAI and Code Parser orgs
via their PUT /organizations/{org_id}/ai-config endpoints.
"""

from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as platform_settings
from app.database import get_db
from app.models.ai_config import AIConfig
from app.models.workspace import Workspace
from app.schemas.ai_config import AIConfigResponse, AIConfigUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/platform/ai-config", tags=["ai-config"])

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _to_response(cfg: AIConfig) -> AIConfigResponse:
    key = cfg.api_key or ""
    return AIConfigResponse(
        provider=cfg.provider,
        api_key_set=bool(key),
        api_key_preview=f"...{key[-8:]}" if len(key) > 8 else None,
        base_url=cfg.base_url,
        model_id=cfg.model_id,
        max_tokens=cfg.max_tokens,
        updated_at=cfg.updated_at,
    )


async def _get_or_create(db: AsyncSession) -> AIConfig:
    """Return the singleton AI config row, creating it if absent."""
    result = await db.execute(select(AIConfig).limit(1))
    cfg = result.scalar_one_or_none()
    if cfg is None:
        # Seed from environment variables on first access
        cfg = AIConfig(
            provider="bedrock" if os.getenv("CLAUDE_BEDROCK_URL") else "claude",
            api_key=os.getenv("CLAUDE_API_KEY", ""),
            base_url=os.getenv("CLAUDE_BEDROCK_URL", ""),
            model_id=os.getenv("CLAUDE_MODEL_ID", ""),
            max_tokens=4096,
        )
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
        logger.info("AI config seeded from environment variables")
    return cfg


@router.get("", response_model=AIConfigResponse)
async def get_ai_config(db: AsyncSession = Depends(get_db)):
    """Get the current AI / LLM configuration."""
    cfg = await _get_or_create(db)
    return _to_response(cfg)


async def _push_to_services(cfg: AIConfig):
    """Push AI config to all connected FixAI and Code Parser orgs across all workspaces."""
    from app.database import async_session

    payload = {
        "claude_api_key": cfg.api_key or "",
        "claude_bedrock_url": cfg.base_url or "",
        "claude_model_id": cfg.model_id or "",
        "claude_max_tokens": cfg.max_tokens,
    }

    async with async_session() as db:
        result = await db.execute(select(Workspace))
        workspaces = result.scalars().all()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for ws in workspaces:
            # Push to FixAI org
            if ws.fixai_org_id:
                url = f"{platform_settings.fixai_url}/api/v1/organizations/{ws.fixai_org_id}/ai-config"
                try:
                    resp = await client.put(url, json=payload)
                    resp.raise_for_status()
                    logger.info("Pushed AI config to FixAI org %s", ws.fixai_org_id)
                except Exception as e:
                    logger.warning("Failed to push AI config to FixAI org %s: %s", ws.fixai_org_id, e)

            # Push to Code Parser org
            if ws.code_parser_org_id:
                url = f"{platform_settings.code_parser_url}/api/v1/orgs/{ws.code_parser_org_id}/ai-config"
                try:
                    resp = await client.put(url, json=payload)
                    resp.raise_for_status()
                    logger.info("Pushed AI config to Code Parser org %s", ws.code_parser_org_id)
                except Exception as e:
                    logger.warning("Failed to push AI config to Code Parser org %s: %s", ws.code_parser_org_id, e)


@router.put("", response_model=AIConfigResponse)
async def save_ai_config(
    body: AIConfigUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Save AI / LLM configuration and push to connected service orgs."""
    cfg = await _get_or_create(db)
    cfg.provider = body.provider
    if body.api_key is not None:
        cfg.api_key = body.api_key
    cfg.base_url = body.base_url
    cfg.model_id = body.model_id
    cfg.max_tokens = body.max_tokens
    await db.commit()
    await db.refresh(cfg)
    logger.info("AI config updated (provider=%s, model=%s)", cfg.provider, cfg.model_id)

    # Push to connected services in background
    background_tasks.add_task(_push_to_services, cfg)

    return _to_response(cfg)


@router.get("/raw")
async def get_ai_config_raw(db: AsyncSession = Depends(get_db)):
    """Return raw AI config for internal service consumption.

    Services like FixAI and Code Parser can call this endpoint on
    startup to get the centrally managed AI configuration.
    Endpoint: GET http://platform:8200/api/platform/ai-config/raw
    """
    cfg = await _get_or_create(db)
    return {
        "provider": cfg.provider,
        "claude_api_key": cfg.api_key or "",
        "claude_bedrock_url": cfg.base_url or "",
        "claude_model_id": cfg.model_id or "",
        "claude_max_tokens": cfg.max_tokens,
    }
