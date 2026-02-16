"""Workspace CRUD + service connection endpoints."""

from __future__ import annotations

import logging
import uuid

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import settings
from app.database import get_db
from app.models.workspace import Workspace
from app.schemas.workspace import (
    ConnectServiceRequest,
    CreateFixAIOrgRequest,
    ServiceIds,
    ServiceOrg,
    WorkspaceCreate,
    WorkspaceListItem,
    WorkspaceResponse,
)
from app.schemas.ai_config import AIConfigResponse, AIConfigUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/platform", tags=["workspaces"])

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


# ── Helpers ──────────────────────────────────────────────────────────


def _to_response(ws: Workspace) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        status=ws.status,
        service_ids=ServiceIds(
            fixai_org_id=ws.fixai_org_id,
            metrics_org_id=ws.metrics_org_id,
            logs_org_id=ws.logs_org_id,
            code_parser_org_id=ws.code_parser_org_id,
            code_parser_repo_id=ws.code_parser_repo_id,
        ),
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


def _to_list_item(ws: Workspace) -> WorkspaceListItem:
    return WorkspaceListItem(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        status=ws.status,
        service_ids=ServiceIds(
            fixai_org_id=ws.fixai_org_id,
            metrics_org_id=ws.metrics_org_id,
            logs_org_id=ws.logs_org_id,
            code_parser_org_id=ws.code_parser_org_id,
            code_parser_repo_id=ws.code_parser_repo_id,
        ),
        created_at=ws.created_at,
    )


# ═══════════════════════════════════════════════════════════════════
# Service org listing (proxy to downstream services)
# These MUST be declared before /workspaces/{workspace_id} routes
# to avoid FastAPI trying to parse "services" as a UUID.
# ═══════════════════════════════════════════════════════════════════


async def _fetch_orgs(url: str) -> list[dict]:
    """GET orgs from a service, return raw list."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning("Failed to fetch orgs from %s: %s", url, e)
        return []


@router.get("/services/fixai/orgs", response_model=list[ServiceOrg])
async def list_fixai_orgs():
    raw = await _fetch_orgs(f"{settings.fixai_url}/api/v1/organizations")
    return [ServiceOrg(id=str(o.get("id", "")), name=o.get("name", ""), slug=o.get("slug"), description=o.get("description")) for o in raw]


@router.get("/services/metrics/orgs", response_model=list[ServiceOrg])
async def list_metrics_orgs():
    """Metrics Explorer doesn't have a list orgs API, so query its DB directly."""
    try:
        db_url = settings.database_url.rsplit("/", 1)[0] + "/metrics_explorer"
        engine = create_async_engine(db_url, pool_size=1, max_overflow=0)
        async with engine.connect() as conn:
            result = await conn.execute(
                text("SELECT id::text, name, slug, description FROM organizations ORDER BY name")
            )
            rows = result.fetchall()
        await engine.dispose()
        return [ServiceOrg(id=r[0], name=r[1], slug=r[2], description=r[3]) for r in rows]
    except Exception as e:
        logger.warning("Failed to query metrics_explorer DB: %s", e)
        return []


@router.get("/services/logs/orgs", response_model=list[ServiceOrg])
async def list_logs_orgs():
    raw = await _fetch_orgs(f"{settings.logs_explorer_url}/api/v1/organizations")
    return [ServiceOrg(id=str(o.get("id", "")), name=o.get("name", ""), slug=o.get("slug"), description=o.get("description")) for o in raw]


@router.get("/services/code_parser/orgs", response_model=list[ServiceOrg])
async def list_code_parser_orgs():
    raw = await _fetch_orgs(f"{settings.code_parser_url}/api/v1/orgs")
    return [ServiceOrg(id=str(o.get("id", "")), name=o.get("name", ""), slug=o.get("slug"), description=o.get("description")) for o in raw]


# ═══════════════════════════════════════════════════════════════════
# Workspace CRUD
# ═══════════════════════════════════════════════════════════════════


