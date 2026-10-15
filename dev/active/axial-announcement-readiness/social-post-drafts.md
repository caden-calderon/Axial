# Axial announcement drafts

Status: **Drafts for Caden's review. Not posted.** Written from the current repository on September 21, 2026. Feature descriptions are supported by source inspection; this document does not certify the deployed build or replace the release checks. Video and screenshots remain a later, separately requested step.

Direction confirmed by Caden: blend the personal rebuild/polish story, technical work for recruiters and collaborators, and an invitation to play. Lead with the game people can try, then the work of turning a Unity project into a browser experience. LinkedIn carries more of the design/engineering story; X and Instagram get people curious enough to play.

## LinkedIn article

The current draft is [Axial: From a Hand-Controlled Unity Game to the Browser](linkedin-article.md).

Caden clarified that this is an **article**, not a standard feed post. The article replaces the earlier character-limited draft. It leads with the original Unity/C#/MediaPipe and Python AI work, completed a while ago but never shared, then explains the recent browser rebuild. It includes both original technical papers as deeper reading and ends with the play link, upcoming projects and X invitation.

The selected papers are the two numbered archived originals in `output/pdf/axial-papers/`, now linked from the article. The same folder contains a version guide and `alternate-latex-compilations/` for the newer builds of the repository sources. The game original preserves its colored flowcharts and corrected diagonal count. The AI result discrepancy remains documented rather than silently reconciled. Public PDF hosting remains pending. Both the recovered originals and the compiled files also remain at their prior paths for provenance; see [the original-report review](original-report-review.md) and [PDF build notes](pdf-build-notes.md).

The original Unity gameplay clip and the later edited browser video can accompany the relevant parts of the article once Caden requests capture. No footage is assumed in the article wording.

## X

Axial started as a random idea: Connect 4 in 3D.

I rebuilt my Unity game for the browser so it's easier for people to try. Rotate the board, play against the AI, or invite a friend.

Give it a go: https://playaxial.dev

## Instagram

One random idea turned into Axial: Connect 4 in 3D.

I originally made it in Unity, then rebuilt it for the browser because I wanted it to be easier for people to play and try. Just open a link and have a go.

Drop pieces into the board, rotate it, and connect four across, up or diagonally.

Play against the AI, take turns on one device, or invite a friend to an online room.

Give it a try at playaxial.dev and tell me how your first game goes.

I've got some other projects and cool things to share soon, too. Follow along here or on X/Twitter: @caden_calderon.

## Editorial notes

- The X draft is one post: 219 raw characters, or 221 with its URL conservatively budgeted at 23 characters, including line breaks. Recount after any edits or tags.
- The Instagram caption uses the readable domain without assuming a profile link has been added. If Caden adds the game to the profile, the final invitation can become: “Try it through the link in my bio and tell me how your first game goes.”
- No hashtags are necessary for these drafts. Add personal tags or credits only if Caden wants them.
- The LinkedIn article includes a play link, repository link and both selected original PDFs. Replace the local PDF destinations with public URLs before publication.
- “Connect 4” matches the app's current tutorial language and is a description of the familiar rule. Axial remains the project name throughout.
- Do not add “unbeatable,” an Elo rating, neural-network claims, player counts, awards, or a development-time estimate without evidence. The active browser AI uses search; preserved training experiments are not the shipped opponent.
- Tactical mode is marked Coming soon. Do not advertise special pieces as playable launch features. Hand tracking belongs to the original Unity project, not the browser feature list.
- Avoid “launched today” until the final live build and announcement timing are confirmed. The current drafts can be published as a project introduction without inventing a first-release date.
- LinkedIn is a first project announcement written as an article, with a returning-to-posting opening. Its technical details explain the original work and the later rebuild without claiming a benchmark score or perfect play. `linkedin-article.md` is the single current LinkedIn draft.

## Confirmed personal context

Caden described the game as a spontaneous idea, with no larger inspiration story. He rebuilt it for the browser to make it easier for people to play and try. The copy reflects those answers directly. The repository review also confirmed original sole authorship, supporting the first-person wording. No origin, motivation or collaborator question remains pending for these drafts.

