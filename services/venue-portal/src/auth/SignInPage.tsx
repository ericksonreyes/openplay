import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { BackendStatus } from '../BackendStatus';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const REMEMBER_KEY = 'openplay.venue-portal.remembered';
  const remembered = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? 'null') as { tenant?: string; user?: string } | null;
  const [tenantCode, setTenantCode] = useState(remembered?.tenant ?? 'acme');
  const [identifier, setIdentifier] = useState(remembered?.user ?? '');
  const [rememberUser, setRememberUser] = useState(Boolean(remembered));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tenantCode.trim() || !identifier.trim() || !password) {
      setError('Tenant code, username, and password are all required.');
      return;
    }
    setBusy(true);
    try {
      await signIn(tenantCode.trim(), identifier.trim(), password);
      // Prefill only — front-desk machines are shared; sessions are never remembered (UX: no remember-me).
      if (rememberUser) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ tenant: tenantCode.trim(), user: identifier.trim() }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-slate-900">OpenPlay Venue Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage your business.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tenant code</span>
            <input
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="acme"
              autoComplete="organization"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Username</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="acme.owner"
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberUser}
              onChange={(e) => setRememberUser(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Remember my username
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-4 flex justify-center">
          <BackendStatus />
        </div>
      </div>
    </main>
  );
}