@router.get("/workspaces", response_model=list[WorkspaceListItem])
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
    return [_to_list_item(ws) for ws in result.scalars().all()]


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Workspace).where(Workspace.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' already exists")

    ws = Workspace(name=body.name, slug=body.slug, status="active")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _to_response(ws)


# ── Workspace-scoped AI config ───────────────────────────────────────


@router.get("/workspaces/{workspace_id}/ai-config", response_model=AIConfigResponse)
async def get_workspace_ai_config(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get AI config for this workspace (creates from global default if missing)."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    from app.api.ai_settings import get_or_create_ai_config, _to_response
    cfg = await get_or_create_ai_config(db, workspace_id=workspace_id)
    return _to_response(cfg)


@router.put("/workspaces/{workspace_id}/ai-config", response_model=AIConfigResponse)
async def save_workspace_ai_config(
    workspace_id: uuid.UUID,
    body: AIConfigUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Save AI config for this workspace and push only to this workspace's connected orgs."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    from app.api.ai_settings import get_or_create_ai_config, _to_response, _push_to_services
    cfg = await get_or_create_ai_config(db, workspace_id=workspace_id)
    cfg.provider = body.provider
    if body.api_key is not None:
        cfg.api_key = body.api_key
    cfg.base_url = body.base_url
    cfg.model_id = body.model_id
    cfg.max_tokens = body.max_tokens
    await db.commit()
    await db.refresh(cfg)
    logger.info("AI config (workspace %s) updated", workspace_id)
    background_tasks.add_task(_push_to_services, cfg)
    return _to_response(cfg)


@router.delete("/workspaces/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await db.delete(ws)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
# Create FixAI org from CodeCircle
# ═══════════════════════════════════════════════════════════════════


@router.post(
    "/workspaces/{workspace_id}/create-fixai-org",
    response_model=WorkspaceResponse,
    status_code=201,
)
async def create_fixai_org(
    workspace_id: uuid.UUID,
    body: CreateFixAIOrgRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a FixAI organisation pre-populated with connected service details
    and automatically link it to this workspace.

    Requires at least one of Code Parser, Metrics, or Logs to be connected first.
    """
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if ws.fixai_org_id:
        raise HTTPException(status_code=409, detail="FixAI org is already connected to this workspace")

    # At least one supporting service must be connected
    has_services = any([ws.code_parser_org_id, ws.metrics_org_id, ws.logs_org_id])
    if not has_services:
        raise HTTPException(
            status_code=400,
            detail="Connect at least one service (Code Parser, Metrics, or Logs) before creating a FixAI org",
        )

    # Build the FixAI create payload with service mappings
    create_payload: dict = {
        "name": body.name,
        "slug": body.slug,
    }
    create_payload.update(_build_fixai_service_mappings(ws))

    # Call FixAI to create the org
    url = f"{settings.fixai_url}/api/v1/organizations"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=create_payload)
            resp.raise_for_status()
            fixai_org = resp.json()
    except httpx.HTTPStatusError as e:
        detail = e.response.text if e.response else str(e)
        raise HTTPException(
            status_code=e.response.status_code if e.response else 502,
            detail=f"FixAI org creation failed: {detail}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach FixAI: {e}")

    # Link the new FixAI org to this workspace
    new_org_id = str(fixai_org.get("id", ""))
    ws.fixai_org_id = new_org_id
    await db.commit()
    await db.refresh(ws)

    # Push AI config in background
    background_tasks.add_task(_push_ai_config_to_org, "fixai", new_org_id)

    return _to_response(ws)


# ═══════════════════════════════════════════════════════════════════
# Connect / Disconnect service orgs to workspace
# ═══════════════════════════════════════════════════════════════════


def _build_fixai_service_mappings(ws: Workspace) -> dict:
    """Build the service URL/org payload that FixAI needs, from workspace state."""
    payload: dict = {}
    if ws.code_parser_org_id:
        payload["code_parser_base_url"] = settings.code_parser_url
        payload["code_parser_org_id"] = ws.code_parser_org_id
        payload["code_parser_repo_id"] = ws.code_parser_repo_id
    else:
        payload["code_parser_base_url"] = None
        payload["code_parser_org_id"] = None
        payload["code_parser_repo_id"] = None

    if ws.metrics_org_id:
        payload["metrics_explorer_base_url"] = settings.metrics_explorer_url
        payload["metrics_explorer_org_id"] = ws.metrics_org_id
    else:
        payload["metrics_explorer_base_url"] = None
        payload["metrics_explorer_org_id"] = None

    if ws.logs_org_id:
        payload["logs_explorer_base_url"] = settings.logs_explorer_url
        payload["logs_explorer_org_id"] = ws.logs_org_id
    else:
        payload["logs_explorer_base_url"] = None
        payload["logs_explorer_org_id"] = None

    return payload


async def _sync_service_mappings_to_fixai(ws: Workspace):
    """Push current service URLs/org IDs from workspace to the connected FixAI org."""
    if not ws.fixai_org_id:
        return
    payload = _build_fixai_service_mappings(ws)
    url = f"{settings.fixai_url}/api/v1/organizations/{ws.fixai_org_id}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.patch(url, json=payload)
            resp.raise_for_status()
            logger.info("Synced service mappings to FixAI org %s", ws.fixai_org_id)
    except Exception as e:
        logger.warning("Failed to sync service mappings to FixAI org %s: %s", ws.fixai_org_id, e)


async def _push_ai_config_to_org(service: str, org_id: str):
    """Push current AI config to a single service org when it gets connected."""
    from app.database import async_session
    from app.models.ai_config import AIConfig

    async with async_session() as db:
        result = await db.execute(select(AIConfig).limit(1))
        cfg = result.scalar_one_or_none()

    if not cfg or not cfg.api_key:
        return  # Nothing to push

    payload = {
        "claude_api_key": cfg.api_key or "",
        "claude_bedrock_url": cfg.base_url or "",
        "claude_model_id": cfg.model_id or "",
        "claude_max_tokens": cfg.max_tokens,
    }

    if service == "fixai":
        url = f"{settings.fixai_url}/api/v1/organizations/{org_id}/ai-config"
    elif service == "code_parser":
        url = f"{settings.code_parser_url}/api/v1/orgs/{org_id}/ai-config"
    else:
        return

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.put(url, json=payload)
            resp.raise_for_status()
            logger.info("Pushed AI config to %s org %s on connect", service, org_id)
    except Exception as e:
        logger.warning("Failed to push AI config to %s org %s: %s", service, org_id, e)


@router.post("/workspaces/{workspace_id}/connect", response_model=WorkspaceResponse)
async def connect_service(
    workspace_id: uuid.UUID,
    body: ConnectServiceRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Link a service organization to this workspace."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if body.service == "fixai":
        ws.fixai_org_id = body.org_id
    elif body.service == "metrics":
        ws.metrics_org_id = body.org_id
    elif body.service == "logs":
        ws.logs_org_id = body.org_id
    elif body.service == "code_parser":
        ws.code_parser_org_id = body.org_id
        if body.repo_id:
            ws.code_parser_repo_id = body.repo_id

    await db.commit()
    await db.refresh(ws)

    # Push current AI config to the newly connected org
    if body.service in ("fixai", "code_parser"):
        background_tasks.add_task(_push_ai_config_to_org, body.service, body.org_id)

    # If a non-FixAI service was connected, sync mappings to FixAI org
    if body.service != "fixai" and ws.fixai_org_id:
        background_tasks.add_task(_sync_service_mappings_to_fixai, ws)

    return _to_response(ws)


@router.delete("/workspaces/{workspace_id}/disconnect/{service}", response_model=WorkspaceResponse)
async def disconnect_service(
    workspace_id: uuid.UUID,
    service: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Unlink a service organization from this workspace."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if service == "fixai":
        ws.fixai_org_id = None
    elif service == "metrics":
        ws.metrics_org_id = None
    elif service == "logs":
        ws.logs_org_id = None
    elif service == "code_parser":
        ws.code_parser_org_id = None
        ws.code_parser_repo_id = None
    else:
        raise HTTPException(status_code=400, detail=f"Unknown service: {service}")

    await db.commit()
    await db.refresh(ws)

    # Sync updated (now-null) mappings to FixAI org
    if service != "fixai" and ws.fixai_org_id:
        background_tasks.add_task(_sync_service_mappings_to_fixai, ws)

    return _to_response(ws)
