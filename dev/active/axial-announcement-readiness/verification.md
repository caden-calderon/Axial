# Readiness verification

Date: 2026-09-21. Starting commit `b272c28`; results apply to this session's local working changes, not a deployed release.

## Integrated gates

- `pnpm check`: passed, zero Svelte errors/warnings.
- `pnpm lint`: passed across web and multiplayer Worker.
- `CI=1 pnpm test:unit`: **378 passed**, **43 opt-in AI evaluations skipped**. Core 147, AI 65, web 147, Worker 19.
- Production build invoked by Playwright: passed with the existing large-chunk advisory.
- Final `pnpm --filter @axial/web exec playwright test --workers=1`: **66/66 passed in 4.8 minutes**, one worker, no retries. The complete check/lint/unit/browser command exited 0.
- An earlier complete browser run passed **64/64** in 4.7 minutes before the dependency refresh, additional storage E2E cases and final route-title consolidation. It is preliminary evidence only.
- `git diff --check`: passed, including final documentation updates. All relative Markdown links in the changed documentation resolve locally.

The final run uses SvelteKit 2.70.2, Vite 8.0.16, Vitest 4.1.11 and the updated lockfile. The browser runner builds a fresh production preview on port 4173 and uses the existing local multiplayer service on port 8787. Worker unit/integration tests exercise the current Worker source independently.

## Verified scope and limits

Browser coverage includes actual AI workers, completed-line continuation, unavailable browser storage, game animations, camera stability, reduced motion, onboarding at phone/tablet/desktop sizes, touch confirmation, saved match results, iframe messaging, and two-client online play. Sharing checks inspect the initial page with JavaScript disabled, plus hydrated title/description uniqueness. These are automated emulated browsers, not physical-phone acceptance or a human sound-quality review.

The original multiline AI check passed 3/3 in the initial focused run; its previous failure was time-dependent. The updated contract explicitly supports a heuristic anchor after real search while checking native worker success, legal move selection, persistence, and turn advancement. It does not lower the gameplay search budget or claim stronger AI.

Only `main` remains locally and on GitHub; `git ls-remote --heads origin` confirms it is the only remote branch. Both deleted branch tips were verified as ancestors of main before deletion.

The read-only request to `https://playaxial.dev/` returned successfully but had no title/description/Open Graph tags in its initial HTML. Local metadata changes have not been deployed. No production gameplay/room mutation, hostile traffic, social publishing, media capture, or deployment was performed.

## Remaining release decisions

1. Creation and retention decisions were delegated and implemented in the follow-up below. Verify the actual deployed binding and expiry behavior after authorized release; untouched legacy expired objects still need an operational inventory if a complete historical purge is desired. See [room resource policy](room-resource-policy.md).
2. Review the **8 residual audit reports** (3 high, 4 moderate, 1 low). They concern pinned Kit cookie and local emulator sharp/undici dependencies; no compatible forced replacement was applied. Audit remains nonzero. See [dependency review](dependency-review.md).
3. Review prepared GitHub description/homepage/topics and licensing intent. Archive moves remain proposals. See [repository review](repository-review.md).
4. Review [announcement text](social-post-drafts.md), then capture gameplay/video and social-preview imagery when Caden asks.
5. Complete physical-device/audio acceptance, authorize the release, and verify the deployed game and actual platform link previews before posting.

Local gate logs are in `/tmp/axial-announcement-final-{check,lint,unit,browser}.log`; audit details are in `/tmp/axial-announcement-audit-after.json`. Temporary logs are supplemental evidence, not required project files.

## Delegated policy and announcement-copy follow-up

Caden authorized judgment on the room resource decisions. The implementation now limits creation to 10 attempts per 60 seconds per edge-provided network address, using Cloudflare's approximate per-location limiter. Expired-room data has a 24-hour grace period followed by deletion. Missing-room reads allocate no schema. Legacy expired records repair cleanup on access; no production sweep has run.

Current follow-up evidence: workspace check/lint passed; **29/29 Worker tests passed**; `wrangler deploy --dry-run` passed and listed the expected binding; a fresh frontend production build and **2/2 scoped multiplayer browser tests passed** in 23.1 seconds with one worker and no retries. The UI regression covers the rate-limit alert, enabled retry and continued local play; the existing test covers a real local two-player room. An initial selector matched two error copies and was corrected to target the accessible alert before the complete passing rerun. The earlier 378-unit/66-browser run remains the broader baseline, not a claim that the entire expanded suite was rerun here.

Logs: `/tmp/axial-policy-{check,lint,worker-tests,dry-run}.log` and `/tmp/axial-policy-browser-final.log`. Changes remain local and uncommitted. No deployment, posting or media capture occurred.

## September 22 local release preparation

With the same local web/Worker changes still uncommitted, fresh `CI=1 pnpm check`, `CI=1 pnpm lint`, `CI=1 pnpm test:unit`, and `CI=1 pnpm build` all exited 0. Svelte reported zero errors/warnings. Unit totals are now **388 passed**: core 147, AI 65, web 147, Worker 29; 43 optional AI evaluations skipped. The prior complete **66/66 browser** result is still the latest full browser-suite evidence; the new video/docs/CI preparation did not change web runtime source. The new GitHub workflow mirrors the local check/lint/unit/build commands but has not run on GitHub.

The separate Remotion workspace passed `pnpm lint` and `pnpm build` after the final composition changes. Both 44-second MP4s were probed and sampled; details are in [video production](video-production.md). `git diff --check` and Prettier checks on new public README/paper/video/workflow files passed. No current production deployment or physical-device/audio acceptance was performed.
