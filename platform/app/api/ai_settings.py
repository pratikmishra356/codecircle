"""AI / LLM configuration — global default or per-workspace.

Global: GET/PUT /api/platform/ai-config (used as fallback when workspace has no config).
Workspace: GET/PUT /api/platform/workspaces/{id}/ai-config (pushes only to that workspace's orgs).
"""

from __future__ import annotations

import logging
import os
import uuid

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


async def get_or_create_ai_config(db: AsyncSession, workspace_id: uuid.UUID | None = None) -> AIConfig:
    """Get or create AI config for global (workspace_id=None) or a specific workspace."""
    if workspace_id is None:
        result = await db.execute(select(AIConfig).where(AIConfig.workspace_id.is_(None)).limit(1))
        cfg = result.scalar_one_or_none()
        if cfg is None:
            cfg = AIConfig(
                workspace_id=None,
                provider="bedrock" if os.getenv("CLAUDE_BEDROCK_URL") else "claude",
                api_key=os.getenv("CLAUDE_API_KEY", ""),
                base_url=os.getenv("CLAUDE_BEDROCK_URL", ""),
                model_id=os.getenv("CLAUDE_MODEL_ID", ""),
                max_tokens=4096,
            )
            db.add(cfg)
            await db.commit()
            await db.refresh(cfg)
            logger.info("AI config (global) seeded from environment variables")
        return cfg

    result = await db.execute(select(AIConfig).where(AIConfig.workspace_id == workspace_id).limit(1))
    cfg = result.scalar_one_or_none()
    if cfg is None:
        # New workspace config: copy provider/URL/model from global for form defaults,
        # but leave api_key empty so "Configure AI settings" is not done until the user saves.
        global_result = await db.execute(select(AIConfig).where(AIConfig.workspace_id.is_(None)).limit(1))
        global_cfg = global_result.scalar_one_or_none()
        cfg = AIConfig(
            workspace_id=workspace_id,
            provider=global_cfg.provider if global_cfg else "bedrock",
            api_key=None,  # Empty until user configures; do not copy from global
            base_url=global_cfg.base_url if global_cfg else os.getenv("CLAUDE_BEDROCK_URL", ""),
            model_id=global_cfg.model_id if global_cfg else os.getenv("CLAUDE_MODEL_ID", ""),
            max_tokens=global_cfg.max_tokens if global_cfg else 4096,
        )
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
        logger.info("AI config created for workspace %s (api_key left empty)", workspace_id)
    return cfg


@router.get("", response_model=AIConfigResponse)
async def get_ai_config(db: AsyncSession = Depends(get_db)):
    """Get global AI / LLM configuration (default for all workspaces)."""
    cfg = await get_or_create_ai_config(db, workspace_id=None)
    return _to_response(cfg)


async def _push_to_services(cfg: AIConfig):
    """Push AI config to one workspace's orgs, or all workspaces if cfg is global."""
    from app.database import async_session

    payload = {
        "claude_api_key": cfg.api_key or "",
        "claude_bedrock_url": cfg.base_url or "",
        "claude_model_id": cfg.model_id or "",
        "claude_max_tokens": cfg.max_tokens,
    }

    async with async_session() as db:
        if cfg.workspace_id is not None:
            result = await db.execute(select(Workspace).where(Workspace.id == cfg.workspace_id))
            ws = result.scalar_one_or_none()
            workspaces = [ws] if ws else []
        else:
            result = await db.execute(select(Workspace))
            workspaces = result.scalars().all()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for ws in workspaces:
            if not ws:
                continue
            if ws.fixai_org_id:
                url = f"{platform_settings.fixai_url}/api/v1/organizations/{ws.fixai_org_id}/ai-config"
                try:
                    resp = await client.put(url, json=payload)
                    resp.raise_for_status()
                    logger.info("Pushed AI config to FixAI org %s", ws.fixai_org_id)
                except Exception as e:
                    logger.warning("Failed to push AI config to FixAI org %s: %s", ws.fixai_org_id, e)
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
    """Save global AI / LLM configuration and push to all connected service orgs."""
    cfg = await get_or_create_ai_config(db, workspace_id=None)
    cfg.provider = body.provider
    if body.api_key is not None:
        cfg.api_key = body.api_key
    cfg.base_url = body.base_url
    cfg.model_id = body.model_id
    cfg.max_tokens = body.max_tokens
    await db.commit()
    await db.refresh(cfg)
    logger.info("AI config (global) updated (provider=%s, model=%s)", cfg.provider, cfg.model_id)
    background_tasks.add_task(_push_to_services, cfg)
    return _to_response(cfg)


@router.get("/raw")
async def get_ai_config_raw(db: AsyncSession = Depends(get_db)):
    """Return raw global AI config for internal service consumption."""
    cfg = await get_or_create_ai_config(db, workspace_id=None)
    return {
        "provider": cfg.provider,
        "claude_api_key": cfg.api_key or "",
        "claude_bedrock_url": cfg.base_url or "",
        "claude_model_id": cfg.model_id or "",
        "claude_max_tokens": cfg.max_tokens,
    }
