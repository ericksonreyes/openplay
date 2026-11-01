import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth';
import { SignInPage } from './SignInPage';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
  localStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SignInPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  it('requires all fields', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('required');
    // BackendStatus pings /public/status, but no sign-in request may be sent.
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).includes('/auth/sign-in')),
    ).toHaveLength(0);
  });

  it('posts tenant-scope credentials and stores the token', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { token: 'jwt-abc' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.api+json' },
      }),
    );
    renderPage();

    fireEvent.change(screen.getByLabelText(/Tenant code/), { target: { value: 'acme' } });
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'acme.owner' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() =>
      expect(localStorage.getItem('openplay.venue-portal.token')).toBe('jwt-abc'),
    );
    const [url, init] = fetchMock.mock.calls.find(
      ([u]) => String(u).includes('/auth/sign-in'),
    ) as [string, RequestInit];
    expect(url).toContain('/api/v1/auth/sign-in');
    expect(JSON.parse(init.body as string)).toEqual({
      scope: 'tenant',
      tenantCode: 'acme',
      identifier: 'acme.owner',
      password: 'secret',
    });
  });
});
