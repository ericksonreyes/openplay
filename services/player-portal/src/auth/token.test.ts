import { describe, expect, it } from 'vitest';
import { clearToken, getToken, setToken } from './token';

describe('token store', () => {
  it('round-trips the token through localStorage', () => {
    clearToken();
    expect(getToken()).toBeNull();
    setToken('jwt-abc');
    expect(getToken()).toBe('jwt-abc');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
