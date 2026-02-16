import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings } from 'lucide-react';
import { CodeCircleMark } from './CodeCircleMark';

const NAV_ITEMS = [
  { to: '/workspaces', icon: LayoutDashboard, label: 'Workspaces' },
  { to: '/settings', icon: Settings, label: 'Global AI' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cc-bg)' }}>
      <header
        className="h-14 flex items-center justify-between px-6 border-b shrink-0 relative z-30"
        style={{
          background: 'var(--cc-bg-elevated)',
          borderColor: 'var(--cc-border)',
          boxShadow: '0 1px 0 0 var(--cc-border)',
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 no-underline font-semibold text-base tracking-tight"
          style={{ color: 'var(--cc-text)' }}
        >
          <span className="text-[var(--cc-accent)]" style={{ lineHeight: 1 }}>
            <CodeCircleMark size={28} showRing={false} />
          </span>
          <span style={{ color: 'var(--cc-text)' }}>CodeCircle</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to === '/workspaces' && location.pathname.startsWith('/workspace'));
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors"
                style={{
                  color: active ? 'var(--cc-text)' : 'var(--cc-text-muted)',
                  background: active ? 'var(--cc-surface-2)' : 'transparent',
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
