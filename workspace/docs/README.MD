# OpenPlay Documentation

User-facing guides and generated visuals for the OpenPlay channels.

## Generated artifacts

Screenshots and recordings in `screenshots/` are **generated artifacts** produced by Playwright capture scripts under `scripts/screenshots/<channel>/` — never captured by hand. Regenerate them on UI change; a visual that cannot be regenerated does not belong in a guide. See [ADR-0009](../specs/technical/decisions/0009-docs-as-generated-artifacts.MD).

## Layout

```text
workspace/docs/screenshots/<channel>/<step>.png   — generated images (committed)
workspace/docs/guides/<channel>.MD                — per-channel user guide
```

Channels: `public` (public site), `player`, `venue`, `platform`.

## Guides

Guides are created when the first frontend lands. Each guide embeds the generated screenshots for its channel — one action per step, screenshot after the action's result.
