# Next Session Prompt

We are continuing the Axial web rebuild in `/home/caden/projects/Axial`.

Start by reading:

- `/home/caden/projects/Axial/AGENTS.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/context.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/plan.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/tasks.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/deployment.md`
- `/home/caden/projects/Axial/dev/active/axial-web-rebuild/multiplayer.md`

The latest committed session is `847329d`: `Fix AI line scoring and mobile recovery`.

Important worktree note: there may be uncommitted portfolio bridge files/docs from the previous
direction. Preserve them. Do not remove the bridge work, but do not focus on it unless Caden asks.

The active app is `axial-web/apps/web`, a SvelteKit + TypeScript + pnpm app using Three.js/Threlte.
The preserved Unity/Python project remains in `axial-unity/`.

## Session Focus

Plan and then begin Axial online multiplayer.

Caden wants robust private friend-vs-friend multiplayer with:

- short room/join code,
- copyable invite link,
- QR code join,
- player display names,
- host-selected rules before start,
- smooth network handling,
- automatic reconnection,
- clear error states,
- rematch support,
- polished UI that feels as intentional as the current local/AI game.

Do not worry about the portfolio bridge right now.

## Slash Goal Prompt

```text
/goal Plan and implement the first robust Axial online multiplayer foundation.

Read AGENTS.md and the active docs in dev/active/axial-web-rebuild, especially multiplayer.md. Start
with architecture before code: define the Cloudflare Worker + Durable Object room service, protocol,
room lifecycle, server authority model, reconnection strategy, error handling, security, deployment
shape, and tests. Keep multiplayer separate from the Svelte game route; the frontend may render and
animate, but the room service owns canonical game state and validates moves with @axial/core.

First MVP target: Classic private rooms only. A player can create a room, get a short code/invite
link/QR payload, set a display name, wait for a friend, configure rules before start, ready up, play
a server-validated match, survive refresh/mobile sleep through reconnect tokens and revision resync,
see clear connection/opponent-disconnected states, and rematch after game over.

Avoid Tactical multiplayer, public matchmaking, accounts, chat, ranking, and host-controlled
takebacks in v1 unless Caden explicitly expands scope. Preserve existing local/AI/portfolio-bridge
behavior and current uncommitted work. Update context.md, plan.md, tasks.md, deployment.md, and
multiplayer.md as decisions land. Run relevant checks before finalizing.
```

## Architecture Direction

Preferred deployment model:

- `axial-web/apps/multiplayer-worker`: separate Worker app.
- One Durable Object class per room.
- Worker entrypoint handles create/join/WebSocket routing.
- Durable Object owns canonical room state.
- `@axial/core` validates all moves and win/draw state server-side.
- Web app talks to the Worker through HTTP/WebSocket APIs.

Cloudflare docs note that Durable Objects are intended for stateful coordination among clients and
can coordinate WebSocket clients for rooms/multiplayer. Use Durable Object WebSocket Hibernation for
room sockets where possible so idle rooms can sleep without disconnecting clients.

## First Design Questions

- Should v1 route multiplayer under `playaxial.dev/api/rooms/*` or use a Worker subdomain while
  prototyping?
- What room code length/format should we use for easy voice/typing while keeping guessing risk low?
- Should host always be Player 1, or should first player be random once both players ready?
- What exact rules are configurable in multiplayer v1?
- Should v1 allow spectators, or defer them until after two-player stability?
- What duplicate-tab policy should we use? Recommended: latest valid socket wins for that seat.
- What disconnect grace period feels right before a room expires or allows optional forfeit?
- How much event history should the room retain for revision catch-up before sending full snapshots?

## Files To Inspect First

Existing app/core:

- `axial-web/pnpm-workspace.yaml`
- `axial-web/package.json`
- `axial-web/apps/web/package.json`
- `axial-web/apps/web/src/routes/+page.svelte`
- `axial-web/apps/web/src/lib/game/state/gameController.svelte.ts`
- `axial-web/packages/core/src/index.ts`
- `axial-web/packages/core/src/index.test.ts`

Planning docs:

- `dev/active/axial-web-rebuild/multiplayer.md`
- `dev/active/axial-web-rebuild/deployment.md`
- `dev/active/axial-web-rebuild/tasks.md`

Potential new files:

- `axial-web/apps/multiplayer-worker/package.json`
- `axial-web/apps/multiplayer-worker/wrangler.toml`
- `axial-web/apps/multiplayer-worker/src/index.ts`
- `axial-web/apps/multiplayer-worker/src/roomObject.ts`
- `axial-web/apps/multiplayer-worker/src/protocol.ts`
- `axial-web/apps/multiplayer-worker/src/roomState.ts`
- `axial-web/apps/multiplayer-worker/src/validation.ts`
- `axial-web/apps/multiplayer-worker/src/roomCodes.ts`

## Suggested Workflow

1. Inspect `git status` before editing and preserve unrelated uncommitted bridge work.
2. Read `multiplayer.md` and write a short implementation plan before code.
3. Decide the smallest vertical slice:
   - Worker scaffold,
   - room protocol types,
   - room creation,
   - two-player join/name/ready,
   - server move validation,
   - reconnect token/resync basics,
   - minimal frontend entry point.
4. Build protocol/unit tests before deep UI polish.
5. Add local Worker tests and a two-browser-context smoke when possible.
6. Keep normal standalone Axial behavior unchanged.
7. Update active docs as decisions land.

## Verification Expectations

For multiplayer backend work:

- `pnpm check` or package-specific type checks from `axial-web/`.
- `pnpm lint`.
- Worker/package unit tests.
- `pnpm --filter @axial/core test:unit` if core integration changes.
- Local Worker smoke through Wrangler if the Worker scaffold reaches runnable state.

For multiplayer frontend work:

- `pnpm --filter @axial/web test:unit -- --run`.
- `pnpm --filter @axial/web test:e2e` or a focused Playwright multiplayer smoke.
- Desktop and mobile viewport checks for create/join/connection states.
- Use the Codex Browser plugin if its required runtime is exposed; otherwise state the concrete
  missing runtime issue and use local Playwright fallback.

For production:

- Do not deploy until local room flow is stable.
- Caden does not need to do Cloudflare dashboard work for planning/local implementation.
- Production deploy will need Wrangler auth, Durable Object bindings/migrations, and a route/custom
  domain decision.

## Behavior To Preserve

- Existing local and AI modes remain stable.
- Mobile/touch layout stays compact in portrait and landscape.
- Active match autosave/restore and scene recovery stay intact.
- Classic AI line scoring follows maximal-line semantics.
- The portfolio bridge files/docs should be preserved but not prioritized.
- The large Three/Threlte route chunk warning is known and accepted for now.
