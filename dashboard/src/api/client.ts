/* ── API Client ───────────────────────────────────────────────────── */

import type {
  AIConfig,
  CodeConfig,
  Conversation,
  ConversationDetail,
  LogsConfig,
  MetricsConfig,
  PlatformHealth,
  Workspace,
  WorkspaceListItem,
} from './types';

const PLATFORM = '/api/platform';
const FIXAI = '/api/v1';

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

  // Setup steps
  saveAI: (id: string, config: AIConfig) =>
    request<Workspace>(`${PLATFORM}/setup/${id}/ai`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  saveMetrics: (id: string, config: MetricsConfig) =>
    request<Workspace>(`${PLATFORM}/setup/${id}/metrics`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  saveLogs: (id: string, config: LogsConfig) =>
    request<Workspace>(`${PLATFORM}/setup/${id}/logs`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  saveCode: (id: string, config: CodeConfig) =>
    request<Workspace>(`${PLATFORM}/setup/${id}/code`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  provision: (id: string) =>
    request<Workspace>(`${PLATFORM}/setup/${id}/provision`, { method: 'POST' }),
};

/* ── FixAI API ───────────────────────────────────────────────────── */

export const fixai = {
  createConversation: (orgId: string) =>
    request<Conversation>(`${FIXAI}/organizations/${orgId}/conversations`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  listConversations: (orgId: string) =>
    request<Conversation[]>(`${FIXAI}/organizations/${orgId}/conversations`),

  getConversation: (convId: string) =>
    request<ConversationDetail>(`${FIXAI}/conversations/${convId}`),

  deleteConversation: (convId: string) =>
    request<void>(`${FIXAI}/conversations/${convId}`, { method: 'DELETE' }),

  // SSE streaming — returns raw Response for manual reading
  sendMessage: async (convId: string, content: string): Promise<Response> => {
    const res = await fetch(`${FIXAI}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text}`);
    }
    return res;
  },
};
