import { renderNotification } from './templates';

describe('renderNotification', () => {
  it('renders a known kind with its link', () => {
    const msg = renderNotification('booking.confirmation', {
      link: 'https://app.openplay.test/bookings/abc',
    });
    expect(msg.subject).toBe('Your reservation is confirmed');
    expect(msg.text).toContain('https://app.openplay.test/bookings/abc');
  });

  it('falls back to a generic notice for unknown kinds', () => {
    const msg = renderNotification('unknown.kind', { link: 'https://x.test' });
    expect(msg.subject).toBe('OpenPlay notification');
    expect(msg.text).toContain('https://x.test');
  });

  it('uses a default link when none is provided', () => {
    const msg = renderNotification('booking.cancelled', {});
    expect(msg.text).toContain('https://openplay.local');
  });

  it('never echoes private payload fields into the message', () => {
    const msg = renderNotification('payment.status', {
      link: 'https://x.test',
      card_number: '4242424242424242',
      amount_cents: 9900,
    });
    expect(msg.text).not.toContain('4242');
    expect(msg.text).not.toContain('9900');
    expect(msg.subject).not.toContain('4242');
  });
});
