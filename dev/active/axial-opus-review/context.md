# Axial Opus review: context

Date started: 2026-10-14. Worktree `/home/caden/.t3/worktrees/Axial/t3-73b8c85b`, branch `t3/73b8c85b`, branched from `announcement-readiness` at `793e0db`. Commits stay on this branch: no push, deploy or merge.

## Environment notes

- `pnpm install --frozen-lockfile` from `axial-web/` (re-run after `9c09b26`, which adds tool devDependencies to core and AI). pnpm skipped the esbuild/sharp/workerd build scripts; check, lint, unit, build and the local Worker still run.
- Playwright's bundled Chromium is not installed (`~/.cache/ms-playwright` is absent), so the project's `pnpm test:e2e` would download browsers. Rather than install imperatively, the suite runs against the system Google Chrome (NixOS links `/opt/google/chrome/chrome`) through an out-of-repo override config, `/tmp/axial-opus-review/pw/playwright.chrome.config.ts`. It imports the project config and only sets `use.channel = 'chrome'`, absolute `testDir`/`cwd` and an output dir in `/tmp`. Run from `axial-web/apps/web`:
  `CI=1 pnpm exec playwright test --config /tmp/axial-opus-review/pw/playwright.chrome.config.ts --workers=1`
- A frozen bundle of the starting AI (793e0db) for head-to-head and baseline evals: `/tmp/axial-opus-review/ai-baseline-793e0db.mjs`, built with the workspace esbuild 0.28.1:
  `node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild packages/ai/src/index.ts --bundle --format=esm --platform=node --outfile=/tmp/axial-opus-review/ai-baseline-793e0db.mjs --alias:@axial/core=./packages/core/src/index.ts`
  Use it with `AXIAL_AI_BASELINE_BUNDLE=/tmp/axial-opus-review/ai-baseline-793e0db.mjs` for `eval:paired` and `eval:challenges:baseline`.

## Final gates (HEAD after the Codex fixes)

- `pnpm check`: pass, 0 Svelte errors, 0 warnings (now also type-checks core and AI).
- `pnpm lint`: pass (now also core and AI).
- `CI=1 pnpm test:unit`: 427 passed, 47 opt-in evaluations skipped (core 152, AI 74, web 162, Worker 39).
- `CI=1 pnpm build`: pass; page chunk `nodes/2` 145 kB, scene chunk 801 kB (loaded dynamically).
- Playwright (system Chrome, one worker): 78/78 in 3.5 min.
- `pnpm --filter @axial/multiplayer-worker deploy:dry-run`: bundles (80.1 KiB, 16.9 KiB gzip); nothing deployed.

## Baseline gates at 793e0db

- `pnpm check`: pass, 0 Svelte errors, 0 warnings.
- `pnpm lint`: pass.
- `CI=1 pnpm test:unit`: 388 passed, 43 skipped (core 147, AI 65 + 43 skipped, web 147, Worker 29).
- `CI=1 pnpm build`: pass; main route chunk `nodes/2` 947 kB (251 kB gzip), existing >500 kB advisory.
- Playwright (system Chrome, one worker): 67/67 passed in 3.0 min.

## AI evidence (final engine vs 793e0db)

