# Display conventions (UX decisions)

Decisions about how data is presented across the portals. Recorded when the
choice was made deliberately rather than inherited from a plan. Lint/tests
don't enforce these yet — compliance is by convention and review.

## 1. No raw identifiers or timestamps in operator tables

Lists and detail views never render raw UUIDs, SQIDs, or ISO timestamps —
identifiers are opaque by policy ([IDENTIFIERS.MD](../IDENTIFIERS.MD)).

- **People/customer columns** → display name → guest name → human reference
  (`RES-00007`); never the internal id.
- **Entity references** → resolved names via lookup lists or backend-emitted
  `*_name` attributes; an unresolved reference renders `—`, never a raw id.
- **Times** → local formatted values (`formatSlot`, `formatDateTime` in
  `services/venue-portal/src/lib/format.ts`), e.g. `Nov 4, 2026 · 10:00–11:00`.
  Venue-timezone correctness is a separate open item.
- **Structured fields** (`address`, `details`, `settings`) render via a
  semantic formatter — `line1, city, country` for addresses — never raw
  JSON/`[object Object]`. Full JSON stays on detail pages behind a formatted
  `<pre>` block where inspection is legitimate.
- **Debug access** to raw ids stays in the API, not the UI.

## 2. Entity references are links to their detail pages

A cell that names an entity links to that entity's own detail page when one
exists — e.g. a reservation's resource name → `/catalog/resources/:id`.
Link to the *detail* page, not the containing list. If no detail page exists
yet, render plain text and record the missing page as a gap (below).

## 3. Backend emits display fields

The API carries human-readable companions so frontends don't guess:
`customer_name`, `resource_name` on reservations (hydrated batched; player
names resolve via a field-allowlisted system-context lookup because
platform-scope users are RLS-invisible to tenants). Add `*_name` attributes
alongside `*_id` whenever a table renders another entity.

## 4. Collection vs aggregate endpoints

`api.list`/`useList` accept both `{data:[...]}` collections and
single-resource aggregates (`/schedule` → `attributes.reservations`),
normalizing to rows. Rendering code never assumes one shape.

## 5. Money, references, and structured fields

- **Money** is integer minor units (`*_cents`) — always render via
  `formatMoney` (Intl currency), never raw cents and never a separate bare
  currency column when the formatter already carries it.
- **Reference numbers** (`PAY-00001`, `RES-00007`) are the public face of
  transactional records — show them instead of truncated internal ids
  (`r.id.slice(0,8)` is a violation).
- **Badge/chip lists** of linked entities render names only; unresolved
  members are dropped, never shown as raw ids.

## 6. Entity pickers are search comboboxes, not long dropdowns

When a form field selects from a set that can grow (members, venues,
equipment, players), it uses a **debounced search combobox**, never a plain
`<select>`:

- type → ~250 ms debounced API lookup → scrollable result list (backend
  caps results, e.g. 50)
- click a result → it collapses to a removable pill/token; `×` clears back
  to search
- empty state ("No members found") and click-outside dismissal are required
- lookup endpoints expose only fields the picker needs (`display_name`,
  `email`), scoped to entities already related to the caller's tenant
  (`/reservations/players` is the reference implementation)

## 7. Mobile-first is required, not optional

The [UX guide](README.MD) mandates mobile-first. Every screen must be usable
on a phone-sized viewport:

- Tables → `overflow-x-auto` minimum; prefer stacked/card rows below `sm`
  for data-dense tables
- Sidebar/nav collapses (hamburger or bottom nav) under `md`
- Modals fit the viewport (`px-4`, `max-w-*` with `w-full`)
- Touch targets ≥ 44 px for row actions/buttons
- `lg:grid-cols-2` detail layouts stack cleanly to one column

## 8. Form fields are human-readable too

Selects show entity names (not ids); `datetime-local` inputs are the
exception to "no raw timestamps" — they are for entry, not display. Read-only
echoes of submitted values re-enter through the same formatting rules.

## Every page and form field explains itself

- **Pages** carry a one-line `description` under the title saying what the
  page is for and what you can do there — `PageHeader` accepts
  `description` in all portals.
