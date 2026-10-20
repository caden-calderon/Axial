# Axial autonomous improvement pass

Date: 2026-09-07

## Objective

Evolve the existing game across correctness, game feel, usability, polish, AI, and online resilience. Preserve its spatial gravity rules, restrained translucent table aesthetic, configurable Classic line objectives, local play, and existing public APIs. Unity remains preserved.

## Starting state and branch decision

The main checkout was clean at `fb4c445`. The user identified recently committed work on `codex/classic-ai-mobile-overhaul`: `b3276d3` and `1bff1e8`, both descendants of main. Review found a coherent substantial AI upgrade and intentional portrait UI refinements. This pass starts on `codex/axial-improvement-pass` at `1bff1e8`; both original branches remain intact.

## Current architecture

- Pure `@axial/core` implements column gravity, 13 undirected spatial line directions, maximal-run scoring, variable board dimensions, replay and Tactical internals.
- Svelte rune controllers own local/AI and online state separately. Classic search runs in a cancellable Worker; difficulty presets specify actual reasoning budgets.
- Threlte renders grid, preview, pieces, line markers and camera; input is a plane raycast plus keyboard navigation.
- Cloudflare Worker / Durable Object owns private online rooms, legal state transitions, presence, snapshots, reconnect and rematches.
- Existing onboarding, theme/piece settings, persistence, undo/replay and result dialogs are retained. Tactical remains intentionally unavailable in setup on the imported branch.

## Decisions

### Locked

- Preserve user work; no resets, force pushes, destructive cleanup or deployment.
- Keep hidden turn/status information while phone controls are collapsed (existing explicit product decision).
- Preserve portrait top-sheet geometry and stable reset/theme/menu control positions from imported work.
- Local/AI remain usable independently of online service availability.
- Test game logic and network races. Visually inspect each meaningful rendering/UI iteration.

### Preferred implementation lanes

1. Harden multiplayer stale state, reconnect and duplicate-command behavior using the existing infrastructure.
2. Review and correct concrete AI search mistakes; retain the imported engine and existing strength gates.
3. Improve fall/impact staging, winning-line timing, reduced motion, restoration and scene task lifecycle.
4. Improve clarity of board selection, last moves, result review and contextual onboarding where live inspection demonstrates a need.
5. Add subtle optional procedural sound only if it supports placement/impact with a reliable mute and lifecycle.

### Alternatives considered

A new framework, AI replacement, multiplayer platform, generic component library or large visual redesign adds risk without evidence of benefit. Incremental state/scene changes offer stronger payoff. Permanent new game modes are lower priority than making Classic enjoyable and trustworthy.

## Validation

Baseline main passed before integration (unit suites: core 22, AI 39, web 63, Worker 11; browser suite: 13). Imported branch baselines were rechecked before lane changes. Complete check, lint, unit, build and production-preview E2E gates. Exercise desktop and phone, pointer and keyboard, rapid input, undo/reset, reload, reduced motion, dark/light, AI and two-client local online play. See context.md for final evidence. Real phone/PWA and public network deployment require external verification and will be stated accurately.

## Browser tooling

Cached Browser Use had no SKILL.md and no direct runtime exposed. Reported this before fallback. Current `mcp__cua_repl` successfully opens the Codex in-app browser and exposes browser inspection APIs. Use it for live UI; committed Playwright tests remain the automated regression suite.