Harness: `/tmp/axial-opus-review/ai-eval/` (B's probe scripts, made engine-pluggable; positions are always generated with the 793e0db engine so before/after see identical positions). Bundles: `engine-before.mjs` (793e0db) and `engine-after7.mjs` (final AI, after the Codex fixes).

| Evidence                                                                        | Before (793e0db)               | After (final)                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `eval:challenges` (reduced, 17 fixtures incl. 4 new)                            | 14/17                          | 17/17                                                                                                |
| `eval:challenge:full` (Max preset)                                              | 14/17                          | 17/17                                                                                                |
| `eval:ladder` Easy / Medium / Hard / Max                                        | 9 / 10 / 13 / 14 of 17         | 9 / 10 / 17 / 17 of 17                                                                               |
| `eval:strength:hard` (deterministic Max vs Hard)                                | Max 3/4                        | Max 3/4 (Hard improved too; Max's loss has no move losing within 5 plies)                            |
| Paired product presets, Hard, C4 one-line, 40 games                             | —                              | 21–19; first player won 37/40; median latency 16 → 67 ms (UI holds replies ≥ 650 ms), p95 1.4 s both |
| Trap positions (30/rule, exact 3-ply oracle), Hard & Max, C4 one/two/three-line | 0 unsafe                       | 0 unsafe                                                                                             |
| Trap-position latency p95, Hard (C4/1, C4/2, C4/3)                              | 57 ms, 111 ms, 139 ms          | 1.4 s, 1.9 s, 2.4 s                                                                                  |
| Trap-position latency p95, Max (C4/1, C4/2, C4/3)                               | 46 ms, 109 ms, 126 ms          | 3.6 s, 4.8 s, 6.1 s                                                                                  |
| Fixed-work lookahead speed (4 positions)                                        | 3.3 s / 1.3 s / 2.8 s / 0.32 s | 1.8 s / 0.85 s / 0.75 s / 0.22 s, identical nodes and moves                                          |
| 10x10x10 instant tactical replies                                               | 118–397 ms                     | 1–2 ms                                                                                               |
| Core replay, 10x10x10, 171 moves                                                | 135 ms                         | 2 ms                                                                                                 |

Variants tried on the way: sending every fork block to the full search (Hard 15/17, strength 4/4, but median product latency 1.4 s Hard / 3.6 s Max) was replaced by the verified shortcut; checking with the preset's own depth left Hard at 14/17 until the Codex review prompted the depth-3 check.

## Working notes

- Scratch work lived in a detached worktree at `/tmp/axial-opus-scratch` (patches were prototyped there and applied to this branch as commits; the scratch tree's own commits were never on a branch). The multiplayer slice was implemented by a subagent in an isolated worktree, reviewed, split into three commits here, and its temporary worktree and branch removed.
- Production-preview measurements used `vite preview` on ports 4198/4199, never 4173/5173/8787 outside the Playwright run.
- Load timing (`/tmp/axial-opus-review/load-timing.mjs`): phone emulation, 4x CPU throttle, 10 Mbps / 40 ms.
- Engine probes: `/tmp/axial-opus-review/ai-eval/` (`paired.mjs`, `blunders.mjs`, `speed.mjs`, `replay-speed.mjs`, `gameaudit.mjs`, `safeset.mjs`, `build-engine.sh`).

## Codex review (read-only, gpt-6-sol, xhigh) of 793e0db..d2c4453

All six findings held up and were fixed (`b91251c`, `5f709ae`, `c7f1db7`, `6a8730d`):

1. P1: the shader warm-up task never stopped (Threlte's `running` is `$derived`; the flag was plain) and called `renderer.compile` every frame. Fixed with `$state`; new test counts compile calls (old code: 123).
2. P2: floor picking rejected upward rays, so empty tiles couldn't be picked with the camera under the board. Fixed and unit-tested.
3. P2: the veto could return the refuted move when the lookahead examined no alternative. Fixed with a fallback to the search's candidates; the first version of that fallback also replaced moves in all-lost positions with unexamined ones and broke a fixture, so it is limited to the case where the lookahead examined only the refuted move.
4. P2: Hard's depth-2 check couldn't see the fork traps. The single-move check now runs at depth ≥ 3 (Hard ladder 14 → 17/17).
5. P3: Z rails nearly invisible at face-on angles. Cross-fade widened.
6. P3: shader test missed a fresh board's first move and repeated compiles. New test added.

Codex also re-checked core incremental lines against the full scan (27,492 positions) and AI incremental counts against core (11,068 states), and found no serious defect in the worker revision, cache, authentication or join changes, the page, the label cache or the pulse lifecycle.
