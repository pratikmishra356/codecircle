/* ── API Client ───────────────────────────────────────────────────── */

import type { AIConfig, AIConfigUpdate, PlatformHealth, ServiceOrg, Workspace, WorkspaceListItem } from './types';

const PLATFORM = '/api/platform';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/* ── Platform API ────────────────────────────────────────────────── */

export const platform = {
  // Health
  health: () => request<PlatformHealth>('/health'),

  // Workspaces
  listWorkspaces: () => request<WorkspaceListItem[]>(`${PLATFORM}/workspaces`),

  createWorkspace: (name: string, slug: string) =>
    request<Workspace>(`${PLATFORM}/workspaces`, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    }),

  getWorkspace: (id: string) => request<Workspace>(`${PLATFORM}/workspaces/${id}`),

  deleteWorkspace: (id: string) =>
    request<void>(`${PLATFORM}/workspaces/${id}`, { method: 'DELETE' }),

  // Connect / disconnect service orgs
  connectService: (workspaceId: string, service: string, orgId: string, repoId?: string) =>
    request<Workspace>(`${PLATFORM}/workspaces/${workspaceId}/connect`, {
      method: 'POST',
      body: JSON.stringify({ service, org_id: orgId, repo_id: repoId }),
    }),

  disconnectService: (workspaceId: string, service: string) =>
    request<Workspace>(`${PLATFORM}/workspaces/${workspaceId}/disconnect/${service}`, {
      method: 'DELETE',
    }),

  // List orgs from each service (proxied through platform)
  listServiceOrgs: (service: string) =>
    request<ServiceOrg[]>(`${PLATFORM}/services/${service}/orgs`),

  // Create FixAI org from workspace
  createFixAIOrg: (workspaceId: string, name: string, slug: string) =>
    request<Workspace>(`${PLATFORM}/workspaces/${workspaceId}/create-fixai-org`, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    }),

  // AI Configuration (global default)
  getAIConfig: (workspaceId?: string) =>
    workspaceId
      ? request<AIConfig>(`${PLATFORM}/workspaces/${workspaceId}/ai-config`)
      : request<AIConfig>(`${PLATFORM}/ai-config`),

  saveAIConfig: (config: AIConfigUpdate, workspaceId?: string) =>
    workspaceId
      ? request<AIConfig>(`${PLATFORM}/workspaces/${workspaceId}/ai-config`, {
          method: 'PUT',
          body: JSON.stringify(config),
        })
      : request<AIConfig>(`${PLATFORM}/ai-config`, {
          method: 'PUT',
          body: JSON.stringify(config),
        }),
};
