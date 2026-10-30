# AI assistant implementation plan

The optional `assistant` module inside `services/backend/` — read-only tools plus unsaved prefill, nothing more. Every invariant in [AI governance](../../AI_GOVERNANCE.MD) is a construction rule here, not a review afterthought.

## Sources

- [ADR-0006](../../decisions/0006-ai-assistant-runtime.MD) — assistant as a backend module, Ollama + BYOK
- [AI governance](../../AI_GOVERNANCE.MD) — the invariants: authority boundary, HITL, identity, injection defense, grounding, budgets, fallback
- [AI assistant](../../../domain/specifications/AI_ASSISTANT.MD) — product behavior, voice, question scope
- [Guest booking](../../../domain/specifications/GUEST_BOOKING.MD) — guest rules the assistant must respect
- [Internal service security](../../security/INTERNAL_SERVICE_SECURITY.MD) — BYOK key handling, data minimization

## Deliverables

- **Provider port and adapters**: an `ollama` npm-package adapter reaching `OLLAMA_HOST` (the `ai` Compose profile container, or `host.docker.internal:11434` for host-installed Ollama on macOS) plus hosted-provider adapters for BYOK. Adapters map errors to typed failures — auth/declined key, rate limit, provider down — never raw HTTP leaks.
- **Provider settings**: per-business provider selection, on/off, optional ordered fallback, monthly token budget. BYOK keys are write-only APIs encrypted with AES-256-GCM using the environment-held key; PostgreSQL holds ciphertext only; keys decrypt in-process at call time and never appear in responses, chat, logs, or audit payloads. Settings changes audit-log without the key.
- **Tool registry**: a small whitelist of thin adapters over the same permission-checked domain services the API uses — availability, events, the caller's own bookings, memberships, payment status, venue policy content. Tools execute under the caller's claims (tenant, role, venue assignments propagate; RLS is the backstop). Read-only tools plus one prefill tool returning an unsaved draft. Identical tool calls within a turn dedupe to a cached result.
- **Chat endpoint**: session-only conversations — no chat-history table, nothing persisted; the transcript dies with the session. The AI bucket gets its own throttle plus a per-tenant monthly token budget. Loop cap of 3 model→tool rounds per message and a ~2,000-token reply budget; stop conditions are mandatory, not model-discretion.
- **Grounding**: no web-search or browsing tool exists — by construction, not configuration. Answers quote tool results or decline; model-recalled facts about venues, prices, or policies are never presented as authoritative.
- **Status probe**: `GET /assistant/status`, short-cached, reporting available/unavailable and the failure kind, so frontends gate the panel before a user types.
- **Failure handling**: classify persistent (invalid/expired key) vs transient (rate limit, timeout, outage). Persistent failures notify owners and managers once per failure episode, deduplicated by (business, provider, kind); transient failures back off with a circuit breaker and notify only past the sustained-outage threshold. Ordered fallback only through explicit owner configuration; the terminal fallback is always the classic form.
- **Prefill contract**: returns a structured draft for the normal form; submission re-runs the standard booking flow with full revalidation. A prefill creates no reservation, hold, or claim.
- **Audit**: tool calls and prefill events append to the user's audit streams; message bodies and secrets never enter log fields. Prompt and model changes are versioned, reviewable changes.
- **Eval harness**: golden question/answer set, tool-selection accuracy, and refusal cases run against the stub provider.

## Dependencies

- [Foundation](FOUNDATION.MD), [Tenant data](TENANT_DATA.MD), [Identity & access](IDENTITY_AND_ACCESS.MD).
- [Venue catalog](VENUE_CATALOG.MD), [Booking](BOOKING.MD), [Events](EVENTS.MD), [Commerce](COMMERCE.MD), [Public content](PUBLIC_CONTENT.MD) — the domain services the tools wrap.
- [Notifications](NOTIFICATIONS.MD) — once-per-episode owner notices.

## Acceptance checks

- Tools run under caller scope: a player sees only their own rows; staff see assigned venues; the RLS backstop holds even against a jailbroken prompt.
- No write tools exist; a prefill creates no hold or record; submission revalidates like any booking.
- Disabled means zero provider calls; typed failures classify correctly; owner notices dedupe per episode; fallback only fires through explicit config.
- Secrets never reach the model context or plaintext storage; BYOK is write-only end to end.
- Loop, token, and budget caps enforce; restart loses the transcript; adversarial inputs are refused in stub-provider evals.

## Open decisions

- Ollama allowlist contents, default budget/throttle numbers, failover notification recipients, hosted-provider disclosure wording — [AI governance](../../AI_GOVERNANCE.MD).
- Initial-release inclusion and default toggle state, guest assistant access — [AI assistant](../../../domain/specifications/AI_ASSISTANT.MD).
