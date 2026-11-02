# Layout Conventions

This document records layout decisions for OpenPlay portals — the rules that keep
screens consistent as new pages are added. The decision to adopt these
conventions is recorded in
[ADR-0013](../decisions/0013-web-frontend-ux-conventions.MD).

## Type scale

- Base `html` font size is `16px`; at viewports `1280px` and wider it is `20px`.
- Prefer rem-based sizing so content scales with the base font; avoid px font
  sizes for body content.

## Color

- Chrome (top bars, sidebar brand blocks, hero surfaces): the `bg-chrome`
  gradient (`purple-950` → `blue-950`, left to right) defined in each
  `index.css`, with white primary text and `indigo-100`/`indigo-200`
  secondary text. On-chrome hover states use `bg-white/10`; on-chrome
  outlined buttons use `border-indigo-200`.
- Interactive accents (links, primary buttons, focus rings, active nav):
  `indigo` scale. The palette motif is shades of purple and blue.
- Status tones: green = success/paid, amber = pending/attention,
  slate = cancelled/expired/unknown, red = failed/declined.

## Controls

- Grouped controls in a row use `gap-3` (toolbar items, table row actions,
  pagination).
- Secondary and row-action buttons always have a visible border matching their
  tone (`border-indigo-300`, `border-red-300`, `border-slate-300`). Text-only
  buttons are reserved for tertiary affordances (links, dismiss controls).
- `<select>` elements use the shared chevron style from `index.css`: custom
  arrow `0.5rem` from the right edge with `2rem` right padding.
- Grouped navigation sections are separated by a `slate-200` horizontal rule
  (first group excepted).

## Tables

- Data tables (`DataTable` in venue-portal) carry a search box, From/To date
  range on the first `*_at` column, sortable headers (click to cycle
  asc → desc → none), and 15-rows-per-page pagination with a
  "N rows (of M)" footer. Search, sorting, and the date range are driven by
  backend list params (`filter[q]`, `filter[from]`, `filter[to]`, `sort`);
  the table also narrows the loaded collection client-side for
  rendered/computed columns. Page slicing remains client-side.
- Empty collections keep the table chrome: the lone row shows the
  page's `emptyMessage`; filtered-out rows show "No matching rows."
  `EmptyState` (centered, no table) is only for "pick something first"
  prompts, not for empty results.
- Page-level pickers (document selects, status filters) belong in the
  table's toolbar row, never the PageHeader — `CrudPage.toolbar`
  forwards into `DataTable toolbar`, sharing `gap-3` with
  search/range controls — never stacked on their own line. The footer
  reads "No records found" for an empty collection. Order is fixed: pickers, then search, then From/To.

## Forms

- Field help text is declared via `FieldDef.help` and renders as small slate
  text beneath the input.
- Object attributes (venue `address`, tenant `details`) are edited as
  labeled sub-fields via dotted field names (`address.line1`,
  `details.description`) and recomposed into JSON on save — users never
  see raw JSON. Address fields: line 1, line 2, city, region/state,
  country (Intl `DisplayNames` dropdown).
- Timezone selects are hydrated from `Intl.supportedValuesOf('timeZone')`;
  the business timezone drives client-side datetime display while the API
  stores UTC. Help text avoids spec jargon (no IANA/UTC/JSONB).
- `FieldDef.defaultValue` applies platform-imposed defaults (e.g.
  country) only when a record has no stored value.
- Schedule pages use a Day | Week | Table segmented toggle. Time-grid
  views position booking blocks by the business timezone
  (`displayHour`), tint them by status semantics, link to the record,
  and lane overlapping bookings side-by-side. Navigation: ‹ › stepper,
  date picker, "Today" reset, venue filter — all in the header
  controls row with `gap-3`.

- Venue-portal navigation is ordered for the front-desk persona:
  "Front desk" (dashboard → check-ins → schedule → reservations →
  customers → events) first, then "Sales & inventory", "Venue admin",
  and "Account" last.

- Detail pages show labeled fields only — never raw JSON dumps or
  serialized attributes, which read as debug artifacts/bugs.
- Action button groups right-align (`justify-end` + `gap-3`). Nav
  links, segmented toggles, and form rows stay left-aligned.
- Destructive row actions always carry `confirm` text (opens the
  ConfirmDialog, `danger` styled). Custom action cells must gate
  their own destructive ops the same way.
- Delete dialogs name both the entity ("Delete Facility") and the
  record ("Delete \"Pool Lane 1\"? This cannot be undone.").
- Detail/summary cards include the record's own actions
  (status-gated) so users don't navigate back to act. Events past
  draft are cancelled, not deleted.
- Cancelling an event shows a reason input — required when the
  event has registrations, optional otherwise (sent to
  `cancellation_reason` + registrant emails).
- Confirm-style dialogs are vertically centered (`Modal
  centered`); top-aligned Modal is for long forms only.
- Action buttons name the object they act on in dialogs and detail
  views ("Cancel reservation", not "Cancel"); inside a table's
  action cell the row is the object, so the caption shortens to the
  verb alone ("Cancel") via `RowAction.tableLabel`. Detail pages:
  bordered "← Back to
  <records>" button left, action group right.
- View toggles persist per page via `localStorage["view:<page>"]`
  (`usePersistedView`) — each page remembers its own choice; no
  global view setting.
- In-flight API requests show as a slow gradient sweep on the
  chrome brand block (`loading-glow`, driven by `subscribeLoading`),
  not a spinner or progress bar. Table/search fetches debounce
  500 ms.
- Capacity displays name the unit — `registered_count` is seats;
  show "N registrations · S / Cap seats", never bare "N / M
  registered".
- Customers rows have an Edit dialog (phone + staff note); one
  PATCH per tab, table refreshes in place.
- "Show history" — small muted text link, right-aligned, last
  element *below* the detail card → audit-stream page (oldest
  first; sort control can flip). Every list entity gets a view
  page — `RecordDetailPage` + `detailPath` on `CrudPage` links the
  first column; no per-row history links in tables.
- View pages carry the record's actions (Edit/Delete/status
  transitions) — same labels, confirms, and gating as the table;
  no navigating back to act on a row.
