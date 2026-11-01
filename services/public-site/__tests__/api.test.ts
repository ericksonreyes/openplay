import { apiBaseUrl } from '../lib/api';

describe('apiBaseUrl', () => {
  it('falls back to the local backend port', () => {
    const saved = process.env.BACKEND_INTERNAL_URL;
    delete process.env.BACKEND_INTERNAL_URL;
    expect(apiBaseUrl()).toBe('http://localhost:8000');
    process.env.BACKEND_INTERNAL_URL = saved;
  });
});