## Claim evidence

The expanded technical copy was checked directly against `analyzeMctsMove` and its simulation/backpropagation flow in `axial-web/packages/ai/src/classic/mcts.ts`, alpha-beta pruning and forcing-move selection in `classic/lookahead.ts`, the worker entry/client in `axial-web/apps/web/src/lib/game/state/classicAi.worker.ts` and `classicAiClient.ts`, and `playClassicMove` / `RoomObject` in `axial-web/apps/multiplayer-worker/src/roomState.ts` and `roomObject.ts`. The current LinkedIn article is maintained in `linkedin-article.md`; X remains 221 characters with the conservative URL allowance. The article gives most of its space to the original hand interaction and Python AI, then explains the recent browser rebuild. Multiplayer is described as a play option without room-infrastructure detail.

| Draft claim                                                      | Repository evidence                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spontaneous idea; browser rebuild to make the game easier to try | Caden's direct explanation in this session                                                                                                         |
| Gravity-based 3D connections; default connect four               | `axial-web/packages/core/src/index.ts`; `axial-web/apps/web/src/lib/game/onboarding/welcomeTourSteps.ts`                                           |
| AI, local and private online modes                               | `axial-web/apps/web/src/lib/game/ui/MatchSettingsPanel.svelte`; `axial-web/apps/web/src/lib/game/ui/OnlineRoomPanel.svelte`; `axial-web/README.md` |
| Unity/Python origin and browser rebuild                          | `dev/active/axial-web-rebuild/archive/2026-05-26-background.md`; preserved `axial-unity/` project                                                  |
| SvelteKit, TypeScript, Three.js and Threlte                      | `axial-web/apps/web/package.json`; `axial-web/README.md`                                                                                           |
| Search-based opponent                                            | `axial-web/packages/ai/src/classic/lookahead.ts`; `axial-web/packages/ai/src/classic/mcts.ts`; `axial-web/README.md`                               |
| Interactive winning-move tutorial                                | `axial-web/apps/web/src/lib/game/onboarding/practiceGame.ts`; `axial-web/apps/web/src/lib/game/onboarding/welcomeTourSteps.ts`                     |
| Recent control/tutorial/feedback polish                          | `dev/active/axial-improvement-pass/polish-2026-09-21.md`; current UI/onboarding source                                                             |
| Intended public game URL                                         | `dev/active/axial-web-rebuild/deployment.md`; verify deployed behavior before posting                                                              |

Source paths refer to the repository at draft time; the cleanup pass may move historical planning documents. No external post, account change, media capture, deployment or performance claim was made in this drafting pass.

## Unity-to-browser story and later media

The original implementation is a Unity/C# desktop game using the MediaPipe Unity plugin for webcam hand landmarks. `PinchDetector.cs` measures thumb/index-tip distance, smooths it, and uses different pinch/release thresholds plus confirmation frames. `GrabController.cs` follows the pinch point and routes release to `GamePiece.OnPieceReleased`; `RotationController.cs` rotates a held object when the other hand pinches and moves. `HandTracker3D.cs` defaults to `PalmMaxDimension`, estimating depth from normalized palm width/height measured at stable wrist/knuckle landmarks, with position smoothing. This is an estimate from a normal webcam, not measured depth from dedicated hardware.

Those C# files live under `axial-unity/Assets/MediaPipeUnity/Samples/Scenes/Hand Landmark Detection/main/`. `AxialGameController.cs` sends JSON over TCP to the Python server in `main/axial_ai_server.py`, which calls `main/mcts.py`. `Reports/Game_Report.tex` documents the gesture interaction and corresponding design challenges. Source inspection supports the story; Unity was not launched or physically tested in this editorial pass. Avoid implying hand tracking is available in the current browser version.

