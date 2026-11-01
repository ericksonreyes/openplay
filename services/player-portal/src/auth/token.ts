const TOKEN_KEY = 'openplay.token';
const REFRESH_KEY = 'openplay.refresh';

/** 'remember me' → localStorage (survives browser restart); otherwise sessionStorage. */
function store(persistent: boolean): Storage {
  return persistent ? localStorage : sessionStorage;
}
function activeStore(): Storage {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ? sessionStorage : localStorage;
  } catch {
    return localStorage;
  }
}

export function getToken(): string | null {
  try {
    return activeStore().getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string, persistent = true): void {
  store(persistent).setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  } catch { /* ignore */ }
}

export function setRefreshToken(token: string, persistent = true): void {
  store(persistent).setItem(REFRESH_KEY, token);
}

export function getRefreshToken(): string | null {
  try {
    return activeStore().getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}
