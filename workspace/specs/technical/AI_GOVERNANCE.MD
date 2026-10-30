# AI Governance

Rules that govern the AI assistant wherever it appears in OpenPlay. These are architectural invariants, not suggestions — they apply to the assistant module and to any future AI feature. Product behavior (what the assistant helps with) lives in [AI_ASSISTANT](../domain/specifications/AI_ASSISTANT.MD); this document owns the constraints.

## Authority boundary

- The model gets a small whitelist of tools. Every tool wraps a permission-checked domain service — the same services the API uses.
- Never give the model generic primitives: no SQL, no arbitrary HTTP, no file or code execution, no direct datastore access.
- AI proposes, the domain disposes. Deterministic rules — pricing, conflicts, capacity, policy — run in backend domain services. Assistant output is at most an unsaved prefill a human reviews and submits.
- The assistant must never: create or modify bookings, capture or verify payments, approve or issue refunds, change settings or roles, search or browse the internet, or make any business decision.
- Model output is untrusted data. It must never become instructions, system prompt text, tool names, or code.

## Human in the loop

- The submit step is the human checkpoint. Everything the assistant produces is unsaved until a person reviews and acts — a prefill is a suggestion, not a decision.
- Human-in-the-loop applies to *actions*, not answers. The assistant replies conversationally on its own; it may never take or trigger a state-changing action. There are no "auto-approve" paths and no silent write tools.
- AI-derived input that lands in a record keeps its provenance — a prefilled form submitted by a user is audited as that user's action, and the audit metadata may note the assistant prefill.
- Staff-facing suggestions stay suggestions: anything the assistant flags or proposes for a venue shows as a recommendation a person accepts or dismisses.

## Identity and tenancy

- Tool calls execute under the caller's own identity — the caller's JWT claims (tenant, role, venue scope) propagate to every tool. There is no elevated "AI identity" for user-facing calls.
- Background or asynchronous AI work uses a service identity plus an on-behalf-of user ID. Live JWTs never appear in events or queues.
- Row-level security is the backstop: even a jailbroken model cannot read across tenants, because its tool calls carry the caller's verified context down to PostgreSQL.

## Prompt-injection defense

- Treat all user-supplied content — chat messages, uploaded documents, business descriptions the assistant renders — as potentially hostile input.
- Secrets never enter the model context: BYOK provider keys, JWTs, payment credentials, and any field the caller could not themselves read.
- Limit the blast radius. Read-only tools mean the worst case is showing the caller data they are already authorized to see — never writes, never cross-tenant reads.
- E2E coverage includes adversarial inputs: jailbreak attempts, injected instructions in venue text, and requests for out-of-scope actions must all be refused or absorbed harmlessly.

## Grounding — no internet answers

- The assistant has no web-search or browsing tool, by design — not merely disabled. Internet content is both untrusted input and unverifiable output, so it never enters the request path.
- Domain questions must be grounded in tool results. If no tool can answer, the assistant says so instead of recalling from training data.
- Hosted models carry memorized public knowledge. Treat it as unverified: the assistant never presents recalled facts about venues, prices, policies, schedules, or rules as authoritative — those come from tools or not at all.
- General small talk is allowed, but replies that touch venue policy, law, health, or safety defer to authoritative sources rather than answering from memory.

## Data protection

- Send external providers the minimum needed for the request. BYOK keys are write-only, AES-256-GCM encrypted, ciphertext-only in PostgreSQL, and never appear in responses, chat, logs, or audit payloads.
- Prefer providers whose terms exclude training on submitted data; local Ollama avoids the question entirely.
- AI endpoints get their own throttle bucket — like the public API — plus per-tenant token budgets so one business cannot exhaust shared capacity.
- Chat history is session-only: conversations live for the browser session and are never persisted. There is no chat-history table and no retention clock — the transcript is gone when the session ends.

## Token optimization

