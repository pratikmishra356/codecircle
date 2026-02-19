import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  BarChart3,
  ScrollText,
  Code2,
  ExternalLink,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  ChevronDown,
  MessageSquare,
  Loader2,
  Plus,
  Key,
  ChevronRight,
  Sparkles,
  ListOrdered,
} from 'lucide-react';
import { platform } from '../api/client';
import type { Workspace, PlatformHealth, ServiceOrg, ServiceInfo, AIConfig, AIConfigUpdate } from '../api/types';
import { SERVICES } from '../api/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  Bot: <Bot size={20} />,
  BarChart3: <BarChart3 size={20} />,
  ScrollText: <ScrollText size={20} />,
  Code2: <Code2 size={20} />,
};

/* ── Workspace-scoped AI settings card ─────────────────────────────── */
function WorkspaceAICard({ workspaceId, className = '', onSaved }: { workspaceId: string; className?: string; onSaved?: () => void }) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'claude' | 'bedrock'>('bedrock');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [maxTokens, setMaxTokens] = useState(4096);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      setLoading(true);
      try {
        const cfg = await platform.getAIConfig(workspaceId);
        setConfig(cfg);
        setProvider(cfg.provider as 'claude' | 'bedrock');
        setBaseUrl(cfg.base_url || '');
        setModelId(cfg.model_id || '');
        setMaxTokens(cfg.max_tokens);
      } catch {
        setConfig(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const update: AIConfigUpdate = {
        provider,
        base_url: baseUrl || null,
        model_id: modelId || null,
        max_tokens: maxTokens,
      };
      if (apiKey.trim()) update.api_key = apiKey.trim();
      const cfg = await platform.saveAIConfig(update, workspaceId);
      setConfig(cfg);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`cc-card overflow-hidden ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 cursor-pointer border-0 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'transparent', color: 'var(--cc-text)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-accent-soft)' }}>
            <Key size={20} style={{ color: 'var(--cc-accent)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm">AI settings for this workspace</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>
              {loading ? 'Loading...' : config?.api_key_set ? `Key set · ${config.model_id || 'Default model'}` : 'Configure API key, model, and Bedrock URL'}
            </div>
          </div>
        </div>
        <ChevronDown size={18} style={{ color: 'var(--cc-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <div className="grid gap-4 pt-4">
            <div className="flex gap-3">
              {(['bedrock', 'claude'] as const).map((p) => (
                <button key={p} onClick={() => setProvider(p)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer border" style={{ background: provider === p ? 'var(--cc-accent-glow)' : 'var(--cc-surface-2)', borderColor: provider === p ? 'var(--cc-accent)' : 'var(--cc-border)', color: provider === p ? 'var(--cc-accent)' : 'var(--cc-text-secondary)' }}>
                  {p === 'bedrock' ? 'Bedrock Proxy' : 'Claude API'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--cc-text-secondary)' }}>API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={config?.api_key_set ? 'New key (leave blank to keep)' : 'API key or token'} className="w-full px-3 py-2 rounded-lg text-sm border font-mono outline-none" style={{ background: 'var(--cc-surface-2)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--cc-text-secondary)' }}>Base URL</label>
              <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://llm-proxy.example.com" className="w-full px-3 py-2 rounded-lg text-sm border font-mono outline-none" style={{ background: 'var(--cc-surface-2)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--cc-text-secondary)' }}>Model ID</label>
              <input type="text" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="us.anthropic.claude-sonnet-4-20250514-v1:0" className="w-full px-3 py-2 rounded-lg text-sm border font-mono outline-none" style={{ background: 'var(--cc-surface-2)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }} />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving} className="cc-action flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer border-0 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? 'Saving...' : 'Save'}
              </button>
              {saved && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--cc-success)' }}><CheckCircle2 size={14} /> Saved</span>}
              {error && <span className="text-xs" style={{ color: 'var(--cc-error)' }}>{error}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Setup instructions (step-by-step) ────────────────────────────── */
const SETUP_STEPS = [
  {
    id: 'workspace',
    title: 'Create workspace',
    description: 'You’re here—this workspace is ready.',
    done: true,
  },
  {
    id: 'connect',
    title: 'Connect organizations',
    description: 'In each service below: open its UI, create an org (or use an existing one), then connect it to this workspace. Do this for Code Parser, Metrics Explorer, Logs Explorer, and FixAI.',
    getDone: (ws: Workspace) =>
      [ws.service_ids.code_parser_org_id, ws.service_ids.metrics_org_id, ws.service_ids.logs_org_id, ws.service_ids.fixai_org_id].filter(Boolean).length === 4,
    getLabel: (ws: Workspace) => {
      const n = [ws.service_ids.code_parser_org_id, ws.service_ids.metrics_org_id, ws.service_ids.logs_org_id, ws.service_ids.fixai_org_id].filter(Boolean).length;
      return `${n}/4 services connected`;
    },
  },
  {
    id: 'ai',
    title: 'Configure AI settings',
    description: 'Set your API key, Bedrock URL, and model in “AI settings for this workspace” below. Saving here pushes the config to all connected orgs (FixAI and Code Parser).',
    getDone: (_: Workspace, aiKeySet?: boolean) => aiKeySet === true,
  },
  {
    id: 'service-setup',
    title: 'Complete org setup in each service',
    description: 'Open each service’s UI and finish any org-specific setup: e.g. add repos in Code Parser, configure data sources in Metrics/Logs, and ensure FixAI has the context it needs.',
    getDone: () => false,
  },
];

function SetupSteps({
  workspace,
  aiConfigLoaded,
  aiKeySet,
  onRefresh,
}: {
  workspace: Workspace;
  aiConfigLoaded: boolean;
  aiKeySet: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false); // Collapsible; default collapsed
  const step2Done = SETUP_STEPS[1].getDone!(workspace);
  const step2Label = SETUP_STEPS[1].getLabel!(workspace);
  const step3Done = aiConfigLoaded && (SETUP_STEPS[2].getDone!(workspace, aiKeySet) ?? false);

  return (
    <div className="cc-card overflow-hidden mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 cursor-pointer border-0 text-left hover:opacity-90 transition-opacity"
        style={{ background: 'transparent', color: 'var(--cc-text)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-accent-soft)' }}>
            <ListOrdered size={20} style={{ color: 'var(--cc-accent)' }} />
          </div>
          <div>
            <div className="font-semibold text-sm">Setup instructions</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>
              Follow these steps to get this workspace ready for debugging
            </div>
          </div>
        </div>
        <ChevronDown size={18} style={{ color: 'var(--cc-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <ol className="space-y-5 pt-5">
            {SETUP_STEPS.map((step, index) => {
              const done = step.id === 'workspace' ? true : step.id === 'connect' ? step2Done : step.id === 'ai' ? step3Done : (step.getDone?.(workspace, aiKeySet) ?? false);
              const label = step.id === 'connect' ? step2Label : null;
              return (
                <li key={step.id} className="flex gap-4">
                  <div className="shrink-0 flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: done ? 'var(--cc-success-soft)' : 'var(--cc-surface-2)',
                        color: done ? 'var(--cc-success)' : 'var(--cc-text-muted)',
                        border: '2px solid ' + (done ? 'var(--cc-success)' : 'var(--cc-border)'),
                      }}
                    >
                      {done ? <CheckCircle2 size={16} /> : index + 1}
                    </div>
                  </div>
                  <div className="pb-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--cc-text)' }}>
                        {step.title}
                      </span>
                      {label && (
                        <span className="cc-badge cc-badge-success text-xs">{label}</span>
                      )}
                      {done && step.id !== 'workspace' && (
                        <span className="cc-badge cc-badge-success">Done</span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--cc-text-secondary)' }}>
                      {step.description}
                    </p>
                    {step.id === 'connect' && !step2Done && (
                      <button
                        type="button"
                        onClick={onRefresh}
                        className="mt-2 text-xs font-medium cursor-pointer border-0 bg-transparent"
                        style={{ color: 'var(--cc-accent)' }}
                      >
                        Refresh status
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [aiConfigFetched, setAiConfigFetched] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.allSettled([
      platform.getWorkspace(workspaceId).then(setWorkspace),
      platform.health().then(setHealth),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    platform.getAIConfig(workspaceId).then((c) => { setAiConfig(c); setAiConfigFetched(true); }).catch(() => { setAiConfig(null); setAiConfigFetched(true); });
  }, [workspaceId]);

  const refreshWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    const ws = await platform.getWorkspace(workspaceId);
    setWorkspace(ws);
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

  const connectedCount = [
    workspace.service_ids.fixai_org_id,
    workspace.service_ids.metrics_org_id,
    workspace.service_ids.logs_org_id,
    workspace.service_ids.code_parser_org_id,
  ].filter(Boolean).length;
  const allConnected = connectedCount === 4;
  const canDebug = Boolean(workspace.service_ids.fixai_org_id);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 pb-20">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm mb-6 cursor-pointer border-0 bg-transparent font-medium hover:opacity-80 transition-opacity"
        style={{ color: 'var(--cc-text-muted)' }}
      >
        <ArrowLeft size={14} /> Workspaces
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--cc-text)' }}>
            {workspace.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            {connectedCount}/4 services connected
          </p>
        </div>
        {canDebug && (
          <button
            onClick={() => navigate(`/workspace/${workspaceId}/debug`)}
            className="cc-btn-primary"
          >
            <MessageSquare size={18} /> Start Debugging <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Setup instructions */}
      {workspaceId && (
        <SetupSteps
          workspace={workspace}
          aiConfigLoaded={aiConfigFetched}
          aiKeySet={aiConfig?.api_key_set ?? false}
          onRefresh={refreshWorkspace}
        />
      )}

      {/* Workspace AI settings card */}
      {workspaceId && (
        <WorkspaceAICard
          workspaceId={workspaceId}
          className="mb-8"
          onSaved={() => platform.getAIConfig(workspaceId).then((c) => { setAiConfig(c); setAiConfigFetched(true); }).catch(() => setAiConfig(null))}
        />
      )}

      {!allConnected && (
        <div
          className="cc-card rounded-xl p-5 mb-8 flex items-center gap-4 flex-wrap"
          style={{ borderColor: 'var(--cc-accent-muted)', background: 'var(--cc-accent-soft)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-accent-muted)' }}>
              <Sparkles size={20} style={{ color: 'var(--cc-accent)' }} />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--cc-text)' }}>
                Complete setup to unlock debugging
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-secondary)' }}>
                Connect all 4 services below: open each UI, create an org, then link it here.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {SERVICES.map((s) => {
              const connected = Boolean(workspace.service_ids[s.serviceIdField]);
              return (
                <div
                  key={s.key}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: connected ? 'var(--cc-success-soft)' : 'var(--cc-surface-2)',
                    color: connected ? 'var(--cc-success)' : 'var(--cc-text-muted)',
                  }}
                  title={`${s.name}: ${connected ? 'Connected' : 'Not connected'}`}
                >
                  {connected ? <CheckCircle2 size={14} /> : <span className="text-xs">—</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Cards */}
      <div className="space-y-4 mb-10">
        {SERVICES.map((svc) => (
          <ServiceSection
            key={svc.key}
            svc={svc}
            workspace={workspace}
            health={serviceHealth(svc.name)}
            workspaceId={workspaceId!}
            onUpdate={refreshWorkspace}
            onOpenUI={() => navigate(`/workspace/${workspaceId}/service/${svc.key}`)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Service Section Card ────────────────────────────────────────── */

function ServiceSection({
  svc,
  workspace,
  health,
  workspaceId,
  onUpdate,
  onOpenUI,
}: {
  svc: ServiceInfo;
  workspace: Workspace;
  health?: { healthy: boolean; latency_ms: number | null };
  workspaceId: string;
  onUpdate: () => Promise<void>;
  onOpenUI: () => void;
}) {
  const linkedOrgId = workspace.service_ids[svc.serviceIdField];
  const [orgs, setOrgs] = useState<ServiceOrg[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // FixAI create-org form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const isFixAI = svc.key === 'fixai';

  const otherServicesConnected = [
    workspace.service_ids.code_parser_org_id,
    workspace.service_ids.metrics_org_id,
    workspace.service_ids.logs_org_id,
  ].filter(Boolean).length;
  const canCreateFixAI = otherServicesConnected === 3;

  async function loadOrgs() {
    setLoadingOrgs(true);
    try {
      const data = await platform.listServiceOrgs(svc.key);
      setOrgs(data);
    } catch {
      setOrgs([]);
    } finally {
      setLoadingOrgs(false);
    }
  }

  function togglePicker() {
    if (!showPicker) {
      loadOrgs();
    }
    setShowPicker(!showPicker);
    setShowCreateForm(false);
  }

  async function handleConnect(orgId: string) {
    setConnecting(true);
    try {
      await platform.connectService(workspaceId, svc.key, orgId);
      await onUpdate();
      setShowPicker(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await platform.disconnectService(workspaceId, svc.key);
      await onUpdate();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleCreateFixAIOrg() {
    if (!createName.trim() || !createSlug.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await platform.createFixAIOrg(workspaceId, createName.trim(), createSlug.trim());
      await onUpdate();
      setShowCreateForm(false);
      setCreateName('');
      setCreateSlug('');
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create FixAI org');
    } finally {
      setCreating(false);
    }
  }

  function autoSlug(name: string) {
    setCreateName(name);
    setCreateSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    );
  }

  return (
    <div className="cc-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${svc.color}15`, color: svc.color }}
          >
            {ICON_MAP[svc.icon]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--cc-text)' }}>
                {svc.name}
              </span>
              {health && (
                health.healthy ? (
                  <CheckCircle2 size={14} style={{ color: 'var(--cc-success)' }} />
                ) : (
                  <XCircle size={14} style={{ color: 'var(--cc-error)' }} />
                )
              )}
              {health?.latency_ms != null && (
                <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                  {health.latency_ms}ms
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              {svc.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {linkedOrgId ? (
            <span className="cc-badge cc-badge-success">Connected</span>
          ) : (
            <span className="cc-badge cc-badge-muted">Not connected</span>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div
        className="flex items-center gap-2 px-5 py-3 border-t"
        style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface-2)' }}
      >
        <button onClick={onOpenUI} className="cc-btn-primary text-xs py-2 px-3">
          <ExternalLink size={12} /> Open {svc.name}
        </button>

        {/* Connect / Disconnect */}
        {linkedOrgId ? (
          <>
            <span className="text-xs font-mono px-2 truncate max-w-[200px]" style={{ color: 'var(--cc-text-muted)' }}>
              Org: {linkedOrgId.slice(0, 8)}...
            </span>
            <button onClick={handleDisconnect} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer border-0" style={{ background: 'transparent', color: 'var(--cc-error)' }} title="Disconnect">
              <Unlink size={12} /> Disconnect
            </button>
          </>
        ) : (
          <>
            {isFixAI && (
              <div className="relative group inline-block">
                <button
                  onClick={() => { if (canCreateFixAI) { setShowCreateForm(!showCreateForm); setShowPicker(false); } }}
                  disabled={!canCreateFixAI}
                  className={showCreateForm ? 'cc-btn-primary text-xs py-2 px-3' : 'cc-btn-secondary text-xs py-2 px-3'}
                >
                  <Plus size={12} /> Create FixAI Org
                </button>
                {!canCreateFixAI && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30"
                    style={{ background: 'var(--cc-text)', color: 'var(--cc-surface)' }}>
                    Connect Code Parser, Metrics, and Logs first ({otherServicesConnected}/3)
                  </div>
                )}
              </div>
            )}
            <button onClick={togglePicker} className="cc-btn-secondary text-xs py-2 px-3">
              <Link2 size={12} /> Connect existing <ChevronDown size={12} />
            </button>
          </>
        )}
      </div>

      {/* FixAI create-org form */}
      {isFixAI && showCreateForm && !linkedOrgId && (
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--cc-text-secondary)' }}>
            Create a new FixAI organization (service URLs and org IDs will be populated from connected services)
          </div>

          {/* Connected services summary */}
          <div
            className="rounded-md px-3 py-2 mb-3 text-xs"
            style={{ background: 'var(--cc-surface-2)', color: 'var(--cc-text-muted)' }}
          >
            <div className="font-medium mb-1" style={{ color: 'var(--cc-text-secondary)' }}>
              Will include:
            </div>
            <div className="space-y-0.5">
              <div>{workspace.service_ids.code_parser_org_id ? '  Code Parser' : '  Code Parser (not connected)'}</div>
              <div>{workspace.service_ids.metrics_org_id ? '  Metrics Explorer' : '  Metrics Explorer (not connected)'}</div>
              <div>{workspace.service_ids.logs_org_id ? '  Logs Explorer' : '  Logs Explorer (not connected)'}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Organization name"
              value={createName}
              onChange={(e) => autoSlug(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md text-xs border"
              style={{
                background: 'var(--cc-surface)',
                borderColor: 'var(--cc-border)',
                color: 'var(--cc-text)',
                outline: 'none',
              }}
            />
            <input
              type="text"
              placeholder="slug"
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              className="w-40 px-3 py-2 rounded-md text-xs border font-mono"
              style={{
                background: 'var(--cc-surface)',
                borderColor: 'var(--cc-border)',
                color: 'var(--cc-text)',
                outline: 'none',
              }}
            />
          </div>

          {createError && (
            <div className="text-xs mb-2" style={{ color: 'var(--cc-error)' }}>
              {createError}
            </div>
          )}

          <button
            onClick={handleCreateFixAIOrg}
            disabled={creating || !createName.trim() || !createSlug.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold cursor-pointer border-0"
            style={{
              background: 'var(--cc-accent)',
              color: '#fff',
              opacity: creating || !createName.trim() || !createSlug.trim() ? 0.5 : 1,
            }}
          >
            {creating ? (
              <><Loader2 size={12} className="animate-spin" /> Creating...</>
            ) : (
              <><Plus size={12} /> Create & Connect</>
            )}
          </button>
        </div>
      )}

      {/* Org picker dropdown */}
      {showPicker && (
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
          {loadingOrgs ? (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--cc-text-muted)' }}>
              <Loader2 size={14} className="animate-spin" /> Loading organizations...
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-xs py-2" style={{ color: 'var(--cc-text-muted)' }}>
              No organizations found. {isFixAI ? 'Use "Create FixAI Org" above to create one.' : `Open the ${svc.name} UI to create one first.`}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--cc-text-secondary)' }}>
                Select an organization to connect:
              </div>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleConnect(org.id)}
                  disabled={connecting}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm cursor-pointer border transition-colors hover:scale-[1.002]"
                  style={{
                    background: 'var(--cc-surface)',
                    borderColor: 'var(--cc-border)',
                    color: 'var(--cc-text)',
                  }}
                >
                  <div>
                    <div className="font-medium text-xs">{org.name}</div>
                    {org.slug && (
                      <div className="text-xs font-mono" style={{ color: 'var(--cc-text-muted)' }}>
                        {org.slug}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--cc-text-muted)' }}>
                    {org.id.slice(0, 8)}...
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
