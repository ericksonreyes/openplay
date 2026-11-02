# ADR-0013: Web Frontend UX Conventions

## Status

Accepted — 2026-10-24. Amended 2026-11-03 (record actions on view
pages, ambient loading feedback, confirm-button color weight,
page-picker placement, lifecycle verbs).

## Context

OpenPlay runs four React frontends — `public-site`, `player-portal`,
`venue-portal`, `platform-portal` — built on shared primitives
(`DataTable`, `CrudPage`, `RecordDetailPage`, `RecordActions`,
`ResourceForm`, `StatusBadge`, `Modal`, `ConfirmDialog`). Without
explicit conventions the surfaces drift: stray buttons, differently
worded dialogs, inconsistent navigation, ad-hoc terminology. This
ADR records the recurring rules so every page reads as one product.

## Decision

### Branding and type

- **Base `html` font size `16px`; `≥1280px` viewports scale to
  `20px`.** Body content uses rem-based sizing; no px font sizes.
- **Chrome surfaces** (top bars, sidebar brand blocks, hero areas)
  use the `bg-chrome` gradient (`purple-950` → `blue-950`) defined in
  each `index.css`, with white primary text and `indigo-100/200`
  secondary text. On-chrome hover `bg-white/10`; on-chrome outlined
  buttons `border-indigo-200`. Interactive accents use the `indigo`
  scale — the motif is shades of purple and blue. Status tones:
  green = success/paid, amber = pending/attention, slate =
  cancelled/expired/unknown, red = failed/declined.

### Controls and spacing

- **Grouped controls in a row use `gap-3`** — toolbar items, row
  actions, pagination.
- **Secondary and row-action buttons carry a visible border** in
  their tone (`border-indigo-300`, `border-red-300`,
  `border-slate-300`); text-only buttons are reserved for tertiary
  affordances (links, dismiss controls).
- `<select>` elements use the shared chevron style — custom arrow
  `0.5rem` from the right edge with `2rem` right padding.
- **Action groups right-align** (`justify-end` + `gap-3`) on detail
  pages, dialogs, card footers, and table row actions. Nav links,
  segmented toggles, and form-control rows stay left-aligned.

### Tables

- `DataTable` carries **search, From/To range on the first `*_at`
  column, sortable headers (asc → desc → none), and 15-row
  pagination** with an "N rows (of M)" footer. Search/sort/range are
  server-driven (`filter[q]`, `filter[from]`, `filter[to]`, `sort` —
  ADR-0014); page slicing stays client-side until pagination params
  are finalized.
- **Page-level pickers render in the table's toolbar row** (never in
  the PageHeader) — order is fixed: pickers → search → From/To.
  `CrudPage.toolbar` forwards into `DataTable toolbar`.
- **Empty collections keep table chrome** — the lone row shows the
  page's `emptyMessage`; filtered-out rows show "No matching rows."
  `EmptyState` (no table) is only for "pick something first" prompts.
- **Debounced searches/filters run at 500 ms** — every keystroke or
  control change resets the timer; one request per pause in typing.

### Feedback

- **Background-activity feedback is ambient, not modal.** The
  `subscribeLoading` in-flight counter drives a slow `loading-glow`
  sweep on the chrome brand block (sidebar + mobile header) while
  requests run — no overlay spinners and no fixed progress bar.
- **View toggles persist per page** via `localStorage["view:<page>"]`
  (`usePersistedView`) — each page remembers its own choice.

### Forms

- Field help text comes from `FieldDef.help` and renders beneath the
  input; it avoids spec jargon (no IANA/UTC/JSONB).
- Object attributes are edited as dotted field names
  (`address.line1`, `details.description`, `recurrence.rule`) and
  recomposed into JSON on save — users never see raw JSON.
- **Attribute-gated display (`when`, `canDelete`) reads `rawAttr`,
  not `attr`** — `attr` stringifies values, so boolean/number gates
  silently fail (the `active`-flag price gate was the first to expose
  it). `rawAttr` returns the raw attribute value.
- `FieldDef.defaultValue` applies platform-imposed defaults only when
  the record has no stored value.
- Timezone selects hydrate from `Intl.supportedValuesOf('timeZone')`;
  the business timezone drives client-side datetime display while the
  API stores UTC.

### Record views and actions

- **Every list entity gets a view page** — `RecordDetailPage`
  (generic, attribute `dl`) or a bespoke `*DetailPage`; `CrudPage`'s
  `detailPath` links the first table column.
