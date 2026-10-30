# ADR-0006: Run the AI Assistant as a NestJS Module with Ollama Support

## Status

Accepted

## Context

OpenPlay's optional AI assistant answers read-only questions and prefills unsaved booking forms. It must use permission-checked application APIs, never access the database directly, and never write business data. The Business Owner selects a provider per installation: an Ollama-hosted model or a hosted LLM API. See [AI Assistant](../../domain/specifications/AI_ASSISTANT.MD).

A separate AI service (the earlier Python/FastAPI assumption) would add a second language runtime, JWT propagation, and its own deployment for an assistant the spec keeps deliberately small.

## Decision

Run the assistant as a module inside the NestJS backend — no separate AI service.

- The assistant lives in the backend codebase (for example `assistant/`). Model calls use the official `ollama` npm package; LangChain.js is an option if tool-calling chains later justify it. There is no Python dependency.
- AI "tools" are thin adapters in the backend over the same permission-checked domain services the API uses. Each tool executes with the caller's identity, tenant, roles, permissions, and venue assignments — a player's tools can only return that player's records, and RLS remains the backstop.
- Tools are read-only plus draft prefill only. There are no write, payment-verification, refund, or approval tools; prefill returns a draft to the frontend and submission goes through the normal booking flow.
- Ollama runs as backend-owned infrastructure behind an `ai` Compose profile in `services/backend/docker-compose.yml`, on the private `backend_data` network with no public route, using a named volume for model data. Models are pulled with `docker compose exec ollama ollama pull <model>`.
- On macOS, a host-installed Ollama is the recommended local option because containers cannot use Metal/GPU acceleration; containers reach it through `host.docker.internal:11434`.
- Hosted providers remain a per-business configurable alternative and are bring-your-own-key: the Business Owner supplies the provider's API key. Keys are stored as ciphertext in PostgreSQL — the backend encrypts each key with AES-256-GCM using an environment-held encryption key before writing, so the database never holds plaintext. Keys are decrypted only inside the backend process at the moment of a provider call, are write-only in the UI, and never appear in responses, logs, or audit fields; only the minimum permitted data is sent to the provider.
- The assistant module follows the on/off controls in the AI Assistant spec; when disabled it makes no provider calls.

## Reasons

- One language and one runtime — no Python service, JWT propagation, or extra deployment for a read-only assistant.
- "Permission-checked application APIs" is satisfied by construction: tools call the same domain services as the API, under the caller's own scope.
- Ollama behind a Compose profile keeps the model optional — the base local stack runs without it, and hosted providers work with no model container at all.

## Consequences

- Generation latency shares the backend API process; heavy load may justify splitting later.
- CPU-only containers make larger local models slow — hence the host-installed path on macOS.
- Approved model lists, model image pinning, key-rotation procedure, and voice transcription providers remain open decisions in the spec. A managed KMS with envelope encryption can replace the environment-held key later without changing the storage shape.
- If the assistant later needs heavy pipelines or Python-only libraries, it can split into `services/ai-agent/` — a FastAPI service calling the backend API with the caller's JWT, per the same data-access rules.

## Alternatives considered

### Separate FastAPI + LangChain service

The earlier scaffolding assumption. It suits complex agent and RAG pipelines but doubles the stack for the current spec. Deferred, not rejected.

### Hosted providers only

Removes local model infrastructure, but loses the offline/private-data option the spec requires. Not selected.

### Client-side model in the browser

Puts the model and prompts outside server-side scoping and cannot enforce per-business provider settings. Not selected.
