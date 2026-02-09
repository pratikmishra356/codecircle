import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { platform } from '../api/client';
import type { WorkspaceListItem, PlatformHealth } from '../api/types';

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  ready: CheckCircle2,
  error: AlertCircle,
  setup: Clock,
  provisioning: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  ready: 'var(--cc-success)',
  error: 'var(--cc-error)',
  setup: 'var(--cc-warning)',
  provisioning: 'var(--cc-warning)',
};

export default function Landing() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ws, h] = await Promise.allSettled([platform.listWorkspaces(), platform.health()]);
      if (ws.status === 'fulfilled') setWorkspaces(ws.value);
      if (h.status === 'fulfilled') setHealth(h.value);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const ws = await platform.createWorkspace(newName.trim(), slug);
      navigate(`/setup/${ws.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Delete this workspace?')) return;
    try {
      await platform.deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  }

  const providerBadge = (label: string, value: string | null) =>
    value ? (
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'var(--cc-surface-3)', color: 'var(--cc-text-secondary)' }}
      >
        {label}: {value}
      </span>
    ) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--cc-text)' }}>
          CodeCircle
        </h1>
        <p className="text-base" style={{ color: 'var(--cc-text-secondary)' }}>
          AI-powered production debugging. Set up a workspace to connect your metrics, logs, and code.
        </p>
      </div>

      {/* Service Health Bar */}
      {health && (
        <div
          className="flex items-center gap-4 px-4 py-3 rounded-lg mb-8 border"
          style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
        >
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>
            Services
          </span>
          {health.services.map((s) => (
            <div key={s.service} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: s.healthy ? 'var(--cc-success)' : 'var(--cc-error)' }}
              />
              <span className="text-xs" style={{ color: 'var(--cc-text-secondary)' }}>
                {s.service}
                {s.latency_ms != null && (
                  <span style={{ color: 'var(--cc-text-muted)' }}> {s.latency_ms}ms</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Workspaces */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--cc-text)' }}>
          Workspaces
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer border-0 transition-colors"
          style={{ background: 'var(--cc-accent)', color: '#fff' }}
        >
          <Plus size={16} /> New Workspace
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="border rounded-lg p-5 mb-6"
          style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
        >
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--cc-text-secondary)' }}>
            Workspace Name
          </label>
          <div className="flex gap-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. My Team Production"
              className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                background: 'var(--cc-surface-2)',
                borderColor: 'var(--cc-border)',
                color: 'var(--cc-text)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0 disabled:opacity-50"
              style={{ background: 'var(--cc-accent)', color: '#fff' }}
            >
              {creating ? 'Creating...' : 'Create & Setup'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="px-3 py-2 rounded-lg text-sm cursor-pointer border"
              style={{ background: 'transparent', borderColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workspace cards */}
      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--cc-text-muted)' }}>Loading...</div>
      ) : workspaces.length === 0 && !showCreate ? (
        <div
          className="text-center py-20 rounded-lg border border-dashed"
          style={{ borderColor: 'var(--cc-border)', color: 'var(--cc-text-muted)' }}
        >
          <p className="text-lg mb-2">No workspaces yet</p>
          <p className="text-sm mb-4">Create your first workspace to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0"
            style={{ background: 'var(--cc-accent)', color: '#fff' }}
          >
            <Plus size={16} className="inline mr-1 -mt-0.5" /> Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((ws) => {
            const StatusIcon = STATUS_ICON[ws.status] || Clock;
            return (
              <div
                key={ws.id}
                onClick={() => ws.status === 'setup' ? navigate(`/setup/${ws.id}`) : navigate(`/workspace/${ws.id}`)}
                className="flex items-center justify-between p-5 rounded-lg border cursor-pointer transition-all hover:scale-[1.005]"
                style={{
                  background: 'var(--cc-surface)',
                  borderColor: 'var(--cc-border)',
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--cc-text)' }}>
                      {ws.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <StatusIcon size={14} style={{ color: STATUS_COLOR[ws.status] }} />
                      <span className="text-xs capitalize" style={{ color: STATUS_COLOR[ws.status] }}>
                        {ws.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {providerBadge('AI', ws.llm_provider)}
                    {providerBadge('Metrics', ws.metrics_provider)}
                    {providerBadge('Logs', ws.logs_provider)}
                    {providerBadge('Code', ws.code_repo_name)}
                  </div>
                  {ws.status === 'error' && ws.error_message && (
                    <div
                      className="mt-3 text-xs px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--cc-error)' }}
                    >
                      {ws.error_message}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => handleDelete(e, ws.id)}
                    className="p-2 rounded-md cursor-pointer border-0 transition-colors"
                    style={{ background: 'transparent', color: 'var(--cc-text-muted)' }}
                    title="Delete workspace"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ArrowRight size={18} style={{ color: 'var(--cc-text-muted)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
