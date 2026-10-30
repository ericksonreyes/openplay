---
name: ai-agent-boundary
description: OpenPlay AI Assistant constraints — read-only tools, caller-identity propagation, BYOK providers, injection defenses
allowed-tools:
  - read
  - grep
  - glob
---

Hard boundary rules for anything touching the AI assistant. These are architectural invariants, not suggestions.

## Canonical sources

- `workspace/specs/technical/AI_GOVERNANCE.MD` — the governance invariants (authority boundary, identity, injection defense, data protection, UX, evals)
- `workspace/specs/domain/specifications/AI_ASSISTANT.MD` — product scope, per-business enablement, provider choice
- `workspace/specs/technical/decisions/0006-ai-assistant-runtime.MD` — NestJS module, Ollama + hosted BYOK providers, AES-256-GCM key encryption
- `workspace/specs/technical/decisions/0008-e2e-testing-with-playwright.MD` — deterministic provider stubs for tests

## The boundary

The assistant may ONLY: answer questions grounded in tool results and prefill unsaved forms for a human to review and submit.

It must NEVER: create or modify bookings, capture or verify payments, approve or issue refunds, change settings or roles, mutate domain state, generate SQL, access databases directly, search or browse the internet, or make business decisions.

## Mechanics

- **No database access, ever.** Tools wrap permission-checked domain services — the same services the API uses.
- **Caller identity propagation:** synchronous tool calls run under the caller's JWT claims (tenant, role, venue scope); there is no elevated AI identity. Async work uses a service identity + on-behalf-of user ID — never forward live JWTs through queues or events.
- **AI proposes, the domain disposes:** pricing, conflicts, capacity, and policy are enforced by domain services at submit time, not by the model.
- **Injection posture:** user chat, uploads, and rendered venue content are untrusted; secrets (BYOK keys, JWTs, payment credentials) never enter the context. Read-only tools bound the worst case to data the caller can already see.
- **Grounding:** answers about OpenPlay data come from tool results only — never model memory or the open web. If no tool can answer, the assistant says so.
- **Human in the loop:** the submit step belongs to a person; every assistant output is unsaved until then. HITL governs actions, not conversational replies.
- **Token budget:** send recent turns + a rolling summary, not full history; compact tool results (paged, referenced); route simple queries to small models; per-tenant budgets cap spend.
- **Loop cap:** a fixed max of model→tool rounds per user message, deduplicated identical calls, mandatory stop conditions — no unbounded agentic loops.
- **Degradation:** a down/invalid provider surfaces via a `/assistant/status` probe as typed failures (auth, rate-limit, down); frontends fall back to the classic form — the assistant is additive, never a brick wall.
- **Notify once:** persistent failures notify the Business Owner/venue managers once per failure episode — deduplicated, suppressed until recovery — never one notification per failed request.

## Providers

- Provider choice is per business: installation-configured Ollama model, or an external hosted provider with Business Owner BYOK credentials.
- BYOK keys are write-only, encrypted with AES-256-GCM before PostgreSQL storage — the database holds ciphertext only. Keys never appear in responses, chat, logs, or audit payloads.
- Local Ollama runs behind the `ai` Compose profile on the private `backend_data` network — no host port. macOS: host-installed Ollama via `host.docker.internal:11434` for Apple Silicon.
- The backend uses the official `ollama` npm package inside the assistant module; tools live under `assistant/tools/`.
