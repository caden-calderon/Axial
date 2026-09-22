# Axial merge and release review — 2026-09-21

Status: review complete; hold merge until the browser gate is reliable and Caden completes local acceptance. Application code and dependencies were not changed during this review.

## Exact scope

- Branch: `codex/axial-improvement-pass`, HEAD `1bff1e8`.
- Fetched GitHub `main`: `815a02c`, which already merges `b3276d3` through PR #1. Local `main` at `fb4c445` was stale.
- Pending scope is `1bff1e8` plus the existing dirty/untracked improvement pass, including new audio, gesture, line-presentation and regression-test files.
- A non-mutating `git merge-tree` check of HEAD and remote main reported no conflicts and produced the same tree as HEAD. This checks committed ancestry; the dirty additions still need to be included in the eventual commit.
- Reviewed core/AI/controller/worker lifecycle, scene/animation/input/audio/UI/onboarding, page integration and online client. Inspected existing multiplayer server and dependency baseline for release risks.
- No confirmed gameplay correctness regression was found by source review. This does not override the failed browser checks below.

## Introduced finding: P2 — AI regression test rejects supported search results

`axial-web/apps/web/e2e/multiline-ai.e2e.ts:81` permits only `search` and `lookahead`. However, `packages/ai/src/classic/mcts.ts:358–374` intentionally returns a heuristic anchor if the selected branch falls short of the difficulty's minimum search depth. That can happen after substantial search work under the normal wall-clock budget.

The Player 2 case failed on both complete browser runs with `reason: heuristic`. A separate temporary executable reproduction using the same fixture and controller seed returned a legal heuristic move after 186 simulations and 366 lookahead nodes: the selected branch reached depth 2 while Hard requires depth 3. This is not evidence that the native worker failed to clone the game or stopped searching.

Before merge, separate the worker-serialization/continuation contract from time-sensitive AI-strength expectations. Preserve success, legal move, turn advancement and error assertions. Verify actual search work under an appropriate controlled budget rather than treating the chosen result label as proof of worker execution. Do not simply remove meaningful assertions or add retries to hide failures.

## Current verification

- `pnpm check`: pass, zero Svelte errors/warnings.
- `pnpm lint`: pass.
- All 365 default unit tests pass: core 147, AI 65, web 142, multiplayer Worker 11. The 43 opt-in AI evaluations were skipped by the default suite.
- Fresh production builds, invoked by the browser suite: pass. Existing bundle-size advisory remains.
- `pnpm test`: fails; browser portion **30/32** with seven workers. Player 1 AI continuation polling timed out; Player 2 rejected the supported heuristic result.
- `pnpm exec playwright test --workers=1`: fails; **30/32**. Player 1 continuation passed. Player 2 again rejected heuristic. The dense-board draw case timed out waiting 15 seconds for its initial canvas, before its terminal-animation assertion; its attached diagnostic reported no uncaught page errors.
- The dense draw case passed in the first run. This remains an unresolved startup/performance or test-environment issue, not an established draw-animation defect. The first Player 1 polling timeout likewise does not establish that the worker never received a request.
- Both runs passed the actual local two-player room, countdown, move, refresh/reconnect and leave scenario; responsive controls/onboarding/iframe checks also passed.
- `git diff --check`: pass.
- In-app desktop inspection: onboarding, empty board and expanded/collapsed settings rendered; captured warning/error logs were empty. Initial CUA CDP setup timed out, but the documented browser screenshot/DOM interface recovered. This was limited visual inspection, not physical-phone or sound acceptance.

## Existing public-release issues

### P2 — Bound multiplayer body reads before buffering

`apps/multiplayer-worker/src/validation.ts:37` calls `request.text()` before applying the nominal 4096-byte limit when Content-Length is absent. A local reproduction with the real function consumed 1,048,576 bytes in 1,025 stream pulls before rejecting with 413. Count incoming bytes and cancel the stream once the cap is crossed; the existing text-length check also counts characters rather than bytes. WebSocket parsing at `roomObject.ts:373` similarly lacks an application message-size check before JSON parsing.

### P2 — Bound room creation and clean up expired storage

`apps/multiplayer-worker/src/index.ts:79` creates persisted rooms anonymously without a repository-defined rate limit. CORS is not an abuse limit; non-browser callers can omit Origin. `roomObject.ts:470` marks rooms expired, but SQL room state, credential hashes and retained events remain; expiry then removes the alarm without deleting storage. Add effective creation limits and a deliberate retention/cleanup policy before a public promotion. External Cloudflare dashboard/WAF rules were not inspected, so their protection is unknown.

### Dependency security baseline

Current `pnpm audit --json` reports 24 advisories: 10 high, 12 moderate, 2 low, 0 critical. No lockfile changes are part of the pending work. The high-severity paths reported here are development/build/test tools (Vite, ESLint/PostCSS/nanoid, and Miniflare's sharp/undici), not ten demonstrated vulnerabilities reachable in the deployed game.

The installed SvelteKit 2.61.1 also has moderate advisories. The [maintainer's Accept-header advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-29g2-3rmr-qm68) lists 2.70.2 as patched and notes platform header limits mitigate exposure. The [remote-form prototype advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-866w-xmhq-wj7x) requires remote file forms, which this repository does not implement. [devalue's malformed-input advisory](https://github.com/sveltejs/devalue/security/advisories/GHSA-9rgm-9g3h-6x36) requires parsing untrusted data; no direct app use was found. Refresh affected dependencies and re-run gates, without equating the raw count to confirmed deployed exploitability. Full raw audit is at `/tmp/axial-review-audit.json` for this session.

### Sharing and presentation

The main route disables SSR. Both dev and production-preview HTTP responses lack title/description/Open Graph/Twitter metadata; existing Svelte head metadata only arrives after client execution. Put meaningful share metadata in initial HTML and add a social preview image before LinkedIn/X promotion. Verify the actual generated preview separately.

## Next release pass

1. Repair the AI regression-test contract and investigate dense-board startup; obtain one clean complete browser run without hiding failures.
2. Address dependency advisories and multiplayer input/resource limits, with focused regressions.
3. Add and verify share metadata/image, then complete visual polish based on Caden's playtest feedback.
4. Validate physical-phone touch/performance and sound, then stage/public-network verification before promotion. No production testing or deployment happened in this review.

## Local handoff

- Web: `http://127.0.0.1:5173/` — left running.
- Multiplayer: `http://127.0.0.1:8787/health` — local service healthy, invite origin points to the development web server.
- Nothing was committed, pushed, merged or deployed. Existing application changes were preserved.
