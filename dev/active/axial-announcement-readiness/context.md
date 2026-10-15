# Context

Caden is preparing Axial for public announcement and recruiter review after extensive UI polish. The user requested three parallel agents: code/architecture, repository presentation/cleanup, and social text. Promotional media is explicitly a later phase when requested.

Starting tree was clean, local main behind merged work. Refreshed main to b272c28; both old branch tips were fully merged. Only main remains on origin and locally. Local dev web 5173 and multiplayer 8787 pre-existed and are preserved.

Earlier release findings are in `../axial-improvement-pass/merge-review-2026-09-21.md`; those are historical evidence, not this pass's results. Current findings/results are recorded in this directory.

## Current local changes

- Root/project/frontend README entry points and `dev/README.md` index now distinguish the browser product from historical Unity/Python work. Proposed archival moves and prepared GitHub metadata are in `repository-review.md`; nothing was moved or changed remotely.
- `code-review.md` documents confirmed storage and multiplayer input-size defects plus their fixes and remaining rate-limit/retention choices.
- Initial HTML now contains title, description and Open Graph/Twitter text without enabling SSR for the game. Promotional imagery remains deferred. A read-only HTTP check confirmed the live page still lacked these tags during this pass.
- Multiline AI E2E accepts the supported heuristic anchor after real search, and additionally verifies legality, saved moves and turn advancement.
- Social drafts combine all three angles Caden requested: personal rebuild, technical showcase and play invitation. `social-post-drafts.md` includes platform text and factual evidence. Original reports confirm Caden's authorship; no collaborator names were invented.
- Caden explicitly approved compatible dependency security updates and revalidation. Dependency work is local; unresolved advisories are documented separately.

Only branch cleanup affected GitHub. All implementation and documentation edits remain local and uncommitted. No social posting, deployment, promotional capture or license selection has occurred.

## Final integrated result

Check/lint passed, Svelte reported zero errors/warnings, all 378 default unit tests passed (43 optional AI evaluations skipped), and the fresh production build plus complete browser run passed 66/66 with one worker and no retries in 4.8 minutes. See `verification.md` for exact scope and limits. The dependency audit now has 8 inherited-pin reports; room creation limits and expired-data policy remain decisions before public promotion.

Caden clarified that Axial began as a spontaneous idea and the browser rebuild was intended to make it easier for people to play and try. Social drafts use that explanation directly. No promotional capture is authorized yet.

## Follow-up: delegated policy and revised LinkedIn

Caden delegated room resource decisions. Implemented 10 creation attempts/minute per network address and a 24-hour expired-room retention period, with alarm deletion, safe code reuse, storage-free missing-room lookups and lazy legacy cleanup. Details and limitations are in `room-resource-policy.md`. Follow-up check/lint, all 29 Worker tests, deployment dry run, fresh frontend build and the focused 2/2 multiplayer browser run passed. No live state was changed.

LinkedIn now starts with Caden returning after time away, explains MCTS plus alpha-beta/threat checks, browser Web Worker computation, shared rules and authoritative rooms, and ends with upcoming projects and an invitation to connect/follow @caden_calderon on X/Twitter. The first-announcement copy no longer says “Lately I've been…”; Instagram's progress framing was removed too.

## Follow-up: Unity origin and gameplay in LinkedIn

Caden requested a stronger Unity/C#/MediaPipe story and less online-room infrastructure detail. The LinkedIn draft now explains webcam pinch/grab/drop and two-hand rotation, depth estimation and gesture smoothing, then the accessibility motive for rebuilding in the browser. It includes connect five and two/three-line win conditions, plus the Python-to-TypeScript MCTS progression. The multiplayer architecture paragraph was removed. Original C# sources and reports and current browser rules were inspected; this was an editorial pass, not a Unity runtime test. Caden is considering a separate Unity gameplay clip alongside the later edited browser product video; capture still awaits his cue.

## Follow-up: deeper original reports and balanced announcement

