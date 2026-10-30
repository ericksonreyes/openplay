---
name: agentic-engineering
description: How to work inside the OpenPlay repo as an agent — governance, canonical doc sources, handoff discipline, spec-audit practice
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - write
  - exec
---

Operating rules for agentic work in this repository.

## Governance

- `AGENTS.md` is the documentation governance contract — canonical sources, vocabulary rules, link rules, review checklist. Follow it literally.
- One canonical file per topic. Never fork a spec into a second doc; edit the canonical one.
- `workspace/specs/GLOSSARY.MD` is the vocabulary source of truth — use canonical terms, don't introduce competing terminology casually.
- Use relative links; verify they resolve after edits (`test -f` from the linking file's directory).
- Handoffs live in `workspace/handoff/` (local-only, gitignored) in the format the `checkpoint` skill defines. Use `/checkpoint` to write one.

## Repo shape

- `services/` — empty except its README; five services planned per `SERVICE_MAP.md`: `public-site` (Next.js), `player-portal`/`venue-portal`/`platform-portal` (React), `backend` (NestJS + PostgreSQL). Each service owns its `docker-compose.yml` and `docker/*.Dockerfile` — there is no unified root Compose file (ADR-0003).
- `install.sh` (repo root) — the orchestrator; runs the backend installer first, then the four frontend installers. `.env.example` per service dir, Docker-network hostnames, never real secrets.
- `workspace/specs/technical/implementation_plans/` — per-service build plans; read them before scaffolding anything.

## Audit discipline

- `workspace/specs/AUDIT.MD` is the canonical audit log. New contradiction/orphan/risk findings go there first with evidence links and status; close items by fixing the referenced specs, not the audit text.

## Standing constraints (don't relitigate)

- AI never touches databases or makes domain decisions — see the `ai-agent-boundary` skill.
- Production deployment is out of scope; the Docker local stack is the POC target; optional Compose profiles (`notifications`, `ai`) keep heavy services out of the base stack.
- Everything in the repo is intentionally uncommitted until the user asks for a commit.
