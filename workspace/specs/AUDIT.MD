# Specification Audit

This file records consistency findings across OpenPlay specifications: contradictions, orphan links, and risks. New findings go here first with evidence links and a status. Resolve a finding by fixing the referenced specs — not by editing this log — then mark it resolved.

## Findings

| ID | Status | Finding | Evidence | Resolution |
|---|---|---|---|---|
| AUD-0002 | Resolved | `technical/user_experience/README.MD` linked `../infrastructure/README.MD`, which does not exist, and used the inherited product name "ServIQ". | `workspace/specs/technical/user_experience/README.MD` | Retargeted the link to [ADR-0003](technical/decisions/0003-docker-local-development.MD) and corrected the product name to OpenPlay. |
