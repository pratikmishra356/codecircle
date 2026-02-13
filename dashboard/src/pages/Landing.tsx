import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowRight, CheckCircle2, Link2, CircleDot } from 'lucide-react';
import { platform } from '../api/client';
import type { WorkspaceListItem, PlatformHealth } from '../api/types';
import { SERVICES } from '../api/types';

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
      navigate(`/workspace/${ws.id}`);
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

  function connectedCount(ws: WorkspaceListItem): number {
    const ids = ws.service_ids;
    return [ids.fixai_org_id, ids.metrics_org_id, ids.logs_org_id, ids.code_parser_org_id].filter(Boolean).length;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <CircleDot size={32} style={{ color: 'var(--cc-accent)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--cc-text)' }}>
            CodeCircle
          </h1>
        </div>
        <p className="text-base max-w-2xl" style={{ color: 'var(--cc-text-secondary)' }}>
          Unified platform for AI-powered production debugging. Create a workspace, configure
          each service using its native UI, then connect them together.
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

      {/* Create form */}
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
              {creating ? 'Creating...' : 'Create'}
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
            const count = connectedCount(ws);
            return (
              <div
                key={ws.id}
                onClick={() => navigate(`/workspace/${ws.id}`)}
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
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Link2 size={12} style={{ color: 'var(--cc-text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--cc-text-secondary)' }}>
                        {count}/4 services connected
                      </span>
                    </div>
                    {/* service dots */}
                    <div className="flex items-center gap-1">
                      {SERVICES.map((svc) => (
                        <div
                          key={svc.key}
                          className="w-2 h-2 rounded-full"
                          title={`${svc.name}: ${ws.service_ids[svc.serviceIdField] ? 'Connected' : 'Not connected'}`}
                          style={{
                            background: ws.service_ids[svc.serviceIdField] ? svc.color : 'var(--cc-surface-3)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {count === 4 && (
                    <CheckCircle2 size={16} style={{ color: 'var(--cc-success)' }} />
                  )}
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
