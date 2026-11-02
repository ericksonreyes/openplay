import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BackendStatus } from '../BackendStatus';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/venues', label: 'Venues' },
  { to: '/reservations', label: 'Reservations' },
  { to: '/events', label: 'Events' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/check-in', label: 'Check-in' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/profile', label: 'Profile' },
];

export function Layout() {
  const { isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-chrome">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-white">
            OpenPlay
          </NavLink>
          {isAuthenticated && (
            <button
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              className="rounded p-1.5 text-indigo-100 hover:bg-white/10 md:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {isAuthenticated && (
            <nav className={`${navOpen ? 'flex' : 'hidden'} w-full flex-col gap-2 text-sm md:flex md:w-auto md:flex-wrap md:flex-row md:gap-x-4 md:gap-y-1`}>
              {NAV_ITEMS.filter((i) => i.to !== '/').map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    isActive ? 'font-semibold text-white' : 'text-indigo-100 hover:text-white'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4">
            <BackendStatus />
            {isAuthenticated ? (
              <button
                onClick={() => {
                  signOut();
                  navigate('/sign-in');
                }}
                className="rounded-md border border-indigo-200 px-3 py-1.5 text-sm text-white hover:bg-white/10"
              >
                Sign out
              </button>
            ) : (
              <NavLink
                to="/sign-in"
                className="rounded-md border border-indigo-200 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
              >
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
