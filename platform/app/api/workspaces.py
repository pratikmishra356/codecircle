"""Workspace CRUD endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.workspace import Workspace
from app.schemas.workspace import (
    ServiceIds,
    WorkspaceCreate,
    WorkspaceListItem,
    WorkspaceResponse,
)

router = APIRouter(prefix="/api/platform/workspaces", tags=["workspaces"])


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


@router.get("", response_model=list[WorkspaceListItem])
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()))
    workspaces = result.scalars().all()
    return [
        WorkspaceListItem(
            id=ws.id,
            name=ws.name,
            slug=ws.slug,
            status=ws.status,
            llm_provider=ws.llm_provider,
            metrics_provider=ws.metrics_provider,
            logs_provider=ws.logs_provider,
            code_repo_name=ws.code_repo_name,
            error_message=ws.error_message,
            created_at=ws.created_at,
        )
        for ws in workspaces
    ]


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    # Check slug uniqueness
    existing = await db.execute(select(Workspace).where(Workspace.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' already exists")

    ws = Workspace(name=body.name, slug=body.slug, status="setup")
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return _to_response(ws)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _to_response(ws)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await db.delete(ws)
    await db.commit()
