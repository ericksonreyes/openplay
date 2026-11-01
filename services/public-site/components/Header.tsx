import Link from 'next/link';

const links = [
  { href: '/businesses', label: 'Businesses' },
  { href: '/events', label: 'Events' },
];

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"
      >
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          OpenPlay
        </Link>
        <ul className="flex items-center gap-6 text-sm font-medium text-slate-600">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-slate-900">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL ?? 'http://localhost:3001'}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
            >
              Sign in
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
