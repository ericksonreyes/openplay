/**
 * Human-readable error copy keyed by the API's stable error codes
 * (UX rule: users never see raw server `detail` phrasing when we have a
 * catalog entry — meta carries context like window times and titles).
 */
type Meta = Record<string, unknown> | undefined;

const fmt = (iso: unknown): string => {
  const d = iso ? new Date(String(iso)) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
};

const MESSAGES: Record<string, string | ((meta: Meta) => string)> = {
  CHECKIN_WINDOW_CLOSED: (m) =>
    m?.window_opens_at
      ? `Check-in opens ${fmt(m.window_opens_at)} and stays open until the booking ends.`
      : 'Check-in is only allowed shortly before the booking starts.',
  RESERVATION_NOT_CONFIRMED: () =>
    'This booking is not confirmed yet — confirm it before checking in.',
  HOLD_EXPIRED: () => 'The hold on this slot has expired. Start the booking again.',
  RESOURCE_CLOSED: () => 'That resource is closed during the requested time.',
  MISSING_CONSENT: (m) => {
    const req = (m?.required as { title?: string }[] | undefined) ?? [];
    return req.length
      ? `Still needs to be signed first: ${req.map((r) => r.title ?? 'required document').join(', ')}.`
      : 'A required waiver or rule acknowledgment is missing.';
  },
  DOUBLE_BOOKING: () => 'That time slot is already taken.',
  CONFLICT: () => 'That action conflicts with the current state of the record.',
  RATE_LIMITED: () => 'Too many attempts — please wait a moment and try again.',
  UNAUTHENTICATED: () => 'Your session has expired. Please sign in again.',
  FORBIDDEN: () => 'You don’t have permission to do that.',
  NOT_FOUND: () => 'That record doesn’t exist, or you don’t have access to it.',
  UNPROCESSABLE: () => 'That request can’t be completed as submitted — check the details and try again.',
  BAD_REQUEST: () => 'Something was missing or malformed in the request.',
  UNSUPPORTED_MEDIA_TYPE: () => 'Unsupported request format.',
  UNAVAILABLE: () => 'The service is temporarily unavailable — try again in a moment.',
  INTERNAL: () => 'Something went wrong on our side. Please try again.',
};

export function friendlyError(code: string | undefined, detail: string | undefined, meta?: Meta): string {
  const entry = code ? MESSAGES[code] : undefined;
  if (typeof entry === 'function') return entry(meta);
  if (typeof entry === 'string') return entry;
  return detail ?? 'Something went wrong. Please try again.';
}
