import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  BarChart3,
  ScrollText,
  Code2,
  CheckCircle2,
  XCircle,
  Settings,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { platform } from '../api/client';
import type { Workspace, PlatformHealth } from '../api/types';

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.allSettled([
      platform.getWorkspace(workspaceId).then(setWorkspace),
      platform.health().then(setHealth),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading || !workspace) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        Loading...
      </div>
    );
  }

  const serviceHealth = (name: string) =>
    health?.services.find((s) => s.service === name);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm mb-4 cursor-pointer border-0 bg-transparent"
        style={{ color: 'var(--cc-text-muted)' }}
      >
        <ArrowLeft size={14} /> All Workspaces
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cc-text)' }}>
            {workspace.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            Status: <span style={{
              color: workspace.status === 'ready' ? 'var(--cc-success)' : workspace.status === 'error' ? 'var(--cc-error)' : 'var(--cc-warning)',
            }}>
              {workspace.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/setup/${workspaceId}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer border"
            style={{ background: 'transparent', borderColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}
          >
            <Settings size={14} /> Configure
          </button>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}/chat`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0"
            style={{ background: 'var(--cc-accent)', color: '#fff' }}
          >
            <MessageSquare size={16} /> Start Debugging
          </button>
        </div>
      </div>

      {workspace.status === 'error' && workspace.error_message && (
        <div
          className="mb-6 px-4 py-3 rounded-lg flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--cc-error)' }}
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Provisioning had errors</div>
            <div className="text-xs mt-1 opacity-90">{workspace.error_message}</div>
            <p className="text-xs mt-2 opacity-80">
              You can still use the workspace for services that succeeded. Fix the failing service and click Re-provision below, or edit configuration and try again.
            </p>
          </div>
        </div>
      )}

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* AI Agent */}
        <ServiceCard
          icon={<Bot size={20} />}
          title="AI Agent"
          subtitle={workspace.llm_provider === 'anthropic' ? 'Anthropic Claude' : 'AWS Bedrock'}
          configured={workspace.has_llm_key}
          healthy={serviceHealth('FixAI')?.healthy}
          latency={serviceHealth('FixAI')?.latency_ms}
          details={[
            { label: 'Provider', value: workspace.llm_provider || 'Not set' },
            { label: 'Model', value: workspace.llm_model_id || 'Default' },
            { label: 'API Key', value: workspace.has_llm_key ? '••••••••' : 'Not configured' },
          ]}
        />

        {/* Metrics */}
        <ServiceCard
          icon={<BarChart3 size={20} />}
          title="Metrics Explorer"
          subtitle={workspace.metrics_provider ? workspace.metrics_provider.charAt(0).toUpperCase() + workspace.metrics_provider.slice(1) : 'Not configured'}
          configured={workspace.has_metrics_credentials}
          healthy={serviceHealth('Metrics Explorer')?.healthy}
          latency={serviceHealth('Metrics Explorer')?.latency_ms}
          details={[
            { label: 'Provider', value: workspace.metrics_provider || 'None' },
            { label: 'Endpoint', value: workspace.metrics_endpoint_url || 'Default' },
            { label: 'Credentials', value: workspace.has_metrics_credentials ? '••••••••' : 'Not set' },
          ]}
        />

        {/* Logs */}
        <ServiceCard
          icon={<ScrollText size={20} />}
          title="Logs Explorer"
          subtitle={workspace.logs_provider || 'Not configured'}
          configured={workspace.has_logs_credentials}
          healthy={serviceHealth('Logs Explorer')?.healthy}
          latency={serviceHealth('Logs Explorer')?.latency_ms}
          details={[
            { label: 'Provider', value: workspace.logs_provider || 'None' },
            { label: 'Host', value: workspace.logs_host_url || 'Not set' },
            { label: 'Credentials', value: workspace.has_logs_credentials ? '••••••••' : 'Not set' },
          ]}
        />

        {/* Code */}
        <ServiceCard
          icon={<Code2 size={20} />}
          title="Code Parser"
          subtitle={workspace.code_repo_name || 'Not configured'}
          configured={!!workspace.code_repo_path}
          healthy={serviceHealth('Code Parser')?.healthy}
          latency={serviceHealth('Code Parser')?.latency_ms}
          details={[
            { label: 'Repository', value: workspace.code_repo_name || 'None' },
            { label: 'Path', value: workspace.code_repo_path || 'Not set' },
            { label: 'Repo ID', value: workspace.service_ids.code_parser_repo_id || 'Pending' },
          ]}
        />
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--cc-text)' }}>
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          icon={<MessageSquare size={18} />}
          label="New Debug Session"
          description="Start an AI-powered debugging conversation"
          onClick={() => navigate(`/workspace/${workspaceId}/chat`)}
          primary
        />
        <QuickAction
          icon={<RefreshCw size={18} />}
          label="Re-provision"
          description="Re-run provisioning for all services"
          onClick={async () => {
            if (workspaceId) {
              try {
                const ws = await platform.provision(workspaceId);
                setWorkspace(ws);
              } catch (e: any) {
                alert(e.message);
              }
            }
          }}
        />
        <QuickAction
          icon={<Settings size={18} />}
          label="Edit Configuration"
          description="Update credentials and provider settings"
          onClick={() => navigate(`/setup/${workspaceId}`)}
        />
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function ServiceCard({
  icon,
  title,
  subtitle,
  configured,
  healthy,
  latency,
  details,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  configured: boolean;
  healthy?: boolean;
  latency?: number | null;
  details: { label: string; value: string }[];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--cc-accent-glow)', color: 'var(--cc-accent)' }}
          >
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--cc-text)' }}>
              {title}
            </div>
            <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              {subtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {healthy !== undefined && (
            <div className="flex items-center gap-1">
              {healthy ? (
                <CheckCircle2 size={14} style={{ color: 'var(--cc-success)' }} />
              ) : (
                <XCircle size={14} style={{ color: 'var(--cc-error)' }} />
              )}
              {latency != null && (
                <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                  {latency}ms
                </span>
              )}
            </div>
          )}
          {configured ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--cc-success)' }}
            >
              Connected
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--cc-surface-3)', color: 'var(--cc-text-muted)' }}
            >
              Not configured
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {details.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--cc-text-muted)' }}>{d.label}</span>
            <span className="font-mono truncate max-w-[200px]" style={{ color: 'var(--cc-text-secondary)' }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        background: primary ? 'var(--cc-accent-glow)' : 'var(--cc-surface)',
        borderColor: primary ? 'var(--cc-accent)' : 'var(--cc-border)',
      }}
    >
      <div style={{ color: primary ? 'var(--cc-accent)' : 'var(--cc-text-secondary)' }}>{icon}</div>
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>
          {label}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>
          {description}
        </div>
      </div>
    </button>
  );
}
