import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/auth';
import { ToastProvider } from './components/toast';
import { setToken } from './lib/api';
import { StatusBadge } from './components/StatusBadge';

const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

test('renders the sign-in page', () => {
  renderApp('/sign-in');
  expect(screen.getByRole('heading', { name: /openplay platform portal/i })).toBeInTheDocument();
});

test('redirects unauthenticated users from / to sign-in', () => {
  localStorage.clear();
  renderApp('/');
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test('renders status badge labels', () => {
  localStorage.clear();
  setToken('tok');
  render(<StatusBadge status="awaiting_review" />);
  expect(screen.getByText('Awaiting review')).toBeInTheDocument();
});
