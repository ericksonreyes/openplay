# ADR-0014: Server-Side Sort, Search, and Date Range on List Endpoints

## Status

Accepted

## Context

Portal list views must support sorting, text search, and date-range
filtering (ADR-0013). Applying these client-side only works while whole
collections fit in the browser and produces ordering/filtering that cannot
match the database. The JSON:API envelope decision (ADR-0011) and the API
contract already reserve `filter[<field>]`, `sort`, and `page[*]` query
param names.

## Decision

List endpoints accept the following query params, parsed by the shared
`parseListQuery` helper (`services/backend/src/common/list-query.ts`):

- `sort=<field>` / `sort=-<field>` — ascending/descending order. The key is
  an API attribute name (snake_case) mapped through a per-endpoint
  allowlist; unknown keys are ignored and the endpoint's default order
  applies.
- `filter[from]` / `filter[to]` — `YYYY-MM-DD` calendar dates applied
  inclusively to the endpoint's primary date field (`startsAt` for
  reservations, rentals, closures, events; `openedAt` for disputes;
  `registeredAt` for registrations; `recordedAt` for check-ins;
  `createdAt` elsewhere). Malformed dates return `400`.
- `filter[q]` — free-text, case-insensitive `contains` matching over a
  per-endpoint allowlist of fields (e.g. reference numbers, names, emails).

- Frontends send these params via the `DataTable` `server` control hook
  (`useServerTable` / `CrudPage`), debounced for text input. The table may
  additionally narrow the loaded page client-side for rendered/computed
  columns that the API cannot search.
- Pagination (`page[number]`/`page[size]`) remains client-side for now and
  is a separate decision when collection sizes require it.

## Reasons

- One helper keeps param names, date semantics, and error behavior
  identical across ~18 list endpoints.
- Allowlists per endpoint prevent sorting/filtering on unindexed or
  sensitive columns and keep the contract explicit.
- Ignoring unknown sort keys keeps older clients working when keys change;
  rejecting malformed dates surfaces real bugs rather than silently
  widening results.
- Keeping client-side narrowing on top preserves search over
  hydrated/display-only columns (customer names, joined labels) that have
  no backing column to query.

## Consequences

- Every new list endpoint should declare its `dateField`, `sortable` map,
  and `search` fields when calling `parseListQuery`; endpoints without it
  keep working but return unfiltered collections.
- Search only covers scalar columns on the queried table; joined/hydrated
  display fields remain client-searchable only until richer filters are
  added.
- Raw-SQL endpoints (notifications) implement the same contract manually
  with parameterized fragments — keep them in sync if the contract grows.

## Alternatives considered

### Client-side only

Rejected: scales poorly and cannot search/sort values the client never
loaded.

### Full server pagination now

Deferred: `page[number]`/`page[size]` plus total counts changes the list
response shape; smaller step is to ship sort/filter first and paginate when
collection sizes demand it.
