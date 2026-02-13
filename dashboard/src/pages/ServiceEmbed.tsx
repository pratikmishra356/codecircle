import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { SERVICES } from '../api/types';

export default function ServiceEmbed() {
  const { workspaceId, serviceKey } = useParams<{ workspaceId: string; serviceKey: string }>();
  const navigate = useNavigate();

  const svc = useMemo(() => SERVICES.find((s) => s.key === serviceKey), [serviceKey]);

  if (!svc) {
    return (
      <div className="flex items-center justify-center h-96" style={{ color: 'var(--cc-text-muted)' }}>
        Unknown service: {serviceKey}
      </div>
    );
  }

  const frontendUrl = `http://localhost:${svc.frontendPort}`;

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
          <div
            className="w-px h-5"
            style={{ background: 'var(--cc-border)' }}
          />
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: svc.color }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>
            {svc.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            — Create and manage organizations, configure providers, explore data
          </span>
        </div>
        <a
          href={frontendUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs no-underline px-2 py-1 rounded"
          style={{ color: 'var(--cc-text-muted)' }}
          title="Open in new tab"
        >
          <ExternalLink size={12} /> Open in new tab
        </a>
      </div>

      {/* Iframe */}
      <iframe
        src={frontendUrl}
        className="flex-1 w-full border-0"
        title={`${svc.name} UI`}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
