# ADR-0011: Use JSON:API for Backend Request and Response Envelopes

## Status

Accepted

## Context

The backend serves four frontends plus anonymous public traffic through one API surface ([ADR-0004](0004-nestjs-backend-api.MD)). Without a shared envelope, each module would invent its own response shape, error fields, and media type, and every client would reimplement parsing per endpoint. The backend foundation plan calls for a typed error response carrying `code`, `message`, and `request_id`; the format itself was undecided.

## Decision

All backend API requests and responses use the JSON:API structure with the `application/vnd.api+json` media type.

- Successful responses wrap the payload as `{ "data": ... }`. Domain endpoints serialize records as JSON:API resource objects (`type`, `id`, `attributes`); the public `id` follows [Identifiers](../IDENTIFIERS.MD) — UUIDv7 for entities, SQID for transactional records.
- Errors return a JSON:API error document: `{ "errors": [{ "status", "code", "title", "detail", "meta": { "request_id" } }] }`. `code` is a stable machine token (for example `NOT_FOUND`, `UNAUTHENTICATED`, `RATE_LIMITED`); `title`/`detail` are human-readable; `request_id` always rides in `meta` and matches the `x-request-id` response header.
- Existence-checking errors are indistinguishable: a record that is missing and a record hidden by tenant scope both return the same `404 NOT_FOUND` error.
- An undecodable SQID or malformed UUID in a request path is a `404`, per the identifier policy.
- The envelope is enforced globally in `services/backend`: a response interceptor wraps `{ data }`, a global exception filter emits error documents, and a terminal handler gives unmatched routes the same error shape.
- Health endpoints (`/health`, `/health/ready`) are infrastructure checks, not API resources; they are exempt from the `/api/v1` prefix but still emit the same envelope.
- Frontends send and expect `application/vnd.api+json` for API traffic.

## Reasons

- One documented wire format removes per-module drift and gives frontends a single parser and error contract.
- JSON:API error objects carry the required `code`, human-readable `detail`, and `request_id` in `meta` without inventing a bespoke schema.
- The resource-object convention (`type` + `id`) composes cleanly with the identifier policy and future relationship links between modules.
- Global enforcement in the pipeline (interceptor, filter, terminal handler) means modules cannot accidentally bypass the envelope.

## Consequences

- Every controller returning data passes through the global envelope; raw Express responses must not be used for API payloads.
- Domain modules ship a serializer per resource mapping internal fields to `type`/`id`/`attributes`; field allowlists for public endpoints (per the security model) apply inside serializers.
- Error handling code throws typed exceptions; mapping to `errors[]` entries happens only in the filter so `code` values stay stable.
- Clients must handle `application/vnd.api+json` and read `errors[0].code` for machine decisions, never `detail`.
- OpenAPI/documentation artifacts should describe the envelope once and reference it from each endpoint.

## Alternatives considered

### Custom flat envelope (`{ code, message, request_id }`)

Simpler but non-standard; each client and document would redefine it, and it has no story for resource identity or relationships. JSON:API provides both while staying conventional.

### No envelope (bare domain payloads)

Least overhead but loses `request_id` propagation, a stable error `code` contract, and non-revealing-error guarantees would depend on per-endpoint discipline.
