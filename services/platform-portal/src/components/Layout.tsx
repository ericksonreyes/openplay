import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth';
import { BackendStatus } from '../BackendStatus';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tenants', label: 'Tenants', end: false },
  { to: '/users', label: 'Users', end: false },
  { to: '/status', label: 'Platform status', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const onSignOut = () => {
    signOut();
    navigate('/sign-in', { replace: true });
  };

  const sidebar = (className: string) => (
    <aside className={`${className} w-60 flex-col border-r border-slate-200 bg-white`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-sm font-semibold text-slate-900">OpenPlay</p>
        <p className="text-xs text-slate-500">Platform Administrator</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setNavOpen(false)}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4">
        <BackendStatus />
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {sidebar('hidden md:flex')}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="flex h-full">{sidebar('flex')}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
            {user?.display_name ?? user?.username ?? 'Platform administrator'}
          </span>
          <button
            onClick={onSignOut}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 md:py-1.5"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
