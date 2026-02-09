"""Setup wizard endpoints — step-by-step or all-at-once workspace provisioning."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.workspace import Workspace
from app.schemas.workspace import (
    AIConfig,
    CodeConfig,
    LogsConfig,
    MetricsConfig,
    SetupWizardRequest,
    WorkspaceResponse,
    ServiceIds,
)
from app.services.provisioner import provision_workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/platform/setup", tags=["setup"])


def _to_response(ws: Workspace) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        slug=ws.slug,
        status=ws.status,
        llm_provider=ws.llm_provider,
        llm_model_id=ws.llm_model_id,
        has_llm_key=bool(ws.llm_api_key_encrypted),
        metrics_provider=ws.metrics_provider,
        metrics_endpoint_url=ws.metrics_endpoint_url,
        has_metrics_credentials=bool(ws.metrics_credentials_encrypted),
        logs_provider=ws.logs_provider,
        logs_host_url=ws.logs_host_url,
        has_logs_credentials=bool(ws.logs_credentials_encrypted),
        code_repo_path=ws.code_repo_path,
        code_repo_name=ws.code_repo_name,
        service_ids=ServiceIds(
            fixai_org_id=ws.fixai_org_id,
            metrics_org_id=ws.metrics_org_id,
            logs_org_id=ws.logs_org_id,
            code_parser_org_id=ws.code_parser_org_id,
            code_parser_repo_id=ws.code_parser_repo_id,
        ),
        error_message=ws.error_message,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


# ── Step endpoints (save config without provisioning) ────────────────


@router.patch("/{workspace_id}/ai", response_model=WorkspaceResponse)
async def save_ai_config(
    workspace_id: uuid.UUID,
    body: AIConfig,
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws.llm_provider = body.llm_provider
    ws.llm_api_key_encrypted = body.llm_api_key or ""  # TODO: encrypt
    ws.llm_bedrock_url = body.llm_bedrock_url
    ws.llm_model_id = body.llm_model_id
    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


@router.patch("/{workspace_id}/metrics", response_model=WorkspaceResponse)
async def save_metrics_config(
    workspace_id: uuid.UUID,
    body: MetricsConfig,
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws.metrics_provider = body.provider
    ws.metrics_endpoint_url = body.endpoint_url
    # Store credentials as dict (encrypt in production)
    creds = {}
    if body.api_key:
        creds["api_key"] = body.api_key
    if body.app_key:
        creds["app_key"] = body.app_key
    if body.site:
        creds["site"] = body.site
    if body.bearer_token:
        creds["bearer_token"] = body.bearer_token
    if body.username:
        creds["username"] = body.username
    if body.password:
        creds["password"] = body.password
    ws.metrics_credentials_encrypted = creds

    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


@router.patch("/{workspace_id}/logs", response_model=WorkspaceResponse)
async def save_logs_config(
    workspace_id: uuid.UUID,
    body: LogsConfig,
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws.logs_provider = body.provider
    ws.logs_host_url = body.host_url
    ws.logs_credentials_encrypted = {
        "cookie": body.cookie or "",
        "csrf_token": body.csrf_token or "",
    }

    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


@router.patch("/{workspace_id}/code", response_model=WorkspaceResponse)
async def save_code_config(
    workspace_id: uuid.UUID,
    body: CodeConfig,
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws.code_repo_path = body.repo_path
    ws.code_repo_name = body.repo_name or body.repo_path.rstrip("/").split("/")[-1]

    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


# ── Provision (finalize setup) ───────────────────────────────────────


@router.post("/{workspace_id}/provision", response_model=WorkspaceResponse)
async def provision(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Provision all downstream services based on saved configuration."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws.status = "provisioning"
    await db.commit()

    # Build config objects from stored workspace data
    ai_config = None
    if ws.llm_provider:
        ai_config = AIConfig(
            llm_provider=ws.llm_provider,
            llm_api_key=ws.llm_api_key_encrypted,
            llm_bedrock_url=ws.llm_bedrock_url,
            llm_model_id=ws.llm_model_id,
        )

    metrics_config = None
    if ws.metrics_provider and ws.metrics_credentials_encrypted:
        creds = ws.metrics_credentials_encrypted
        metrics_config = MetricsConfig(
            provider=ws.metrics_provider,
            api_key=creds.get("api_key"),
            app_key=creds.get("app_key"),
            site=creds.get("site"),
            endpoint_url=ws.metrics_endpoint_url,
            bearer_token=creds.get("bearer_token"),
            username=creds.get("username"),
            password=creds.get("password"),
        )

    logs_config = None
    if ws.logs_provider and ws.logs_credentials_encrypted:
        creds = ws.logs_credentials_encrypted
        logs_config = LogsConfig(
            provider=ws.logs_provider,
            host_url=ws.logs_host_url or "",
            cookie=creds.get("cookie"),
            csrf_token=creds.get("csrf_token"),
        )

    code_config = None
    if ws.code_repo_path:
        code_config = CodeConfig(
            repo_path=ws.code_repo_path,
            repo_name=ws.code_repo_name,
        )

    result = await provision_workspace(
        ws,
        ai=ai_config,
        metrics=metrics_config,
        logs=logs_config,
        code=code_config,
    )

    # Update workspace with service IDs
    ws.fixai_org_id = result["fixai_org_id"]
    ws.metrics_org_id = result["metrics_org_id"]
    ws.logs_org_id = result["logs_org_id"]
    ws.code_parser_org_id = result["code_parser_org_id"]
    ws.code_parser_repo_id = result["code_parser_repo_id"]

    if result["errors"]:
        ws.status = "error"
        ws.error_message = "; ".join(result["errors"])
    else:
        ws.status = "ready"
        ws.error_message = None

    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


# ── All-in-one setup ────────────────────────────────────────────────


@router.post("/complete", response_model=WorkspaceResponse, status_code=201)
async def setup_complete(
    body: SetupWizardRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create workspace and provision everything in one request."""
    from sqlalchemy import select

    # Check slug uniqueness
    existing = await db.execute(select(Workspace).where(Workspace.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' already exists")

    ws = Workspace(name=body.name, slug=body.slug, status="provisioning")

    # Save AI config
    if body.ai:
        ws.llm_provider = body.ai.llm_provider
        ws.llm_api_key_encrypted = body.ai.llm_api_key or ""
        ws.llm_bedrock_url = body.ai.llm_bedrock_url
        ws.llm_model_id = body.ai.llm_model_id

    # Save Metrics config
    if body.metrics:
        ws.metrics_provider = body.metrics.provider
        ws.metrics_endpoint_url = body.metrics.endpoint_url
        creds = {}
        if body.metrics.api_key:
            creds["api_key"] = body.metrics.api_key
        if body.metrics.app_key:
            creds["app_key"] = body.metrics.app_key
        if body.metrics.site:
            creds["site"] = body.metrics.site
        if body.metrics.bearer_token:
            creds["bearer_token"] = body.metrics.bearer_token
        ws.metrics_credentials_encrypted = creds

    # Save Logs config
    if body.logs:
        ws.logs_provider = body.logs.provider
        ws.logs_host_url = body.logs.host_url
        ws.logs_credentials_encrypted = {
            "cookie": body.logs.cookie or "",
            "csrf_token": body.logs.csrf_token or "",
        }

    # Save Code config
    if body.code:
        ws.code_repo_path = body.code.repo_path
        ws.code_repo_name = body.code.repo_name or body.code.repo_path.rstrip("/").split("/")[-1]

    db.add(ws)
    await db.commit()
    await db.refresh(ws)

    # Provision downstream services
    result = await provision_workspace(
        ws,
        ai=body.ai,
        metrics=body.metrics,
        logs=body.logs,
        code=body.code,
    )

    ws.fixai_org_id = result["fixai_org_id"]
    ws.metrics_org_id = result["metrics_org_id"]
    ws.logs_org_id = result["logs_org_id"]
    ws.code_parser_org_id = result["code_parser_org_id"]
    ws.code_parser_repo_id = result["code_parser_repo_id"]

    if result["errors"]:
        ws.status = "error"
        ws.error_message = "; ".join(result["errors"])
    else:
        ws.status = "ready"
        ws.error_message = None

    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)
