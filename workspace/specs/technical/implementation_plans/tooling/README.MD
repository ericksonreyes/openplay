# Tooling — Implementation Plans

Cross-service work that no single service owns: the local development stack, browser end-to-end testing, and generated documentation visuals.

## Plans

- [Local development](LOCAL_DEVELOPMENT.MD) — the Docker stack: per-service Compose files, Dockerfiles, networks, installers ([ADR-0003](../../decisions/0003-docker-local-development.MD))
- [End-to-end testing](END_TO_END_TESTING.MD) — Playwright at the repo root against an isolated world ([ADR-0008](../../decisions/0008-e2e-testing-with-playwright.MD))
- [Docs generation](DOCS_GENERATION.MD) — Playwright capture scripts producing all guide visuals ([ADR-0009](../../decisions/0009-docs-as-generated-artifacts.MD))
