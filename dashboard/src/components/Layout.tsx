import { Link, Outlet, useLocation } from 'react-router-dom';
import { CircleDot, LayoutDashboard } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Workspaces' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cc-bg)' }}>
      {/* Top Bar */}
      <header
        className="h-14 flex items-center justify-between px-6 border-b shrink-0"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <CircleDot size={22} style={{ color: 'var(--cc-accent)' }} />
          <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--cc-text)' }}>
            CodeCircle
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm no-underline transition-colors"
                style={{
                  color: active ? 'var(--cc-accent)' : 'var(--cc-text-secondary)',
                  background: active ? 'var(--cc-accent-glow)' : 'transparent',
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
