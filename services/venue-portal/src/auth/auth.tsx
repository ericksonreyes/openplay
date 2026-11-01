import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api, setToken, clearToken, getToken, setRefreshToken, getRefreshToken } from '../lib/api';

interface SignInResponse {
  token?: string;
  access_token?: string;
  attributes?: { token?: string; access_token?: string };
}

interface AuthContextValue {
  authenticated: boolean;
  signIn: (tenantCode: string, identifier: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => getToken() !== null);

  const signIn = useCallback(async (tenantCode: string, identifier: string, password: string) => {
    const data = await api.post<SignInResponse>('/auth/sign-in', {
      scope: 'tenant',
      tenantCode,
      identifier,
      password,
    });
    const token =
      data?.token ?? data?.access_token ?? data?.attributes?.token ?? data?.attributes?.access_token;
    if (!token) throw new Error('Sign-in response did not include a token.');
    setToken(token);
    const refresh = data?.attributes?.refresh_token;
    if (typeof refresh === 'string') setRefreshToken(refresh);
    setAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    const refresh = getRefreshToken();
    if (refresh) {
      void api.post('/auth/sign-out', { refresh_token: refresh }).catch(() => {});
    }
    clearToken();
    setAuthenticated(false);
  }, []);

  const value = useMemo(() => ({ authenticated, signIn, signOut }), [authenticated, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function RequireAuth() {
  const { authenticated } = useAuth();
  const location = useLocation();
  if (!authenticated) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
