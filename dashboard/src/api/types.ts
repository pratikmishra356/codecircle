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
  status: 'setup' | 'provisioning' | 'ready' | 'error';

  llm_provider: string | null;
  llm_model_id: string | null;
  has_llm_key: boolean;

  metrics_provider: string | null;
  metrics_endpoint_url: string | null;
  has_metrics_credentials: boolean;

  logs_provider: string | null;
  logs_host_url: string | null;
  has_logs_credentials: boolean;

  code_repo_path: string | null;
  code_repo_name: string | null;

  service_ids: ServiceIds;

  error_message: string | null;

  created_at: string;
  updated_at: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  llm_provider: string | null;
  metrics_provider: string | null;
  logs_provider: string | null;
  code_repo_name: string | null;
  error_message: string | null;
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

export interface AIConfig {
  llm_provider: 'anthropic' | 'bedrock';
  llm_api_key?: string;
  llm_bedrock_url?: string;
  llm_model_id?: string;
}

export interface MetricsConfig {
  provider: 'datadog' | 'prometheus' | 'grafana';
  api_key?: string;
  app_key?: string;
  site?: string;
  endpoint_url?: string;
  bearer_token?: string;
  username?: string;
  password?: string;
}

export interface LogsConfig {
  provider: 'splunk_cloud';
  host_url: string;
  cookie?: string;
  csrf_token?: string;
}

export interface CodeConfig {
  repo_path: string;
  repo_name?: string;
}

export interface SetupWizardRequest {
  name: string;
  slug: string;
  ai?: AIConfig;
  metrics?: MetricsConfig;
  logs?: LogsConfig;
  code?: CodeConfig;
}

/* ── Chat Types (FixAI) ──────────────────────────────────────────── */

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  organization_id: string;
  messages: Message[];
  created_at: string;
}
