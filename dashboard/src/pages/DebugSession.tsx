import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, AlertCircle } from 'lucide-react';
import { platform } from '../api/client';
import type { Workspace } from '../api/types';
import { SERVICES } from '../api/types';

/**
 * DebugSession embeds FixAI's own chat frontend via iframe.
 * If the workspace has a linked FixAI org, we pass the org ID
 * as a URL parameter so FixAI opens the right org context.
 */
export default function DebugSession() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fixaiSvc = SERVICES.find((s) => s.key === 'fixai')!;

  useEffect(() => {
    if (!workspaceId) return;
    platform
      .getWorkspace(workspaceId)
      .then(setWorkspace)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        Loading...
      </div>
    );
  }

  const fixaiOrgId = workspace?.service_ids.fixai_org_id;

  if (!fixaiOrgId) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <AlertCircle size={48} style={{ color: 'var(--cc-warning)' }} className="mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--cc-text)' }}>
          No FixAI Organization Connected
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
          To start debugging, first open the FixAI UI to create an organization, then connect it
          to this workspace from the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(`/workspace/${workspaceId}/service/fixai`)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-0"
            style={{ background: fixaiSvc.color, color: '#fff' }}
          >
            Open FixAI UI
          </button>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer border"
            style={{ background: 'transparent', borderColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // FixAI frontend URL — pass org ID as query param so the frontend
  // can pre-select the correct organization context
  const fixaiUrl = `http://localhost:${fixaiSvc.frontendPort}?org=${fixaiOrgId}`;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0 relative z-10"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="flex items-center gap-1 text-xs cursor-pointer border-0 bg-transparent"
            style={{ color: 'var(--cc-text-muted)' }}
          >
            <ArrowLeft size={14} /> Back to Workspace
          </button>
          <div className="w-px h-5" style={{ background: 'var(--cc-border)' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: fixaiSvc.color }} />
          <span className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>
            AI Debugging Session
          </span>
          <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            — Powered by FixAI
          </span>
        </div>
        <a
          href={fixaiUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs no-underline px-2 py-1 rounded"
          style={{ color: 'var(--cc-text-muted)' }}
          title="Open FixAI in new tab"
        >
          <ExternalLink size={12} /> Open in new tab
        </a>
      </div>

      {/* FixAI iframe */}
      <iframe
        src={fixaiUrl}
        className="flex-1 w-full border-0"
        title="FixAI Debug Session"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
