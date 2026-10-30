# Specification Audit

This file records consistency findings across OpenPlay specifications: contradictions, orphan links, and risks. New findings go here first with evidence links and a status. Resolve a finding by fixing the referenced specs — not by editing this log — then mark it resolved.

## Findings

| ID | Status | Finding | Evidence | Resolution |
|---|---|---|---|---|
| AUD-0002 | Resolved | `technical/user_experience/README.MD` linked `../infrastructure/README.MD`, which does not exist, and used the inherited product name "ServIQ". | `workspace/specs/technical/user_experience/README.MD` | Retargeted the link to [ADR-0003](technical/decisions/0003-docker-local-development.MD) and corrected the product name to OpenPlay. |
| AUD-0003 | Resolved | Agent skills described a different (inherited) architecture: Laravel context backends, Express BFFs, a FastAPI ai-agent, a unified `services/docker-compose.yml`, `domain/specs/DOMAIN_BOUNDARIES.md`, and `technical/SERVICE_STACKS.MD` — none of which exist in OpenPlay. | `.devin/skills/software-engineering/SKILL.md`, `local-dev/SKILL.md`, `new-service/SKILL.md`, `agentic-engineering/SKILL.md`, `api-security/SKILL.md` | Rewrote all five skills to the NestJS modular-monolith conventions: per-service Compose files, implementation plans, RLS + audit stream, correct issuer/audience values, and the real test runners. |
| AUD-0004 | Resolved | `AGENTS.md`, the `checkpoint` skill, and the `restore` skill referenced `workspace/handoff/README.MD` for the handoff format, but the file does not exist and the folder is gitignored so it could never resolve. | `AGENTS.md`, `.devin/skills/checkpoint/SKILL.md`, `.devin/skills/restore/SKILL.md`, `.gitignore` | Made the `checkpoint` skill the canonical format definition and retargeted all three references to it. |
