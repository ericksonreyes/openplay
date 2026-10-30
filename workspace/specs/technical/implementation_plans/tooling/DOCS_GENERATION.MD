# Docs generation implementation plan

Generated documentation visuals: every screenshot and recording in OpenPlay's guides comes from a Playwright capture script run against the running stack — never captured by hand. A visual that cannot be regenerated does not belong in a guide.

## Sources

- [ADR-0009](../../decisions/0009-docs-as-generated-artifacts.MD) — generated-artifacts decision
- [Test accounts](../../../testing/TEST_ACCOUNTS.MD) — the demo fixtures captures run against
- `user-guide` agent skill — the per-channel guide conventions this tooling feeds

## Deliverables

- **Capture scripts** at `scripts/screenshots/<channel>/<flow>.spec.ts` for the four channels: `public`, `player`, `venue`, `platform`. They drive the same Playwright dependency and running stack as E2E.
- **Output layout**: generated images under `workspace/docs/screenshots/<channel>/`; per-channel guides under `workspace/docs/guides/` alongside the existing `workspace/docs/` index.
- **Capture discipline**: scripts run real flows against seeded demo fixtures — real data, never production-like PII. Each flow captures states, not just the happy path: empty, validation error, loading, success. Player-facing flows capture at a mobile viewport — the product is mobile-first.
- **Video**: Playwright `recordVideo` output converted with `ffmpeg` for guide embedding.
- **Regeneration command**: one entry point re-runs all captures; regenerated images land deterministically at the documented paths so image links check clean like any other relative link.
- **Change discipline**: when a user-facing flow changes, the capture spec, regenerated screenshots, and the channel guide update in the same change.

## Dependencies

- [End-to-end testing](END_TO_END_TESTING.MD) — the Playwright harness, isolated world, and demo fixtures it shares.
- Frontend plans as their surfaces land — there is nothing to capture before a UI exists.

## Acceptance checks

- Every image referenced in a guide regenerates from a capture script; re-running produces deterministic output at the same path.
- A capture failure fails the run — a broken flow surfaces as a broken build, not stale imagery.
- All guide image paths pass the link check.
- Captured content contains only demo data.

## Open decisions

- Guide structure per channel as content grows — owned by the `user-guide` skill conventions.
- Whether capture sets eventually run in CI on a schedule.
