import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Layers, Plus, Zap } from 'lucide-react';
import { platform } from '../api/client';
import type { PlatformHealth } from '../api/types';
import { HeroOrbit } from '../components/CodeCircleMark';

/* ─── Applications (product suite) — FixAI is one of many ───────────── */
const APPLICATIONS = [
  {
    id: 'fixai',
    name: 'FixAI',
    tagline: 'AI-powered incident debugging',
    description: 'Chat with an AI that has context from your code, metrics, and logs. Debug production issues in one place.',
    icon: Bot,
    color: '#8b5cf6',
    available: true,
  },
  {
    id: 'more',
    name: 'More coming',
    tagline: 'Expand your toolkit',
    description: 'CodeCircle is built to grow. New applications will plug into the same workspaces and integrations.',
    icon: Layers,
    color: 'var(--cc-text-muted)',
    available: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<PlatformHealth | null>(null);

  useEffect(() => {
    platform.health().then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen cc-landing-bg relative">
      {/* Fixed orbit: stays in place while content scrolls */}
      <HeroOrbit />
      <div className="relative z-10">
      {/* ─── Hero ───────────────────────────────────────────────────── */}
      <section className="w-full max-w-4xl mx-auto px-6 pt-8 pb-16 text-center min-h-[75vh] flex flex-col items-center justify-center">
        <div className="w-full flex flex-col items-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{ background: 'var(--cc-accent-soft)', color: 'var(--cc-accent)' }}
        >
          <Zap size={16} /> One platform · End to end Tech Stack . AI Integrated.
        </div>
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
          style={{ color: 'var(--cc-text)', lineHeight: 1.15 }}
        >
          Production,
          <br />
          <span style={{ color: 'var(--cc-accent)' }}>simplified.</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'var(--cc-text-secondary)' }}>
          CodeCircle connects your stack and your team. Start with FixAI for AI-powered debugging—add more applications as we ship.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/workspaces')}
            className="cc-btn-primary"
          >
            <Plus size={18} /> Create workspace
          </button>
          <button
            onClick={() => navigate('/workspaces')}
            className="cc-btn-secondary"
          >
            Open existing workspace <ArrowRight size={16} />
          </button>
        </div>
        </div>
      </section>

      {/* ─── Applications ───────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-16 relative z-10">
        <h2 className="cc-heading-section text-center">Applications</h2>
        <p className="text-center text-sm mb-10 max-w-md mx-auto" style={{ color: 'var(--cc-text-muted)' }}>
          FixAI is the first application on CodeCircle. More are on the way—all in the same workspace.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {APPLICATIONS.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                className={`cc-card p-6 ${app.available ? 'cursor-default' : 'opacity-75'}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: app.available ? `${app.color}20` : 'var(--cc-surface-3)', color: app.color }}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base" style={{ color: 'var(--cc-text)' }}>
                        {app.name}
                      </h3>
                      {app.available && (
                        <span className="cc-badge cc-badge-success">Available</span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--cc-text-secondary)' }}>
                      {app.tagline}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
                      {app.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center pb-32 relative z-10">
        <button
          onClick={() => navigate('/workspaces')}
          className="text-sm font-medium cursor-pointer border-0 bg-transparent"
          style={{ color: 'var(--cc-accent)' }}
        >
          View all workspaces →
        </button>
      </p>

      </div>

      {/* ─── Status bar (minimal) ────────────────────────────────────── */}
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
