import Link from 'next/link';

const links = [
  { href: '/businesses', label: 'Businesses' },
  { href: '/events', label: 'Events' },
];

export function Header() {
  return (
    <header className="bg-chrome">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"
      >
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          OpenPlay
        </Link>
        <ul className="flex items-center gap-6 text-sm font-medium text-indigo-100">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL ?? 'http://localhost:3001'}
              className="rounded-md border border-indigo-200 px-3 py-1.5 text-white hover:bg-white/10"
            >
              Sign in
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
