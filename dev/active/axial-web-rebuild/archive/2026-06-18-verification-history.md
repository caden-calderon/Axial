# Verification History Archive

This file keeps old verification and smoke-test context out of the active `context.md` startup path.
The current source of truth for what to run is still `plan.md`, `tasks.md`, and
`next-session-prompt.md`.

## Archived Notes

- Browser plugin runtime discovery repeatedly did not expose the required Node execution tool during
  the June 2026 visual passes, so local Playwright fallback screenshots/smokes were used.
- The large Three.js/Threlte route chunk warning is known and accepted for now. The 2026-06-07
  cleanup removed the accidental `@threlte/extras` route import and normal-path `@axial/ai` page
  import, reducing the game route from roughly `993 kB` minified / `273 kB` gzip to the low/mid
  `800 kB` range minified and about `216-223 kB` gzip depending on later features.
- The cleanup pass split `GameStatusPanel.svelte` into focused section components:
  `PanelLiveStrip.svelte`, `MatchSettingsPanel.svelte`, `AppearancePanel.svelte`,
  `SessionRecordPanel.svelte`, and `TacticalLoadoutPanel.svelte`.
- Dynamic board dimensions landed across `@axial/core`, the web scene, labels, projected picking,
  completed-line markers, and `@axial/ai` search geometry.
- Historical local Playwright smokes covered desktop/mobile layout, Tactical Pieces mode, board-size
  controls, result modal, appearance controls, AI replies on larger boards, HUD glyph glow,
  confirm-drop behavior, floor-only grid mode, square confirm/last-move markers, axis-label toggle
  stability, and PWA icon metadata.
- Historical AI verification covered the fork-regression fixes, tactical lookahead/RAVE correction,
  multi-line scoring semantics, and worker-backed AI replies.

## Representative Historical Checks

- `pnpm check`
- `pnpm lint`
- `pnpm build`
- `pnpm test:unit`
- `pnpm --filter @axial/core test:unit`
- `pnpm --filter @axial/ai test:unit`
- `pnpm --filter @axial/web test:unit -- --run`
- `pnpm --filter @axial/web test:e2e`
- `pnpm smoke:production`

For exact old screenshot paths and one-off smoke details, use the git history before the 2026-06-18
hygiene pass.
