import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { envelope, jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { clearToken, getToken, getRefreshToken, setToken, setRefreshToken } from './token';

interface SignInInput {
  identifier: string;
  password: string;
  /** 'Remember me' — persist the session across browser restarts. */
  rememberMe?: boolean;
}

interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Extracts the Bearer token from a sign-in/sign-up resource payload. */
function extractToken(resource: JsonApiResource | JsonApiResource[] | null): string {
  const attributes = Array.isArray(resource) ? resource[0]?.attributes : resource?.attributes;
  const token = attributes?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('The server did not return a session token.');
  }
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const signIn = useCallback(async ({ identifier, password, rememberMe = false }: SignInInput) => {
    const resource = await jsonApi<JsonApiResource>('/auth/sign-in', {
      method: 'POST',
      body: envelope('sessions', { scope: 'platform', identifier, password }),
    });
    const next = extractToken(resource);
    setToken(next, rememberMe);
    const rt = resource.attributes?.refresh_token;
    if (typeof rt === 'string') setRefreshToken(rt, rememberMe);
    setTokenState(next);
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }: SignUpInput) => {
    const resource = await jsonApi<JsonApiResource>('/auth/sign-up', {
      method: 'POST',
      body: envelope('accounts', {
        scope: 'platform',
        email,
        password,
        display_name: displayName,
      }),
    });
    const next = extractToken(resource);
    setToken(next);
    setTokenState(next);
  }, []);

  const signOut = useCallback(() => {
    const rt = getRefreshToken();
    if (rt) {
      void jsonApi('/auth/sign-out', {
        method: 'POST',
        body: envelope('session', { refresh_token: rt }),
      }).catch(() => {});
    }
    clearToken();
    setTokenState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, isAuthenticated: token !== null, signIn, signUp, signOut }),
    [token, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