Read the game LaTeX report and traced its tracking math to C#. An independent AI report/code review supplied the original search story and flagged paper discrepancies. Recovered original 16-page game and 14-page AI PDFs from the submission ZIPs into `output/pdf/` unchanged; source/PDF versions differ. `original-report-review.md` records provenance, focused visual checks and corrections to consider before publicly reissuing papers. LinkedIn now explains failed depth measurements and the normalized palm maximum, then gives the browser rebuild, hybrid AI and rule variations their own paragraphs. The post links existing report sources until a reviewed PDF URL is available. No report content or game code was changed.

## Follow-up: LinkedIn article, original project first

Caden clarified this is a LinkedIn article, not a feed post. `linkedin-article.md` is now the canonical long-form draft; `social-post-drafts.md` links to it and retains X/Instagram copy. The article centers the original finished-but-unannounced Unity/C#/MediaPipe and Python AI project, explains the tracking problem and math, smoothing and interaction feedback, MCTS selection/tactics/Numba/subtree reuse, then covers the recent web rebuild. Both papers are linked individually to their currently public LaTeX sources; readable public PDF links remain a publication step after the documented paper review. No deployment, hosting, game changes, paper revision or capture was performed.

Caden then requested a deeper source pass for a mixed technical/general audience. The current article is about 2,000 words, explaining jargon through game actions: palm projection/normalization, grab and column hysteresis, rollout/UCT selection, compiled NumPy/Numba operations, fair deadline-limited lookahead, pointer intent and multi-line objectives. Both original-work and browser-source agents reviewed it; source evidence is in `original-report-review.md`. X activity is directly confirmed by Caden and stays in the closing invitation.

## Follow-up: selected cuts, analogies and AI comparison

Caden requested removal/reworking of the browser tutorial sentence and pointer/orbit paragraph, clearer technical explanations with analogies, and a stronger PalmMaxDimension problem/solution. Those selected passages are removed. The article now separates gesture-shape changes from image-axis rotation, explains normalized palm measurements through a ruler analogy and retains the edge-on limitation. It adds plain-language support for hysteresis, MCTS and subtree reuse. The original and browser AI comparison was rechecked against source; shared MCTS is explained once, with the web passage limited to substantive differences. A proposed tracking figure is documented in `social-post-drafts.md`; no media was created, since the user was exploring whether it is needed.

## Follow-up: restrained edits with before-and-after tracking

Caden likes the article and now requests exact before-and-after comparisons for every subsequent article edit, plus no em dashes. Revision 1 is recorded in `linkedin-article-edits.md`: condense the selected smoothing/hysteresis/feedback block, accurately mention lost detection as a separate limitation, simplify one Palm sentence and the simulation-budget explanation, and replace both em-dash constructions. Preserve the article’s established direction and append future editorial changes to this log. The original code releases an active pinch when detected landmarks disappear; do not invent a one-frame grace period or claim smoothing solves missing observations.

## Follow-up: approved final article pass and PDF conversion

Caden approved the final review suggestions except shortening the palm-depth explanation, which must remain intact to support nontechnical readers. Revision 3 in `linkedin-article-edits.md` records all 12 article changes, including three section headings, clearer rules and MCTS choice, a more distinct browser lookahead explanation, smoother transitions, and a brief reflection. The complete depth section is preserved exactly. A fresh-context reader checked the updated article and found no remaining actionable editorial issues. Caden also requested PDFs compiled from both checked-in LaTeX reports. New compilations are separate from the preserved archive PDFs; see `pdf-build-notes.md` for build and visual verification. The article now uses local PDF links, which still need public destinations before publication. No hosting, publishing or promotional capture is authorized by this conversion request.

## Follow-up: select and clearly organize the original papers

After seeing the differences, Caden requested the better versions in an easy-to-discern area. `output/pdf/axial-papers/` contains two numbered copies of the archived originals, a README explaining the choice and differences, and an `alternate-latex-compilations/` subfolder with the new builds. All four copies were hash-verified against their source files. Prior files remain untouched. The original game report retains its colored diagrams and correct six-flat-diagonals table, as well as its known historical layout overflow. The original AI report is selected for archival fidelity, not because its 100% result has been established as correct over the source's 75% result. Revision 4 logs the article's two paper-link changes and corresponding provenance sentence. Public hosting remains pending.

