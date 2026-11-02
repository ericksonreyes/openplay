/** Shared display formatting — never show raw ISO timestamps in UI tables.
 *
 *  Timestamps arrive from the API in UTC; display them in the business's
 *  configured timezone once hydrated via setDisplayTimeZone (from tenant
 *  settings), falling back to the browser's zone until then. */

let displayTz: string | undefined;

export function setDisplayTimeZone(tz: string | null | undefined) {
  displayTz = tz || undefined;
}

/** IANA timezone options hydrated from the browser's Intl database. */
export function ianaTimezones(): { value: string; label: string }[] {
  try {
    return Intl.supportedValuesOf('timeZone').map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }));
  } catch {
    return [{ value: 'UTC', label: 'UTC' }];
  }
}

const dtFmt = (tz?: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  });
const tmFmt = (tz?: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

/** Hour of an ISO timestamp (0–24, fractional) in the hydrated display zone. */
export function displayHour(iso: string): number {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: displayTz,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h + m / 60;
}

export function formatDateTime(iso: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${dtFmt(displayTz).format(d)} · ${tmFmt(displayTz).format(d)}`;
}

export function formatSlot(start: string, end: string): string {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || Number.isNaN(s.getTime())) return '—';
  const date = dtFmt(displayTz).format(s);
  const time = tmFmt(displayTz).format(s);
  if (!e || Number.isNaN(e.getTime())) return `${date} · ${time}`;
  return `${date} · ${time}–${tmFmt(displayTz).format(e)}`;
}

const ISO_3166_ALPHA2 =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

/** Platform-imposed default country for new records (ISO-3166 alpha-2). */
export const DEFAULT_COUNTRY: string = import.meta.env.VITE_DEFAULT_COUNTRY ?? 'PH';

/** Country options hydrated from the browser's Intl region names. */
export function countries(): { value: string; label: string }[] {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return ISO_3166_ALPHA2.map((code) => ({
      value: code,
      label: dn.of(code) ?? code,
    })).sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return ISO_3166_ALPHA2.map((code) => ({ value: code, label: code }));
  }
}

/** YYYY-MM-DD of an ISO timestamp in the hydrated display zone. */
export function displayDay(iso: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: displayTz }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/** Money is integer minor units (centavos) — render with the ISO currency. */
export function formatMoney(cents: unknown, currency: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  const cur = typeof currency === 'string' && currency ? currency : 'PHP';
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: cur }).format(n / 100);
}
