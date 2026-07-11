# Axial UI Pass Context

Status: implementation and first post-release correctness follow-up complete; awaiting real-device PWA smoke.

Date: 2026-07-10

## Mission

Perform a second-generation UI/UX pass across desktop and mobile while preserving Axial's current gameplay, server authority, visual identity, and recent onboarding/online polish.

## Current Product State

- Active app: `axial-web/apps/web`.
- Stack: SvelteKit, Svelte 5, TypeScript, Tailwind 4, Three.js, Threlte, pnpm.
- Main route: full-viewport 3D board with top-left brand, desktop top-center turn pill, and collapsible top-right control panel.
- Existing modes: Local, AI, Online; Classic and Tactical rules.
- Existing polish: welcome tour, staged-drop option, undo/redo, piece appearance, board color, completed-line animation, result overlays, PWA metadata, active-match persistence, scene recovery, and server-authoritative private Online rooms.

## Audit Result

The current dark desktop experience is already visually strong. This lane should not reset the aesthetic. The main gaps are responsive product behavior, mobile ergonomics, input clarity, modal accessibility, light-mode depth, and context-aware information architecture.

## Verified Evidence

- Source review included the main route, global game CSS, HUD, setup, appearance, Online, Tactical, welcome-tour, result-overlay, scene, camera, picker, state, and Playwright surfaces.
- Live viewport review covered 1673 x 1261, 1366 x 768, 1024 x 768, 390 x 844, 375 x 667, 320 x 568, and 844 x 390.
- Mobile collapsed state hides the turn pill.
- Coarse-pointer toolbar controls measure 32 x 32 CSS pixels.
- At 390 x 844, 33 visible interactive elements were below 44px in at least one dimension.
- Online text fields compute to 12.16px on mobile.
- The 320px brand and collapsed panel overlap.
- Landscape uses the same compact camera constants as portrait and leaves the board undersized.
- Short desktop viewports require panel scrolling, but the scrollbar is hidden.
- Tour keyboard traversal reaches background toolbar controls and escapes after the last tour button.
- Lighthouse mobile accessibility: 94; failures are the two invalid `aria-label` uses in `GameHud.svelte`.
- Impeccable deterministic scan: zero findings.
- Development-only performance trace: LCP 2.12s, CLS 0; production measurement still required.

## Planning Artifacts

- `PRODUCT.md`: product register and strategic design principles.
- `dev/active/axial-ui-pass/plan.md`: proposed architecture, milestones, and acceptance criteria.
- `dev/active/axial-ui-pass/tasks.md`: implementation checklist, all still unchecked.
- `.impeccable/live/config.json`: local UI-iteration configuration; no application source injection was made.

## Constraints

- Preserve the intentional absence of turn/status information while mobile controls are collapsed.
- Preserve current uncommitted work; the tree was clean before this planning lane.
- Keep the board as the visual priority.
- Preserve Worker/Durable Object authority and current Online timing contracts.
- Preserve Local, AI, Tactical, replay, recovery, persistence, PWA, and bridge behavior.
- Respect reduced motion and do not gate content visibility on animation completion.

## Browser Note

The in-app Browser plugin could not connect because its browser client was untrusted and the native bridge was unavailable. Live QA used the fallback Chrome DevTools/Chromium surface after reporting that failure. The app itself loaded and rendered normally.

## Approval

Caden approved the full pass on 2026-07-09 with one override: hiding turn/status while mobile controls are collapsed is intentional because screen space is constrained. Do not add a persistent mobile status bar. A contextual confirm/cancel surface may appear only while a staged touch move is armed.

## Implemented

- Responsive safe-area/dynamic-viewport shell with a portrait bottom sheet, coarse-landscape rail, and desktop rail.
- Tested camera fitting across portrait, landscape, desktop, expanded controls, and oversized boards.
- 44px coarse-pointer controls, 16px mobile Online inputs, visible panel scrollbar, 320px collision fix, and partial/full sheet states.
- New coarse-pointer staged-drop default that preserves saved preferences; contextual row/column/layer confirm and cancel UI appears only while armed.
- Keyboard board navigation with announced landing layer, invalid/full columns, Enter/Space selection, and Escape cancellation.
- Native shared dialog shell with focus containment/restoration for the tour and result overlays; Online countdown is a non-interactive announced status.
- Replayable How to Play flow with a safe orbit/zoom/drop practice interlude that never mutates match state.
- State-driven Online promotion, live match/rules summary, and condensed locked piece summary.
- Light-scene depth retune, first-load/turn-change shine, reduced-motion coverage, close-color warning, and one-band P1/two-band P2 markings.
- Reset View action and lazy QR encoder loading.
- Local Worker CORS now includes the production-preview port `4173`; generated Worker bindings were refreshed.

## Verification

- `pnpm check`: pass, zero Svelte errors/warnings.
- `pnpm lint`: pass.
- `pnpm --filter @axial/web test:unit -- --run`: 11 files, 58 tests pass.
- `pnpm build`: pass.
- `pnpm --filter @axial/web exec playwright test`: 12 tests pass, including the two-context Worker flow.
- `pnpm deploy:multiplayer:dry-run`: pass.
- `pnpm --dir apps/multiplayer-worker exec wrangler types --check`: pass.
- `git diff --check`: pass.
- Mobile Lighthouse on the local app: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 100.
- Live visual matrix rechecked at 1440x900, 390x844, 320x568, and 844x390 plus expanded/collapsed, tutorial/practice/confirm, dark/light, and active-match states.

## 2026-07-10 Follow-up

- Optically aligned the AXIAL wordmark's visible left edge with the first board-dimension digit, preserving the larger wordmark scale across responsive layouts and locking both behaviors with Playwright geometry assertions.
- Scoped opener alternation to a continuous AI series. The user always opens the first AI match after initial load or after returning from Local/Online; rematches continue alternating while AI mode remains active.
- Added an explicit AI-series exit when entering Online, including URL-driven Online entry, so background AI work is cancelled and returning to AI resets the opener.
- Hardened AI worker recovery: undo/reset/mode changes invalidate and terminate pending work, timed-out workers are recycled, and the controller falls back to a legal inexpensive move instead of leaving a turn stuck.
- Added regression coverage for worker timeout, cancel/retry, AI-series resets through Local and Online, stale AI work after undo, and rapid mode transitions.
- Follow-up verification: `pnpm check`, `pnpm lint`, and `pnpm build` pass; workspace unit suites pass (63 web, 39 AI, 22 core, 11 Worker); the full Playwright matrix passes (13/13).

## Remaining External QA

- Smoke the installed PWA on a physical notched phone in portrait and landscape.
- Verify background/resume and an Online reconnect on the physical device.
- A production route trace and graphics-quality presets remain deliberately deferred; the current data justified lazy QR loading, not another user-facing quality control.
- The original UI pass was committed and pushed as `f90f433`; this follow-up remains local pending review.