- **View pages carry the record's actions.** Every action a table
  row offers — Edit, Delete, status transitions — also appears on the
  record view with the same labels, confirmations, and gating. The
  shared `RecordActions` component renders the footer (bordered
  "← Back" left, actions right) so table and detail can never drift;
  page-level `fields`/`rowActions` config is hoisted and shared.
  Users never navigate back to a table to act on a row.
- **Actions are status-gated**, not hidden-because-of history:
  `when`/`canDelete` predicates show lifecycle verbs and Delete only
  when they can plausibly succeed; the backend 409 remains the
  last-line teacher (ADR-0015). Retire-vs-delete wording uses the
  entity's own lifecycle verb — Commission/Decommission/Recommission
  for venues, facilities, equipment; Publish/Unpublish for
  activities, prices, facility rules, waivers, holidays; closures
  cancel — and 409 backend messages name the same verb.
- **Destructive actions are gated.** `RowAction.confirm` renders a
  ConfirmDialog before `run()`; `danger` flags destructive styling.
  Custom `actions` render props bypass this gate, so any destructive
  op inside a custom action cell must wire its own ConfirmDialog.
- **Confirm buttons carry action weight.** The ConfirmDialog confirm
  button is red for `danger` actions (delete, cancel, decline,
  decommission, unpublish) and indigo for safe ones (publish,
  commission, save-adjacent confirms). Every dialog path — CrudPage,
  RecordActions, bespoke detail confirms — must propagate the
  action's `danger` flag; a blue confirm on a destructive op is a
  bug.
- **Named delete dialogs.** The delete ConfirmDialog title names the
  entity (singularized page title — "Delete Facility"), and the
  message names the specific record (identity attrs, then first
  column). Generic "Delete record" text is not allowed; a distracted
  user must be able to see what they're deleting.
- **Verb+object action labels.** Destructive/state-change buttons
  name the object they act on in dialogs and detail views — "Cancel
  reservation", never bare "Cancel". Inside a table's action cell
  the row *is* the object, so the caption can shorten to the verb
  alone (`RowAction.tableLabel`) — "Cancel" next to a closure row is
  unambiguous and can't be mistaken for a form-cancel.
- **Cancelling an entity with dependents collects a reason.** The
  cancel dialog requires a free-text reason when the record has
  active dependents (e.g. registrants); optional when there are none.
  Stored as `cancellation_reason`, included in the registrant
  notifications the backend queues on cancel.
- **Dialog vertical placement.** Confirm-style dialogs (including
  input dialogs like the event-cancel reason prompt) render
  vertically centered — `Modal centered`. The top-aligned `Modal`
  default is reserved for long forms that would clip.
- **Capacity numbers name their unit.** `registered_count` is seats,
  not parties — always label it "seats" and show the registration
  count alongside where both fit ("1 registration · 2 / 24 seats").
  A bare "N / M registered" misleads when parties book multiple
  seats.
- **Customer rows are editable in place.** A row-level Edit dialog
  (phone + staff note) saves via a single PATCH per customer tab and
  refreshes the table in place — no detail page required for a
  contact tweak.

### Revision history

- **"Show history" is the last element of a record view** — a small
  muted, right-aligned text link *below* the detail card navigating
  to `/history/:streamType/:streamId`. Detail views never inline
  history; tables never carry per-row history links.
- **History lists in chronological order** (oldest first); the
  table's sort control can still flip it.

### Navigation

- Venue-portal nav is ordered for the front-desk persona: "Front
  desk" (dashboard → check-ins → schedule → reservations → customers
  → events) first, then "Sales & inventory", "Venue admin",
  "Account" last. Nav groups are separated by a `slate-200` rule.

### Schedule views

- Schedule pages use a **Day | Week | Table** segmented toggle.
  Time-grid views position booking blocks by the business timezone
  (`displayHour`), tint by status semantics, link to the record, and
  lane overlapping bookings side-by-side. Navigation: ‹ › stepper,
  date picker, "Today" reset, venue filter — all in the header
  controls row with `gap-3`.

## Consequences

- New pages compose `CrudPage`/`RecordDetailPage`/`RecordActions`
  instead of inventing local affordances; conventions that need new
  behavior extend the shared components so all pages gain it.
- Terminology stays honest to the domain — "facilities" not
  "resources" in user copy; lifecycle verbs match each entity's
  stored statuses.
- Where a shared primitive can't express a rule (per-record entity
  naming, raw attribute gates), it gains a prop instead of pages
  forking the behavior.
