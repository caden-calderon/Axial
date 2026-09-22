# Feedback follow-up — 2026-09-07

## User corrections

- Settings must overlay a stationary board. Preserving camera pose alone is insufficient if projection or board scale changes.
- Remove redundant target text from results; reduce the busy action-card layout.
- Give line progress a clear home within match information, away from help/reset controls. Remove permanent rule explanation from the score row.
- Fix the AI's instant random moves after either player scores their first line in a multi-line match.

## Diagnosis and decisions

The prior camera tests checked pose but permitted projection/scale movement. Framing will no longer depend on panel expansion, and rendered screen coordinates will be tested through toggles.

The AI algorithm continues searching on ordinary canonical snapshots after a first line. The actual UI-to-worker boundary is broken: `cloneCompletedLine` retains `direction` by reference. Svelte wraps that nested tuple in a Proxy, and worker serialization throws `DataCloneError`. The controller then silently chooses a random move. A failing structured-clone regression reproduces this; real worker browser regressions cover either scoring player. Clone every nested line value, clean up synchronous transport failures, and offer retry when a search fails instead of substituting random moves.

Keep the existing restrained visual language. Integrate a small player score and progress marks inside the Match section; place the rule explanation in How to play. Simplify the result to a clear outcome, concise score/move detail, a primary rematch action, and lightweight review/keep-board actions. Preserve focus, keyboard dismissal and phone layout.

## Verification

- Baseline before this follow-up: 364 unit tests passed. The new core clone regression and both native worker browser cases failed with `DataCloneError` before the fix.
- Final unit run: 365 passed (core 147, AI 65, web 142, Worker 11). The 43 existing opt-in AI evaluations remain skipped. Camera framing tests were rechecked after a test-only cleanup: 9/9.
- Workspace check and lint pass; Svelte reports zero errors and warnings. Fresh production builds pass with the existing large-chunk advisory. Final changed test/README formatting, targeted ESLint, and `git diff --check` pass.
- Production-preview suite: 31/32 passed initially, including both post-score native worker searches and failure/retry. The remaining desktop board-position test sampled immediately after a keyboard event, before the renderer submitted a frame. Added an explicit wait for the observed frame; both desktop and phone position tests then passed against a fresh production build (2/2). No production behavior was changed between those runs. Together all 32 browser cases have passing evidence; this was not a single clean full-suite run.
- The new position tests compare actual projected coordinates of rendered pieces through three settings toggles at 1366×768 and 390×844, including intermediate frames. The retained orbit/zoom resize regression also passes.
- Manual in-app review: completed a 15-move two-line Local win; verified the first and second line scores, compact result, keep-board, review and redo. Reviewed the result and score layout at desktop 967×743 and narrow phone 320×740, in light/dark themes. The result removes target text and redundant action subtitles; completed matches show Final instead of Live.
- Restored the default viewport and a fresh Local two-line match with dark theme and existing sound preference. Browser warning/error log is empty. Vite remains at port 5173; the local room service remains at 8787. No commit, push, deployment, dependency change or Unity edit.

The fix restores real search after scoring; these checks do not establish perfect AI play or replace longer human strength assessment.
