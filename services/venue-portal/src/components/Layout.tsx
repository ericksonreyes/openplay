import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth';
import { api, attr } from '../lib/api';
import { setDisplayTimeZone } from '../lib/format';
import { BackendStatus } from '../BackendStatus';
import { subscribeLoading } from '../lib/api';

const nav: { section: string; items: { to: string; label: string }[] }[] = [
  {
    section: 'Front desk',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/check-ins', label: 'Check-in desk' },
      { to: '/schedule', label: 'Schedule' },
      { to: '/reservations', label: 'Reservations' },
      { to: '/customers', label: 'Customers' },
      { to: '/events', label: 'Events' },
    ],
  },
  {
    section: 'Sales & inventory',
    items: [
      { to: '/rentals', label: 'Rentals' },
      { to: '/payments', label: 'Payments' },
      { to: '/disputes', label: 'Disputes' },
    ],
  },
  {
    section: 'Venue admin',
    items: [
      { to: '/catalog/venues', label: 'Venues' },
      { to: '/catalog/resources', label: 'Facilities' },
      { to: '/catalog/activities', label: 'Activities' },
      { to: '/catalog/prices', label: 'Prices' },
      { to: '/membership-plans', label: 'Membership plans' },
      { to: '/equipment', label: 'Equipment' },
      { to: '/catalog/facility-rules', label: 'Facility rules' },
      { to: '/catalog/waivers', label: 'Waivers' },
      { to: '/catalog/holidays', label: 'Holidays' },
      { to: '/catalog/closures', label: 'Closures' },
      { to: '/staff', label: 'Staff' },
    ],
  },
  {
    section: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications' },
      { to: '/consent/rules', label: 'Rule acknowledgments' },
      { to: '/consent/waivers', label: 'Waiver signatures' },
      { to: '/settings', label: 'Settings' },
    ],
  },
];


export function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const [pending, setPending] = useState(0);
  useEffect(() => subscribeLoading(setPending), []);

  // Hydrate the display timezone once for the whole app; timestamps stay UTC.
  useEffect(() => {
    api
      .get('/tenants/current')
      .then((t) => {
        const details = t.attributes?.details as Record<string, unknown> | undefined;
        setDisplayTimeZone(typeof details?.timezone === 'string' ? details.timezone : undefined);
      })
      .catch(() => undefined);
  }, []);

  const sidebar = (className: string) => (
    <aside className={`${className} w-56 shrink-0 flex-col border-r border-slate-200 bg-white`}>
      <div className={`bg-chrome px-4 py-4 ${pending > 0 ? "loading-glow" : ""}`}>
        <p className="text-sm font-semibold text-white">OpenPlay</p>
        <p className="text-xs text-indigo-200">Venue Portal</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {nav.map((group) => (
          <div key={group.section} className="mb-4 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group.section}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  `block rounded px-2 py-2 text-sm ${
                    isActive
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-4 py-3">
        <BackendStatus />
        <button
          onClick={() => {
            signOut();
            navigate('/sign-in');
          }}
          className="mt-2 w-full rounded px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {sidebar('hidden md:flex')}
      <header className={`fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between bg-chrome px-4 md:hidden ${pending > 0 ? "loading-glow" : ""}`}>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="rounded p-1.5 text-indigo-100 hover:bg-white/10"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-white">OpenPlay</p>
        <span className="w-8" />
      </header>
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="flex h-full">{sidebar('flex')}</div>
        </div>
      )}
      <main className="min-w-0 flex-1 p-4 pt-16 md:p-6 md:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
