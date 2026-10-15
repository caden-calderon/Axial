# Axial Web

Axial is a browser-native 3D gravity strategy game built with SvelteKit, TypeScript, Three.js and Threlte. [Play the game](https://playaxial.dev), or see the [project overview](../README.md). This directory contains the active application; the original Unity project is preserved separately and is not included in a Git clone.

## Run locally

Use Node 24.13.0 (see `.node-version`) and pnpm 10.32.1 (see `package.json`). From this directory:

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Open the URL printed by Vite. Local and AI play need no backend or accounts. In a second terminal, run the existing room service to test Online locally:

```sh
pnpm --filter @axial/multiplayer-worker dev --ip 127.0.0.1 --port 8787 --var PUBLIC_WEB_ORIGIN:http://127.0.0.1:5173
```

The frontend uses port `8787` for the room service on localhost. The command-line origin override makes local invite links point at the dev server; adjust it if Vite selects another port. `PUBLIC_AXIAL_MULTIPLAYER_API` optionally overrides the room endpoint; production defaults to the frontend's own origin. Production deployment configuration and environment requirements are in [deployment.md](../dev/active/axial-web-rebuild/deployment.md).

## Playing

- Choose a floor square to drop a piece into its column. Pieces stack from the bottom.
- Connect four of your pieces in a straight line across, up, or diagonally through the board. All 13 spatial directions count.
- Before the first move, choose Connect 4 or 5, a board size, and one, two or three lines needed to win. A longer extension of one straight run remains one scored line; crossing lines count separately.
- Drag to orbit and scroll/pinch to zoom. Reset view restores the initial angle. Keyboard: arrows select a column, Enter/Space place or confirm, Escape clears the selection. Holding Enter cannot place repeated turns.
- Confirm drop provides a staged preview; it is the default for new touch users. Moving the keyboard cursor clears an older staged selection.
- Players are distinguished by their piece colors. Grid layers can be enabled to inspect height.
- How to play includes a safe preview exercise. Sound is optional, off by default, and can be enabled or muted in Appearance. Motion follows the operating system preference.
- Settings overlay the board without moving or rescaling it. Multi-line scores live within the Match section; result screens preserve new-match, review and keep-board actions.
- Local and AI matches persist on refresh. Undo/redo and review preserve canonical move histories. Rematches alternate the opening player; the human opens a new AI series.

Tactical rules and special-piece code remain preserved internally, but Tactical is intentionally marked Coming soon in setup.

## Architecture

| Location                        | Responsibility                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`                 | Canonical gravity, integer coordinate validation, maximal-line scoring, configurable rules, replay and Tactical internals |
| `packages/ai`                   | Classic hybrid search: bounded alpha-beta lookahead, threat evaluation, MCTS and shared difficulty presets                |
| `packages/multiplayer-protocol` | Shared command, event and snapshot types                                                                                  |
| `apps/web/src/lib/game/state`   | Local/AI state, persistence, undo, worker cancellation and timeout recovery                                               |
| `apps/web/src/lib/game/scene`   | Threlte board, camera, picking, drop/impact staging and line rendering                                                    |
| `apps/web/src/lib/game/audio`   | Lazy, opt-in procedural Web Audio with cancellation and visibility handling                                               |
| `apps/web/src/lib/multiplayer`  | Room transport, reconnect, ordered snapshots, terminal recovery and action gating                                         |
| `apps/multiplayer-worker`       | Server-authoritative private rooms in Cloudflare Durable Objects                                                          |

The AI uses no LLM. Easy, Medium, Hard and Max have different tactical/search budgets. Heavy work stays in a cancellable Web Worker. Snapshots copy all completed-line data before crossing the worker boundary, so multi-line matches keep searching after a score. Failed searches pause with a retry action instead of silently substituting random moves. Max can spend multiple seconds on difficult positions or larger objectives. See [AI architecture and evaluation](../dev/active/axial-classic-ai-overhaul/context.md) and [current correctness fixes](../dev/active/axial-improvement-pass/ai.md). Machine challenge results are not a human strength rating.

Online rooms support invitation links/codes, readiness/countdown, reconnect and rematch. Accepted moves and scores come from the server. Stale revisions request a fresh snapshot without replaying a stale command; terminal room/authentication errors stop retries and disable gameplay while preserving the final board. See [multiplayer architecture](../dev/active/axial-web-rebuild/multiplayer.md) and [recovery tests](../dev/active/axial-improvement-pass/multiplayer.md).

Room creation has a Cloudflare limit of 10 attempts per minute per network address. Other room actions are outside that creation limit. Expired rooms retain their data for 24 hours, then an alarm removes it; old links subsequently report room not found. The limit is approximate and per Cloudflare location, and people on a shared network share the allowance. See the [room resource policy](../dev/active/axial-announcement-readiness/room-resource-policy.md) for behavior, legacy cleanup limits and validation.

## Verification

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
```

`pnpm test` runs the unit tests, includes the production-preview Playwright suite, and starts the local room service. The browser suite installs Chromium and uses ports 4173 (preview) and 8787 (room service). Use a Linux environment with Chromium's system dependencies available. Avoid unrelated servers on those ports: outside CI, Playwright can reuse an existing server.

Browser tests cover desktop/phone controls, onboarding, iframe embedding, AI lifecycle and two-player Online play. The game-feel suite uses Three's existing devtools observation hook inside test pages to inspect actual rendered motion and camera state; no test globals are shipped by the app.

For a focused run:

```sh
# Run unit tests once across the workspace.
CI=1 pnpm test:unit

# Run only the production-preview browser suite.
pnpm --filter @axial/web test:e2e
```

The web package's unit-test command enters watch mode interactively; `CI=1` makes the workspace command exit after one run. `pnpm test` already runs web unit tests once before the browser suite.

Optional AI evaluations:

```sh
pnpm --filter @axial/ai eval:challenges
pnpm --filter @axial/ai eval:challenge:full
pnpm --filter @axial/ai eval:rules
pnpm --filter @axial/ai eval:strength:hard
```

Longer tournaments and full variant evaluations are opt-in. `pnpm smoke:production` contacts the deployed site; use local tests when working on unshipped changes.
