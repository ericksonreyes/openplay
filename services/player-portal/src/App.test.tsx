import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from './App';

// Never settles — keeps BackendStatus in its 'loading' state so no act() warnings fire.
vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

test('redirects unauthenticated users from home to sign-in', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});

test('renders the sign-up form', () => {
  render(
    <MemoryRouter initialEntries={['/sign-up']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
});
