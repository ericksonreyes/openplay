/**
 * Notification templates keyed by `kind`. Message bodies carry a link to the
 * relevant OpenPlay page — never private booking, guest, or payment details
 * (domain spec: NOTIFICATIONS "message privacy").
 */

export interface RenderedMessage {
  subject: string;
  text: string;
}

type Payload = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Public page link supplied by the triggering module; kept generic. */
const link = (p: Payload): string => str(p.link) || 'https://openplay.local';

const TEMPLATES: Record<string, (p: Payload) => RenderedMessage> = {
  'booking.confirmation': (p) => ({
    subject: 'Your reservation is confirmed',
    text: `Your reservation is confirmed. View it here: ${link(p)}`,
  }),
  'booking.pending': (p) => ({
    subject: 'Your reservation is pending',
    text: `Your reservation request is pending review. View it here: ${link(p)}`,
  }),
  'booking.changed': (p) => ({
    subject: 'Your reservation was updated',
    text: `Your reservation has been updated. View it here: ${link(p)}`,
  }),
  'booking.cancelled': (p) => ({
    subject: 'Your reservation was cancelled',
    text: `Your reservation has been cancelled. View it here: ${link(p)}`,
  }),
  'payment.status': (p) => ({
    subject: 'Payment update for your booking',
    text: `There is a payment update on your booking. View it here: ${link(p)}`,
  }),
  'reminder.upcoming_reservation': (p) => ({
    subject: 'Reminder: your reservation is coming up',
    text: `Your reservation is coming up soon. View it here: ${link(p)}`,
  }),
  'reminder.event': (p) => ({
    subject: 'Reminder: your event is coming up',
    text: `An event you registered for is coming up. View it here: ${link(p)}`,
  }),
  'reminder.equipment': (p) => ({
    subject: 'Reminder: equipment pickup/return deadline',
    text: `You have an equipment rental deadline coming up. View it here: ${link(p)}`,
  }),
  'event.cancelled': (p) => ({
    subject: `Event cancelled: ${str(p.event_name) || 'Event'}`,
    text: `The event "${str(p.event_name)}"${str(p.starts_at) ? ` on ${str(p.starts_at)}` : ''} has been cancelled.${
      str(p.reason) ? ` Reason: ${str(p.reason)}.` : ''
    }${str(p.refund_note) ? ` ${str(p.refund_note)}.` : ''} View details here: ${link(p)}`,
  }),
  'venue.alert': (p) => ({
    subject: 'Venue alert',
    text: `There is new activity in your venue. Review it here: ${link(p)}`,
  }),
};

/** Renders a kind + payload; unknown kinds fall back to a neutral notice. */
export function renderNotification(kind: string, payload: Payload): RenderedMessage {
  const template = TEMPLATES[kind];
  if (template) {
    return template(payload);
  }
  return {
    subject: 'OpenPlay notification',
    text: `You have a new notification. View it here: ${link(payload)}`,
  };
}
