import { apiBaseUrl, playerPortalUrl } from '../lib/api';

describe('apiBaseUrl', () => {
  it('falls back to the local backend port', () => {
    const saved = process.env.BACKEND_INTERNAL_URL;
    delete process.env.BACKEND_INTERNAL_URL;
    expect(apiBaseUrl()).toBe('http://localhost:8000');
    process.env.BACKEND_INTERNAL_URL = saved;
  });

  it('prefers BACKEND_INTERNAL_URL when set', () => {
    const saved = process.env.BACKEND_INTERNAL_URL;
    process.env.BACKEND_INTERNAL_URL = 'http://openplay-backend:8000';
    expect(apiBaseUrl()).toBe('http://openplay-backend:8000');
    process.env.BACKEND_INTERNAL_URL = saved;
  });
});

describe('playerPortalUrl', () => {
  it('defaults to the local player portal', () => {
    const saved = process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL;
    delete process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL;
    expect(playerPortalUrl('/venues/1')).toBe('http://localhost:3001/venues/1');
    process.env.NEXT_PUBLIC_PLAYER_PORTAL_URL = saved;
  });
});
