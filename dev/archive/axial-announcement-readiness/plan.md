# Announcement readiness

Status: review and contained fixes complete, 2026-09-21. Local working changes on `main`; final gates passed. Remaining release decisions are in `verification.md`. No deployment or publishing authorized.

## Scope

- Remove merged branches while preserving all work. Completed: fast-forwarded to `b272c28`, verified both branch tips are ancestors, deleted old local branches and remaining remote branch.
- Independently review code/architecture, recruiter-facing repository presentation, and announcement copy for LinkedIn, X and Instagram.
- Fix confirmed, contained release defects with regression coverage. Preserve today's approved UI and gameplay identity.
- Validate checks, lint, unit tests, production build and browser suite. Separate local evidence from live/physical-device acceptance.
- Keep video, promotional screenshots and social preview artwork pending Caden's cue.

## Decisions

- Keep only `main`, as requested; do not create branches or publish local edits.
- Improve README entry points now; propose archival moves, licensing and live GitHub settings before changing them.
- Make initial HTML shareable without switching the client-rendered game to SSR.
- Test native AI worker serialization/continuation directly; a heuristic result after search is valid and is not evidence of transport failure.
- Multiplayer rate limits and retention affect operations/product policy: document choices before implementation.

Follow-up authorization: Caden delegated those decisions. Chosen policy is 10 creation attempts per minute per network address and deletion 24 hours after room expiry. See `room-resource-policy.md`. Social copy now uses his requested returning-to-LinkedIn opening, more technical detail and X/Twitter connection invitation. Deployment and media capture remain separate.

## Work ownership

Follow-up media scope: Caden authorized installation/setup and script development. A standalone `axial-video/` Remotion project keeps video tooling outside the game workspace. The current script/editing guide is `web-trailer-script.md`; target 44 seconds with a 12.5-second cinematic opening before narration. The first compositions are timed text storyboards. Actual gameplay and voice production follow the script review; publishing remains unrequested.

- Main agent: integration, release baseline, initial-HTML metadata and AI browser regression contract.
- Code agent: correctness/architecture review, confirmed storage failure and input-size fixes.
- Repository agent: README files and repository audit.
- Copy agent: platform-specific text drafts and factual claims.
