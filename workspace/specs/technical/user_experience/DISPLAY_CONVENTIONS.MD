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

## Compliance inventory — 2026-11-01

Audited every table/page against §1–§3.

### Venue portal — compliant (re-audited + fixed 2026-11-01; responsive pass done — collapsible nav + card-mode tables)
- **Fixed:** raw `_id` fallbacks everywhere; all timestamps → formatted;
  money → `formatMoney`; `ID` columns → `reference_no`; venue/activity/
  resource cells → links to detail pages (`/catalog/venues/:id`,
  `/catalog/resources/:id` — both added); address/settings/payload objects →
  semantic formatters or `—`.
- **Detail pages now:** `/catalog/{venues,resources,activities}/:id`, `/reservations/:id`, `/events/:id`, `/disputes/:id`, `/equipment/:id`, `/staff/:id`.

### Player portal — compliant (re-audited: added `/payments/:id` detail + links; removed a truncated-id fallback; collapsible top-nav added)
`attrs.ts` formatters used throughout; no raw ids in tables.

### Platform portal — compliant (collapsible sidebar; tables render as cards under `md` everywhere — no exceptions)
Page-local `formatDate` used; tenant names/codes everywhere.

### Public site — compliant (already responsive: 2-link nav, `sm:`/`lg:` card grids)
`fmtTime`/card serializers; allowlisted fields only by design.

### Remaining gaps (detail pages that don't exist yet → plain text today)
- Venue portal: tenant-audit view page; waiver-document detail
  (`/catalog/waivers/:id` currently routes straight to versions).
- Platform portal: audit-events browser page (endpoint exists, UI planned);
  `/platform/users/:id` detail resolves from the list until a GET endpoint
  exists.
- Backend: emit `*_name` companions on rentals (equipment), check-ins,
  consent records, disputes, staff — same pattern as reservations.

## Walk-in subjects

Staff create reservations for walk-in guests with `guest_name` (required) +
optional `guest_contact` (phone/email) — the backend find-or-creates a
`guest_contacts` row (verification columns nullable since migration 0012) and
the reservation displays the guest name like any player. `player_id` remains
the on-behalf path for account holders.
