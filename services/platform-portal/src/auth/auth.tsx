import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearToken, getToken, getRefreshToken, setToken, setRefreshToken, signIn as apiSignIn } from '../lib/api';
import type { SessionUser } from '../lib/api';

const USER_KEY = 'openplay.platform.user';

interface AuthContextValue {
  authenticated: boolean;
  user: SessionUser | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<SessionUser | null>(() => loadUser());

  const signIn = useCallback(async (identifier: string, password: string) => {
    const session = await apiSignIn(identifier, password);
    setToken(session.attributes.token);
    const rt = (session.attributes as Record<string, unknown>).refresh_token;
    if (typeof rt === 'string') setRefreshToken(rt);
    localStorage.setItem(USER_KEY, JSON.stringify(session.attributes.user));
    setTokenState(session.attributes.token);
    setUser(session.attributes.user);
  }, []);

  const signOut = useCallback(() => {
    const rt = getRefreshToken();
    if (rt) {
      void fetch(`${(import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1'}/auth/sign-out`, {
        method: 'POST',
        headers: { 'content-type': 'application/vnd.api+json' },
        body: JSON.stringify({ data: { type: 'session', attributes: { refresh_token: rt } } }),
      }).catch(() => {});
    }
    clearToken();
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ authenticated: token !== null, user, signIn, signOut }),
    [token, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