- Send only what the turn needs: recent conversation turns plus a rolling summary, not the full history. Summarize when a conversation crosses the threshold.
- Compact tool results: bounded payloads, paged lists, and entity references over full blobs — a tool that returns 50 reservations returns a page and a count, not 50 rows.
- Cache stable context. Business profile, venue, and policy data attached to the system context changes rarely — load it once per conversation, not per turn.
- Route by task size within the approved allowlist: a small model answers availability and profile questions; a larger one is reserved for multi-step reasoning. Never send a simple query to the most expensive model by default.
- Prefer structured tool output the model can quote over prose the model must re-parse.
- Cap the tool-call loop. A single user message may trigger at most **3 model→tool rounds**; when the cap is reached the assistant answers with what it has or says it could not complete the lookup. There is no unbounded agentic loop — no "keep working until done" continuation.
- Deduplicate tool calls: the same tool with the same arguments within one turn returns the cached result instead of a second call, and repeated identical calls count toward the loop cap.
- Stop conditions are mandatory, not model-discretion: max rounds, max tokens, or a finished answer — whichever comes first. A model that never emits a final response is terminated at the cap.
- Token budgets are enforced per tenant (see Data protection) — budgets and model routing are the two levers that keep Ollama resource use and BYOK spend predictable.
- Count tokens and cap responses: a reply budget of roughly **2,000 tokens per turn** plus a per-tenant monthly token budget (tenant-configurable) prevents a runaway generation from consuming the tenant's allowance.

## Provider failures and fallback

- Detection is explicit, not inferred. The assistant module exposes a lightweight `GET /assistant/status` readiness probe — cached for a short window so it never hammers the provider — that reports `available`, `unavailable`, and the failure kind. Frontends check status before enabling the assistant, so users learn about an outage before typing, not after.
- Provider adapters map errors to typed failures — auth/declined key, rate limit, provider down — rather than leaking raw HTTP errors. A refused connection to Ollama and a `401`/`402` from a hosted provider are different problems and must stay distinguishable.
- Classify the failure before reacting. An invalid, expired, or out-of-credit key is a persistent failure; a rate limit, timeout, or provider outage is transient.
- Persistent credential failures surface to the Business Owner and venue managers — an "assistant unavailable: check your AI provider key" notice — because a dead key is the owner's problem to fix, not a silent outage for their users. End users see only the generic unavailable state.
- Notify once per failure episode, never per failed request. The notice is deduplicated by (business, provider, failure kind): the first detection sends it, subsequent identical failures are suppressed until availability recovers, and a later recurrence may notify again. A recovery notice may close the episode.
- Transient failures degrade to temporarily unavailable with exponential backoff and a circuit breaker — a single `429` or timeout notifies nobody. Only when a transient failure crosses a sustained-outage threshold does it produce the same once-per-episode notice.
- Fallback is opt-in and ordered. A Business Owner may configure a fallback provider (for example external → Ollama); failover happens only through that explicit configuration, never silently — falling back changes who pays and where the tenant's data is processed.
- The terminal fallback is always the classic manual form. When every configured provider is unavailable, users book normally — the assistant is additive, and its total absence blocks nothing.
- In multi-tenant installations, the platform never subsidizes a tenant's dead key with platform-paid provider capacity. Assistant failure never affects the rest of the platform.

## UX discipline

- Grounded or silent: availability, prices, schedules, and statuses always come from a tool call, never from model memory. Responses reference the underlying entities they describe.
- A prefill renders as a form the human submits — never as a completed action.
- Graceful degradation: a stopped Ollama, an invalid BYOK key, or a provider outage produces a clear "assistant unavailable" state. The rest of the platform is unaffected, and the assistant can be disabled per business.
- Never a dead end. Because the assistant only ever produces an unsaved prefill of the standard forms, the fallback when it is unavailable is the classic manual flow — the portal swaps the assistant panel for the regular booking form ("book manually below"). Assistant loss must never block a booking the user could have completed without it.

## Evaluation and operations

- Evals run in CI against the stub provider: a golden question/answer set, tool-selection accuracy, and refusal cases for out-of-scope requests.
- An approved allowlist governs which Ollama models a business may pick. BYOK tenants may use any provider and model reachable with their own credentials — their key, their spend, their quality risk.
- Tool calls and prefill events write `audit_events` on the user's streams. Message bodies and secret values are never logged.
- Prompt and model changes are versioned, reviewable changes — the same audit trail rules apply.

## Open decisions

- The Ollama allowlist contents — which specific models businesses may pick.
- Default per-tenant monthly token budget and throttle numbers.
- Whether a configured failover produces a notification, and to whom.

## Related specifications

- [AI Assistant](../domain/specifications/AI_ASSISTANT.MD) — product scope and capabilities
- [ADR-0006](decisions/0006-ai-assistant-runtime.MD) — assistant runtime, providers, BYOK encryption
- [ADR-0008](decisions/0008-e2e-testing-with-playwright.MD) — deterministic provider stubs for testing
- [Identity & Access](security/IDENTITY_AND_ACCESS.MD) — claims and scope propagation
- [Internal Service Security](security/INTERNAL_SERVICE_SECURITY.MD) — credential and data-minimization rules
- [Audit Logging](security/AUDIT_LOGGING.MD) — event-stream model for AI action records