Current browser rule options are connect four/five and one/two/three completed lines to win, confirmed in `axial-web/packages/core/src/index.ts` and `axial-web/apps/web/src/lib/game/ui/MatchSettingsPanel.svelte`. Requiring multiple lines means the match continues after the first completed line; the draft does not imply clearing pieces or resetting the board between lines.

Caden is considering a separate Unity gameplay clip alongside the later edited browser product video. When capture is requested, a useful Unity sequence is pinch/grab, move over a column, release/drop, then two-hand board rotation. Show the hand input clearly enough to explain the interaction. Keep this as an editorial idea until the Unity runtime and capture setup have been checked; no footage or screenshots were produced here. Do not add “watch the video below” to the post until the actual attachments are chosen.

## Expanded report-based revision

Read `Reports/Game_Report.tex` in full and reviewed the original AI report and implementation. Recovered the actual December 2025 PDFs from the submission archives; they are distinct from the checked-in LaTeX drafts, so recompiling those drafts would not reproduce the submitted PDFs exactly. See `original-report-review.md` for provenance, strongest story points and paper cleanup findings.

The earlier feed-post draft followed the failed measurements → palm-based solution → interaction smoothing story, then original MCTS optimization → browser accessibility → rebuilt interaction and hybrid search → richer game rules. Both Unity and web have substantive space. That earlier draft linked to GitHub LaTeX sources. The current article links to the new local PDF compilations; public PDF hosting remains pending. The existing Drive link points to a submission ZIP.

The earlier standard-post character budget no longer applies: Caden clarified this is a LinkedIn article. The current article expands the original implementation story and links both reports individually. No media attachment language is assumed, and no game or paper code was changed in this editorial pass.

## Confirmed article timeline

Caden finished the original project a while ago but never announced it. He recently revisited it and remade it for the web. The original Unity hand tracking and Python AI are the main body of work to explain; the browser version is the later accessibility-focused continuation. This direct clarification supersedes any earlier framing that made the web rebuild the main project.

## Article revision: clearer analogies and optional tracking visual

Caden marked the browser tutorial/placement-preview sentence and the orbit-versus-placement paragraph as unwanted or needing a rewrite. Both passages were removed; the article now moves from the browser rebuild to game options and the meaningful AI changes. MCTS is explained once in the original-project story. The web passage covers its additional alpha-beta lookahead, bounded position-evaluated rollouts, expanded win objective and browser execution, without repeating the full algorithm.

The tracking explanation now separates two different failures: finger curling changes fingertip/outline measurements; rotation changes their projection onto an image axis. A rotating ruler explains the latter, while an edge-on card explains the remaining foreshortening limitation. Three normalized palm measurements plus the maximum are described as multiple rulers, not a rotation-invariant distance sensor. Hysteresis uses a thermostat analogy; MCTS uses a scratch board; subtree reuse keeps useful notes from the chosen branch.

### Optional visual for a later media pass

Recommendation: one compact explanatory figure placed after the PalmMaxDimension explanation. This is an editorial proposal, not an approved direction or completed media asset.

- **Finger curl, fixed camera distance:** open hand and curled fingers side by side. Mark wrist-to-fingertip distance and the hand outline shrinking, then show the palm anchors being used instead. Caption: “Changing the gesture can look like changing distance.”
- **Rotation within the image, fixed distance:** the same palm/knuckle pair at two roll angles. Show its horizontal span shrinking as its vertical span grows; retain the wrist-to-middle-knuckle measurement. Caption: “One projection can collapse while another remains useful.”
- **The combined estimate:** identify the three actual measurements, normalize each against its own range and select the maximum. Mark this as an illustration of the method, not measured tracking accuracy. Do not draw a perfectly constant output curve through all rotations.
- A small edge-on example or caption can show the remaining limitation: foreshortening can shrink multiple measurements together. Keep in-plane rotation and turning toward an edge-on view distinct.

Prefer real hand frames with accurately placed landmark overlays, or a carefully constructed vector diagram. Avoid using generated hand anatomy or invented numeric readings as evidence. Preserve the source image/clip and make annotations editable. No capture or visual generation happened in this revision; the article reads independently of any future figure.
