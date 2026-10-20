# Repository readiness review

Reviewed 2026-09-21 against local `main` at `b272c28` and the public GitHub API. This review covers repository presentation and documentation; it does not certify a deployment or authorize publication. Documentation edits below are local and uncommitted.

## Changes completed

- Added a root `README.md` with a play link, game overview, architecture highlights, code tour, reproducible setup, verification commands, and a map separating the active web app from historical work.
- Replaced the generated Svelte scaffold README in `axial-web/apps/web/` with the actual frontend source map, configuration, and commands.
- Updated `axial-web/README.md` with the pinned runtime/package manager, frozen-lockfile install, browser test prerequisites, and a one-shot unit-test command. Its previous unqualified `pnpm test:unit` can enter watch mode in the web package; `CI=1 pnpm test:unit` avoids that for automated verification.
- Corrected the claim that a clone includes `axial-unity/`. The root ignore file explicitly excludes that local preserved project.
- Added `dev/README.md` as a stable index separating the current announcement pass from earlier dated notes, without moving existing paths.
- Kept all historical source, reports, submission files, and local bundles intact. No GitHub settings, license, assets, branches, commits, or releases were changed in this review.

## What a recruiter sees today

The public repository is [caden-calderon/Axial](https://github.com/caden-calderon/Axial). At review time, [GitHub repository metadata](https://api.github.com/repos/caden-calderon/Axial) reported:

- Public visibility, default branch `main`, and no archive flag.
- Description: `3D Connect 4 `.
- No homepage URL, topics, or detected project license.
- No GitHub Actions workflows and no releases, confirmed with the repository's `/actions/workflows` and `/releases` API endpoints.

The root previously exposed only a 205-byte `README.txt` with a YouTube link and a note about a zipped course submission. The new README provides an entry point into the current product without discarding that historical record.

The tracked source already shows meaningful engineering work: a shared canonical rules package, independent AI and protocol packages, server-authoritative private rooms, dedicated browser integration tests, and dated design/verification notes. The most useful presentation improvement is making those boundaries legible, rather than adding badges or broad claims about production readiness.

## Proposed GitHub settings

These are prepared values, not applied changes. Changing public metadata requires the owner's approval.

- **Description:** `A browser-native 3D strategy game with local play, search-based AI, and private online multiplayer.`
- **Website:** `https://playaxial.dev`
- **Topics:** `game`, `3d`, `typescript`, `svelte`, `sveltekit`, `threejs`, `threlte`, `mcts`, `multiplayer`, `cloudflare-workers`
- **Social preview:** use a real, approved gameplay still after the requested capture session. Do not use the old Unity submission video as a preview for the current web product.

A release/tag is optional and should correspond to the final verified, shipped announcement version. There is no need to invent a version label before that point.

## Authorship and credits

`main/README.txt` describes a joint submission between CS440 and CS462, meaning two classes. Both TeX reports name Caden Calderon as author; `Reports/Game_Report.tex` explicitly describes a solo project in its workload section. Git history has two author display names using the same address. Counter-group playtest feedback is acknowledged in the report, but no additional project author was found. First-person announcement text is supported by these records; preserve third-party font/library credits and do not imply authorship of those dependencies.

## Cleanup and archive proposal

The safe first step is complete: describe the repository accurately and keep paths stable. The smallest follow-up is moving only the old submission README, report-writing prompt, Context, and Reports into one labeled historical folder, with references updated. Keep Python source and environments in place until baseline command changes are intentionally included. A follow-up archive pass would improve the root listing, but should be a deliberate, separate change because some historical paths remain referenced by reproducibility notes.

| Current path                                        | Recommendation                                                                                               | Reason / dependency                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.txt`, `Instructions.md`                     | Move into a clearly labeled original-project documentation folder after approval                             | Submission text and a report-writing prompt are not current setup instructions                                                                |
| `Context/`, `Reports/`                              | Keep the useful project history together under a proposed `archive/original-project/`                        | Preserves provenance; update links rather than deleting reports                                                                               |
| `Old/`, `Training/`                                 | Consider `archive/python/` with a short historical README                                                    | Older engines and learning experiments are distinct from the deployed TypeScript AI                                                           |
| `main/`                                             | Preserve its path until deciding whether historical Python smoke/evaluation commands should change           | `dev/active/axial-web-rebuild/classic-ai-research.md` and `context.md` reference `uv run --python 3.12 python main/test_simple.py`            |
| `pyproject.toml`, `uv.lock`                         | Keep while the preserved Python baseline remains runnable                                                    | Removing these would weaken reproducibility; the web app does not depend on Python                                                            |
| `dev/active/`                                       | The stable index is now added; consider moving completed work to `dev/archive/` later as one link-aware pass | Several “active” contexts still discuss old branches and pre-merge state; dated evidence is useful history but should not read as live status |
| `axial-unity/`, root ZIP files, checkpoints, caches | Leave local artifacts alone                                                                                  | These are ignored and are not public-repository clutter; deleting them would not improve the GitHub landing page                              |
| `.impeccable/live/config.json`                      | Keep unless the owner no longer uses this tooling                                                            | Tool configuration is not a cleanup target solely because it is hidden                                                                        |

Avoid changing Git history for this cleanup. Preserve attribution and research artifacts, use ordinary future commits for any approved moves, and fix historical path references in the same change. GitHub's current language breakdown includes substantial Python and TeX because those files are tracked; do not hide code purely to inflate the TypeScript percentage. If the archive is later formalized, a documented Linguist classification can accurately distinguish historical/vendor content.

## Remaining gaps

1. **Project license is undecided.** No tracked root license was found, and GitHub reports none. Do not select one on the owner's behalf or call the project open source until its licensing intent is settled. The bundled Inter license is present at `axial-web/apps/web/static/fonts/Inter-LICENSE.txt`; that does not license Axial itself.
2. **The README has no gameplay image yet.** Only app icons/favicon are tracked raster assets. A single readable desktop screenshot and optionally a phone view would make the project much easier to assess. Wait for Caden's requested capture phase, use actual current gameplay, and keep media assets small.
3. **No automated GitHub check gate is configured.** The repo has check/lint/unit/browser/build scripts but no workflow files. A later minimal CI workflow could pin Node/pnpm, install from the lockfile, run checks and unit tests, and run Chromium integration tests. Keep deployment and external-service credentials out of that initial workflow; do not add a green CI badge before a real workflow passes.
4. **Deployment documentation contains historical operational details.** `dev/active/axial-web-rebuild/deployment.md` mixes current commands with June DNS issues and deployment IDs, and lists direct Worker deployment alongside a `main` push. Treat it as dated evidence. Before release, verify actual Pages/Worker state and rewrite a small current release checklist with local gates before publication and smoke checks after deployment.
5. **Independent human/device acceptance remains valuable.** Existing notes distinguish browser automation from physical-phone input, perceived audio, and public-network behavior. Preserve that boundary in launch claims; neither a README nor a passing local test suite proves those checks.

## Inventory and security hygiene

`git ls-files` at the start of the review showed 176 files under `axial-web/`, 32 under `dev/`, and 41 historical files across `Old/`, `Training/`, `main/`, `Context/`, and `Reports/`. Local directory size is misleading: the large root ZIP files, the Unity project, generated screenshots, environments, training checkpoints, and build outputs are ignored.

The largest tracked image is `axial-web/apps/web/static/icons/axial-logo.png` at about 1.67 MB. `Context/Project Proposal.md` is about 724 KB. Neither justifies destructive cleanup; inspect usage before any asset optimization.

A limited tracked-file scan found no PEM/OpenSSH private-key headers, GitHub token patterns, AWS access-key IDs, or Slack token patterns. The sensitive-filename inventory only surfaced `axial-web/apps/web/.npmrc`, which contains package-manager configuration rather than authentication. This was a narrow working-tree check, not a secrets/history audit or certification. The root `.gitignore` excludes `.env` files, common archives, generated outputs, and checkpoints.

## Evidence and validation

Sources inspected: root and workspace READMEs, tracked-file inventory, `.gitignore`, package manifests and pinned Node version, Playwright configuration, multiplayer endpoint resolution, AI presets/search source, product brief, original-project instructions, and existing design/deployment/verification notes. `gh` is not installed in this environment; public GitHub metadata was read using unauthenticated HTTPS requests to the GitHub API.

Documentation checks: formatting for changed Markdown, local relative-link targets, referenced source directories, and a final diff review. Application behavior tests are owned by the main readiness pass; this documentation review makes no new runtime test-pass claim.

## September 22 local preparation

The screenshot gap is addressed with `docs/media/axial-gameplay.webp`, a 36 KB still captured from the running web game with actual multi-line progress visible. The root README embeds it. `docs/papers/` contains byte-for-byte copies of the two selected archived reports and a provenance note; the article now points to their future GitHub URLs. This is local preparation only, so those URLs do not yet resolve on `main`.

A minimal `.github/workflows/web-checks.yml` is prepared with pinned Node/pnpm and check, lint, unit-test and build commands. It has not run on GitHub. Browser tests remain a manual release gate until the initial workflow is proven. The public About description/homepage/topics and social-preview settings remain unchanged. Project-wide licensing remains a decision for Caden after the MIT/Apache-2.0/GPLv3/no-license comparison. No history or historical paths were moved.