- **Form fields** carry a short `help` line under the label for anything
  non-obvious (units like cents vs pesos, what a field controls, format
  hints like IANA timezones). `FieldDef.help` renders it in
  `ResourceForm`; hand-built forms use the same `text-xs text-slate-500`
  pattern.
- Descriptions are written for the operator, not the developer — say what
  the page *does*, not what the endpoint returns.

## Sign-in memory — username prefill vs session persistence

Two different conveniences with different risk profiles:

- **"Remember my username"** (identifier prefill) — offered on all portals.
  Stores only the identifier (plus tenant code on the venue portal) in
  `localStorage`; never the password, never a token. On the venue portal it
  defaults off because front-desk machines are shared.
- **"Remember me"** (session persistence) — offered **only on the player
  portal** (personal devices, low-value target). It controls where tokens
  live: checked → `localStorage` (survives restart, up to the 7-day refresh
  TTL); unchecked → `sessionStorage` (dies with the browser).
- **Venue + platform portals intentionally offer no remember-me** — shared
  front-desk machines and the highest-privilege surface. Their session
  tokens (access + refresh) live in `sessionStorage`, so closing the
  browser always ends the session. Sign-in convenience there stops at
  username prefill.

## Error messages come from a frontend catalog, not raw `detail`

API errors carry a stable `code`; the client maps it to human copy via a
per-app catalog (`src/lib/errors.ts`, `friendlyError(code, detail, meta)`).

- **Codes are domain-specific** (`CHECKIN_WINDOW_CLOSED`, `DOUBLE_BOOKING`,
  `MISSING_CONSENT`, `HOLD_EXPIRED`, `RESOURCE_CLOSED`, …) — emitted via
  `DomainException`; plain lifecycle conflicts stay `CONFLICT`.
- **`meta` carries context** the message needs — window times, required
  document titles — so copy can say *when* check-in opens, not just "outside
  the window".
- **Unknown codes fall back to `detail` verbatim** — catalog coverage is
  best-effort, never a dead end.
- Copy is written for the person acting on it (operator at a desk, player
  on a phone), not the developer.
- **Banner actions are honest**: fetch/load failures get *Retry* (reloads
  the data); domain/action failures get *Dismiss* (clears + refreshes) —
  never a *Retry* that silently re-runs or appears to do nothing.

## Compliance inventory — 2026-11-02 (full re-audit)

Audited every page/table in all four apps against §§1–9 + sign-in memory.

### Venue portal — compliant
- All tables: no raw ids/timestamps; `customer_name`/`resource_name`/
  `reference_no`/`formatMoney` applied; badges show names only.
- All entity cells link to detail pages — detail pages exist for venues,
  resources, activities, reservations, events, disputes, equipment, staff.
- `/customers` directory (members + guests), walk-in + member booking with
  search combobox, `filter[date]`/`filter[status]` honored on /reservations.
- Nav collapses under `md`; all tables card-mode; page descriptions +
  field help; error banners split honest Retry/Dismiss.

### Player portal — compliant
- All pages have descriptions; `/payments/:id` detail added; sliced-id
  fallbacks removed; collapsible top-nav; remember-me + username prefill;
  error catalog + Dismiss banners on all action errors.

### Platform portal — compliant
- All pages described; `/users` list+detail; collapsible sidebar;
  tenants/users tables card-mode; error banners have Dismiss; session
  tokens in sessionStorage by design.

### Public site — compliant
- Allowlisted fields only, `fmtTime`, responsive card grids; no tables to
  audit. No sign-in memory concern (anonymous).

### Resolved
- `GET /platform/users/:id` + `GET /check-ins` endpoints added.
- `*_name` hydration on rentals (`renter_name`/`equipment_name`),
  check-ins (`subject_name`), consent records (`user_name`).
- Platform audit-events browser page (`/audit-events`, purpose required).
- Waiver titles link to their versions view.
- `auth_tokens` purged opportunistically on each refresh.

### Still open
- `disputes.subject` hydration — subject references are payment
  references (`REF-*`), acceptable as-is.