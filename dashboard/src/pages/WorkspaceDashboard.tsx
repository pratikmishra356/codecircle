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
} from 'lucide-react';
import { platform } from '../api/client';
import type { Workspace, PlatformHealth, ServiceOrg, ServiceInfo } from '../api/types';
import { SERVICES } from '../api/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  Bot: <Bot size={20} />,
  BarChart3: <BarChart3 size={20} />,
  ScrollText: <ScrollText size={20} />,
  Code2: <Code2 size={20} />,
};

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

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--cc-text)' }}>
          {workspace.name}
        </h1>
        {workspace.service_ids.fixai_org_id && (
          <button
            onClick={() => navigate(`/workspace/${workspaceId}/debug`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0"
            style={{ background: 'var(--cc-accent)', color: '#fff' }}
          >
            <MessageSquare size={16} /> Start Debugging
          </button>
        )}
      </div>

      <p className="text-sm mb-8" style={{ color: 'var(--cc-text-muted)' }}>
        {connectedCount}/4 services connected. Open each service below to create organizations,
        then connect them to this workspace.
      </p>

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

  // Check if other services are connected (needed to enable FixAI org creation)
  const otherServicesConnected = [
    workspace.service_ids.code_parser_org_id,
    workspace.service_ids.metrics_org_id,
    workspace.service_ids.logs_org_id,
  ].filter(Boolean).length;

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
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
    >
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
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--cc-success)' }}
            >
              Connected
            </span>
          ) : (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'var(--cc-surface-3)', color: 'var(--cc-text-muted)' }}
            >
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div
        className="flex items-center gap-2 px-5 py-3 border-t"
        style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface-2)' }}
      >
        {/* Open UI button */}
        <button
          onClick={onOpenUI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border"
          style={{ background: 'transparent', borderColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}
        >
          <ExternalLink size={12} /> Open {svc.name} UI
        </button>

        {/* Connect / Disconnect */}
        {linkedOrgId ? (
          <>
            <span className="text-xs font-mono px-2 truncate max-w-[200px]" style={{ color: 'var(--cc-text-muted)' }}>
              Org: {linkedOrgId.slice(0, 8)}...
            </span>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs cursor-pointer border-0"
              style={{ background: 'transparent', color: 'var(--cc-error)' }}
              title="Disconnect this organization"
            >
              <Unlink size={12} /> Disconnect
            </button>
          </>
        ) : (
          <>
            {/* For FixAI: show Create button (primary action) */}
            {isFixAI && (
              <button
                onClick={() => { setShowCreateForm(!showCreateForm); setShowPicker(false); }}
                disabled={otherServicesConnected === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border"
                style={{
                  background: showCreateForm ? 'var(--cc-accent)' : 'transparent',
                  borderColor: showCreateForm ? 'var(--cc-accent)' : svc.color,
                  color: showCreateForm ? '#fff' : svc.color,
                  opacity: otherServicesConnected === 0 ? 0.5 : 1,
                  cursor: otherServicesConnected === 0 ? 'not-allowed' : 'pointer',
                }}
                title={otherServicesConnected === 0 ? 'Connect at least one other service first' : 'Create a new FixAI org with service details pre-filled'}
              >
                <Plus size={12} /> Create FixAI Org
              </button>
            )}

            {/* Connect existing org button */}
            <button
              onClick={togglePicker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border"
              style={{
                background: showPicker ? 'var(--cc-accent-glow)' : 'transparent',
                borderColor: showPicker ? 'var(--cc-accent)' : 'var(--cc-border)',
                color: showPicker ? 'var(--cc-accent)' : 'var(--cc-text-secondary)',
              }}
            >
              <Link2 size={12} /> Connect Existing <ChevronDown size={12} />
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