## Follow-up: web trailer research

Caden requested research and planning for a short, nontechnical web-game trailer for LinkedIn, Instagram and X. He confirmed customizability/rule settings and music with a short AI voiceover. `web-trailer-research.md` proposes a 35–40 second edit using OBS, Remotion and FFmpeg, with voice auditions, a storyboard and separate landscape/portrait compositions. Official sources confirm LinkedIn native article-cover videos and X's published 40 fps ceiling. Remotion Canvas Capture currently requires Apple Silicon, so it is excluded from this Linux workflow. Exact Instagram consumer limits could not be verified because Help was blocked. A ten-second dual-format proof is proposed for the production phase. Only planning documents changed; no tool installation, recording, speech generation, purchase, publication or app change was performed.

## Follow-up: installed editor and cinematic script

Caden authorized installing/setup of the needed editing tools and developing the script/editing guide. Installed a standalone Remotion 4.0.526 workspace at `axial-video/`, with its own pnpm lockfile and no web-app dependency changes. The official Remotion skill is installed in `~/.codex/skills/remotion-best-practices`. The default browser download failed TLS; existing `/usr/bin/chromium` successfully rendered both storyboard formats. Studio runs at http://localhost:3333 with named `TrailerStoryboardLandscape` and `TrailerStoryboardPortrait` compositions. These are clearly labeled text planning cards, not gameplay footage.

`web-trailer-script.md` now holds the canonical 44-second proposal: 12.5 seconds of tense gameplay with two blocks and a final win, then “This is Axial,” the premise, rule variations and a browser-play invitation. The 42-word narration targets an original female, even and slightly robotic sci-fi delivery. The opening sequence was validated by the script agent and independently rechecked against the actual core: one threat blocked, a two-route fork, a second block, then the remaining diagonal win. It uses a bottom-plane diagonal; later shots should establish height. The raised/connect-five/multiline examples are not yet staged. Voice auditions, music selection and gameplay capture remain future production work. Article content and existing app edits were preserved.

## Follow-up: cinematic capture and sound investigation

Caden requested investigation of cinematic angles, including an overhead camera following a falling piece, and sound design. `cinematic-capture-plan.md` recommends reusing the actual Svelte/Threlte scene with a small local capture entry, programmable camera and explicit presentation time, then editing the resulting shots in Remotion. Camera restrictions are gameplay choices; current real-time piece/line clocks require targeted changes for deterministic slow motion. A 4–6-second overhead-drop/impact/win-reveal proof is proposed before full capture. Sound planning builds on existing synthesized impact/win tones with restrained movement noise, tension pulse, pre-impact space and separate narration/music/effects tracks. This was research and planning only; no game or storyboard code changed and no media was generated.

## Follow-up: first full video and release presentation

The first 44-second trailer is now assembled in Remotion from frame-stepped actual browser gameplay, original Kokoro synthetic narration, and separate procedural music/effects. Landscape and portrait compositions are local; capture scripts and exact limits are documented in `video-production.md` and `axial-video/README.md`. The opening follows the previously validated threat/block/fork/block/win sequence, and the rule examples were checked with the shared core. The overhead-follow camera and in-scene orbit remain an artistic follow-up, not a claimed captured effect. Caden's playback approval remains outstanding.

The root README now includes a small actual gameplay still. The two selected archived reports were copied byte-for-byte to `docs/papers/` with a provenance note; the article's only new edit changes its two local PDF targets to future GitHub URLs, logged exactly as revision 5 in `linkedin-article-edits.md`. Those URLs will work only after a reviewed commit/push. Generated local `output/` files are ignored. No project-wide license has been chosen, and no repository metadata, deployment, social account, or public Git state has been changed in this follow-up.
