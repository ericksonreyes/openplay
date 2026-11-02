import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorState } from '../components/ui';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const REMEMBER_KEY = 'openplay.player.remembered';
  const [identifier, setIdentifier] = useState(localStorage.getItem(REMEMBER_KEY) ?? '');
  const [rememberUser, setRememberUser] = useState(Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [rememberMe, setRememberMe] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn({ identifier, password, rememberMe });
      if (rememberUser) localStorage.setItem(REMEMBER_KEY, identifier.trim());
      else localStorage.removeItem(REMEMBER_KEY);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Sign in</h1>
        {error && <div className="mb-3"><ErrorState message={error} /></div>}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Remember my username
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Remember me on this device
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          No account?{' '}
          <Link to="/sign-up" className="font-medium text-indigo-700 hover:underline">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
