import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EmptyState, ErrorState, ResourceCard, StatusBadge } from './ui';

describe('StatusBadge', () => {
  it('renders the status label', () => {
    render(<StatusBadge status="confirmed" />);
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });

  it('falls back for unknown statuses', () => {
    render(<StatusBadge status="" />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the message in an alert role', () => {
    render(<ErrorState message="Not allowed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed');
  });
});

describe('EmptyState', () => {
  it('renders title and hint', () => {
    render(<EmptyState title="Nothing here" hint="Come back later" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Come back later')).toBeInTheDocument();
  });
});

describe('ResourceCard', () => {
  it('links to the detail page', () => {
    render(
      <MemoryRouter>
        <ResourceCard to="/venues/v1" title="Court A" subtitle="Downtown" status="active" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/venues/v1');
    expect(screen.getByText('Court A')).toBeInTheDocument();
  });
});
