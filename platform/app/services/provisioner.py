"""Provisioner — creates organizations and pushes credentials to each downstream service."""

from __future__ import annotations

import logging
import uuid

import httpx

from app.config import settings
from app.models.workspace import Workspace
from app.schemas.workspace import (
    AIConfig,
    CodeConfig,
    LogsConfig,
    MetricsConfig,
)

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


async def _post(url: str, json: dict) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(url, json=json)
        resp.raise_for_status()
        return resp.json()


async def _put(url: str, json: dict) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.put(url, json=json)
        resp.raise_for_status()
        return resp.json()


async def _patch(url: str, json: dict) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.patch(url, json=json)
        resp.raise_for_status()
        return resp.json()


async def _get(url: str, headers: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, headers=headers or {})
        resp.raise_for_status()
        return resp.json()


# ─── Metrics Explorer ────────────────────────────────────────────────


async def provision_metrics(workspace: Workspace, config: MetricsConfig) -> uuid.UUID:
    """Create org + provider in metrics-explorer and return the org UUID."""
    base = settings.metrics_explorer_url

    # 1. Create organization
    org_data = await _post(f"{base}/api/v1/organizations", json={
        "name": workspace.name,
        "slug": workspace.slug,
        "description": f"CodeCircle workspace: {workspace.name}",
    })
    org_id = org_data["id"]

    # 2. Add provider with credentials (metrics-explorer expects provider_type lowercase enum value)
    credentials: dict = {}
    endpoint_url: str | None = config.endpoint_url

    if config.provider == "datadog":
        credentials = {"api_key": config.api_key, "app_key": config.app_key}
        if config.site:
            credentials["site"] = config.site
    elif config.provider == "prometheus":
        if config.username:
            credentials["username"] = config.username
        if config.password:
            credentials["password"] = config.password
        if config.bearer_token:
            credentials["bearer_token"] = config.bearer_token
    elif config.provider == "grafana":
        credentials = {"api_key": config.bearer_token or config.api_key or ""}

    payload = {
        "provider_type": config.provider,
        "name": f"{config.provider} - {workspace.name}",
        "credentials": credentials,
    }
    if endpoint_url:
        payload["endpoint_url"] = endpoint_url

    await _post(f"{base}/api/v1/organizations/{org_id}/providers", json=payload)

    return uuid.UUID(org_id)


# ─── Logs Explorer ───────────────────────────────────────────────────


async def provision_logs(workspace: Workspace, config: LogsConfig) -> uuid.UUID:
    """Create org + provider in logs-explorer and return the org UUID."""
    base = settings.logs_explorer_url

    # 1. Create organization
    org_data = await _post(f"{base}/api/v1/organizations", json={
        "name": workspace.name,
        "slug": workspace.slug,
        "description": f"CodeCircle workspace: {workspace.name}",
    })
    org_id = org_data["id"]

    # 2. Set provider connection
    await _put(f"{base}/api/v1/organizations/{org_id}/provider", json={
        "provider_type": config.provider,
        "name": f"Splunk - {workspace.name}",
        "host_url": config.host_url,
        "auth_type": "cookie",
        "credentials": {
            "cookie": config.cookie or "",
            "csrf_token": config.csrf_token or "",
        },
    })

    return uuid.UUID(org_id)


# ─── Code Parser ─────────────────────────────────────────────────────


async def provision_code(workspace: Workspace, config: CodeConfig) -> tuple[str, str]:
    """Create org + submit repo in code-parser. Returns (org_id, repo_id)."""
    base = settings.code_parser_url

    # 1. Create organization
    # Code-parser CreateOrganizationRequest has name + description only (no slug)
    org_data = await _post(f"{base}/api/v1/orgs", json={
        "name": workspace.name,
        "description": f"CodeCircle workspace: {workspace.name}",
    })
    org_id = org_data["id"]

    # 2. Submit repository for parsing
    repo_name = config.repo_name or config.repo_path.rstrip("/").split("/")[-1]
    repo_data = await _post(f"{base}/api/v1/repos", json={
        "path": config.repo_path,
        "name": repo_name,
        "org_id": org_id,
    })
    repo_id = repo_data["id"]

    return org_id, repo_id


# ─── FixAI ───────────────────────────────────────────────────────────


async def provision_fixai(
    workspace: Workspace,
    *,
    metrics_org_id: uuid.UUID | None = None,
    logs_org_id: uuid.UUID | None = None,
    code_parser_org_id: str | None = None,
    code_parser_repo_id: str | None = None,
) -> uuid.UUID:
    """Create organization in fixai that references the other three services."""
    base = settings.fixai_url

    # FixAI expects optional UUID/str as null, not empty string (422 otherwise)
    org_data = await _post(f"{base}/api/v1/organizations", json={
        "name": workspace.name,
        "slug": workspace.slug,
        "description": f"CodeCircle workspace: {workspace.name}",
        "code_parser_base_url": settings.code_parser_url,
        "code_parser_org_id": code_parser_org_id,
        "code_parser_repo_id": code_parser_repo_id,
        "metrics_explorer_base_url": settings.metrics_explorer_url,
        "metrics_explorer_org_id": str(metrics_org_id) if metrics_org_id else None,
        "logs_explorer_base_url": settings.logs_explorer_url,
        "logs_explorer_org_id": str(logs_org_id) if logs_org_id else None,
    })

    return uuid.UUID(org_data["id"])


# ─── Full Provisioning ──────────────────────────────────────────────


async def provision_workspace(
    workspace: Workspace,
    *,
    ai: AIConfig | None = None,
    metrics: MetricsConfig | None = None,
    logs: LogsConfig | None = None,
    code: CodeConfig | None = None,
) -> dict:
    """Provision all downstream services for a workspace. Returns updated IDs."""
    errors: list[str] = []
    metrics_org_id: uuid.UUID | None = None
    logs_org_id: uuid.UUID | None = None
    code_parser_org_id: str | None = None
    code_parser_repo_id: str | None = None

    # 1. Metrics
    if metrics:
        try:
            metrics_org_id = await provision_metrics(workspace, metrics)
        except Exception as e:
            logger.error("Failed to provision metrics: %s", e)
            errors.append(f"Metrics: {e}")

    # 2. Logs
    if logs:
        try:
            logs_org_id = await provision_logs(workspace, logs)
        except Exception as e:
            logger.error("Failed to provision logs: %s", e)
            errors.append(f"Logs: {e}")

    # 3. Code
    if code:
        try:
            code_parser_org_id, code_parser_repo_id = await provision_code(workspace, code)
        except Exception as e:
            logger.error("Failed to provision code parser: %s", e)
            errors.append(f"Code: {e}")

    # 4. FixAI (always — it's the core agent)
    fixai_org_id: uuid.UUID | None = None
    try:
        fixai_org_id = await provision_fixai(
            workspace,
            metrics_org_id=metrics_org_id,
            logs_org_id=logs_org_id,
            code_parser_org_id=code_parser_org_id,
            code_parser_repo_id=code_parser_repo_id,
        )
    except Exception as e:
        logger.error("Failed to provision fixai: %s", e)
        errors.append(f"FixAI: {e}")

    return {
        "fixai_org_id": fixai_org_id,
        "metrics_org_id": metrics_org_id,
        "logs_org_id": logs_org_id,
        "code_parser_org_id": code_parser_org_id,
        "code_parser_repo_id": code_parser_repo_id,
        "errors": errors,
    }
