import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowRight, CheckCircle2, Link2, Sparkles } from 'lucide-react';
import { platform } from '../api/client';
import type { WorkspaceListItem, PlatformHealth } from '../api/types';
import { SERVICES } from '../api/types';

export default function WorkspaceList() {
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
      navigate(`/workspace/${ws.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create');
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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  function connectedCount(ws: WorkspaceListItem): number {
    const ids = ws.service_ids;
    return [ids.fixai_org_id, ids.metrics_org_id, ids.logs_org_id, ids.code_parser_org_id].filter(Boolean).length;
  }

  return (
    <div className="min-h-screen cc-landing-bg pb-24">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--cc-text)' }}>
              Workspaces
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
              Each workspace ties together one set of services and apps.
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="cc-btn-primary">
            <Plus size={18} /> New workspace
          </button>
        </div>

        {showCreate && (
          <div className="cc-card p-6 mb-6">
            <label className="cc-label">Workspace name</label>
            <div className="flex flex-wrap gap-3">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production · Payments"
                className="cc-input flex-1 min-w-[200px]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="cc-btn-primary"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); }}
                className="cc-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="cc-card p-12 text-center" style={{ color: 'var(--cc-text-muted)' }}>
            Loading workspaces…
          </div>
        ) : workspaces.length === 0 && !showCreate ? (
          <div
            className="cc-card p-16 text-center border-dashed"
            style={{ borderStyle: 'dashed', color: 'var(--cc-text-muted)' }}
          >
            <Sparkles size={40} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2" style={{ color: 'var(--cc-text-secondary)' }}>
              No workspaces yet
            </p>
            <p className="text-sm mb-6">Create your first workspace to connect services and use FixAI.</p>
            <button onClick={() => setShowCreate(true)} className="cc-btn-primary">
              <Plus size={18} /> Create workspace
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workspaces.map((ws) => {
              const count = connectedCount(ws);
              const ready = count === 4;
              return (
                <div
                  key={ws.id}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="cc-card flex items-center justify-between p-5 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="font-semibold text-base truncate" style={{ color: 'var(--cc-text)' }}>
                        {ws.name}
                      </h3>
                      {ready ? (
                        <span className="cc-badge cc-badge-success">Ready</span>
                      ) : (
                        <span className="cc-badge cc-badge-muted">{count}/4 connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link2 size={12} style={{ color: 'var(--cc-text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                        {SERVICES.map((s) => (ws.service_ids[s.serviceIdField] ? s.name : null)).filter(Boolean).join(' · ') || 'No services connected'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {ready && <CheckCircle2 size={18} style={{ color: 'var(--cc-success)' }} />}
                    <button
                      onClick={(e) => handleDelete(e, ws.id)}
                      className="p-2 rounded-lg border-0 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
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

      {health && (
        <footer
          className="fixed bottom-0 left-0 right-0 py-2 px-4 border-t flex items-center justify-center gap-6 text-xs z-20"
          style={{ background: 'var(--cc-bg-elevated)', borderColor: 'var(--cc-border)', color: 'var(--cc-text-muted)' }}
        >
          {health.services.map((s) => (
            <span key={s.service} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: s.healthy ? 'var(--cc-success)' : 'var(--cc-error)' }}
              />
              {s.service}
              {s.latency_ms != null && <span>· {s.latency_ms}ms</span>}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
