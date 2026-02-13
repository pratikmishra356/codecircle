/* ── API Type Definitions ─────────────────────────────────────────── */

export interface ServiceIds {
  fixai_org_id: string | null;
  metrics_org_id: string | null;
  logs_org_id: string | null;
  code_parser_org_id: string | null;
  code_parser_repo_id: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: string;
  service_ids: ServiceIds;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  service_ids: ServiceIds;
  created_at: string;
}

export interface HealthStatus {
  service: string;
  url: string;
  healthy: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface PlatformHealth {
  platform: string;
  services: HealthStatus[];
}

export interface ServiceOrg {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
}

/* ── AI Config ───────────────────────────────────────────────────── */

export interface AIConfig {
  provider: string;        // "claude" | "bedrock"
  api_key_set: boolean;
  api_key_preview: string | null;
  base_url: string | null;
  model_id: string | null;
  max_tokens: number;
  updated_at: string | null;
}

export interface AIConfigUpdate {
  provider: string;
  api_key?: string | null;
  base_url?: string | null;
  model_id?: string | null;
  max_tokens?: number;
}

/* ── Service Info ────────────────────────────────────────────────── */

export interface ServiceInfo {
  key: string;
  name: string;
  description: string;
  backendPort: number;
  frontendPort: number;
  serviceIdField: keyof ServiceIds;
  icon: string;
  color: string;
}

export const SERVICES: ServiceInfo[] = [
  {
    key: 'fixai',
    name: 'FixAI',
    description: 'AI-powered debugging agent with chat interface',
    backendPort: 8100,
    frontendPort: 3006,
    serviceIdField: 'fixai_org_id',
    icon: 'Bot',
    color: '#8b5cf6',
  },
  {
    key: 'metrics',
    name: 'Metrics Explorer',
    description: 'Query dashboards, monitors, and metrics from Datadog, Prometheus, or Grafana',
    backendPort: 8001,
    frontendPort: 3002,
    serviceIdField: 'metrics_org_id',
    icon: 'BarChart3',
    color: '#06b6d4',
  },
  {
    key: 'logs',
    name: 'Logs Explorer',
    description: 'Search and analyze production logs from Splunk Cloud',
    backendPort: 8003,
    frontendPort: 3003,
    serviceIdField: 'logs_org_id',
    icon: 'ScrollText',
    color: '#f59e0b',
  },
  {
    key: 'code_parser',
    name: 'Code Parser',
    description: 'Parse repositories, explore symbols, call graphs, and entry points',
    backendPort: 8000,
    frontendPort: 3000,
    serviceIdField: 'code_parser_org_id',
    icon: 'Code2',
    color: '#10b981',
  },
];
