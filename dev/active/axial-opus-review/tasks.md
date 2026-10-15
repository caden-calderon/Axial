# Axial Opus review: tasks

## Setup and audits

- [x] Baseline gates at 793e0db (check, lint, 388 unit tests + 43 skipped, build, 67/67 Playwright with system Chrome).
- [x] Frozen engine bundle of 793e0db for head-to-head work.
- [x] Experience audit (A) and engine audit (B), read-only, triaged in `plan.md`.

## Shipped (one commit each, oldest first)

| Commit    | Finding   | Change                                                                      | Visible                            |
| --------- | --------- | --------------------------------------------------------------------------- | ---------------------------------- |
| `d0ec9f1` | L1        | 404 page instead of a 500 for unknown URLs                                  | yes (404 page)                     |
| `ec1c4ac` | L2        | Icon, manifest, preload and theme colour in the initial HTML                | no                                 |
| `53f00b3` | A3        | Last-move pulse settles; idle board stops rendering                         | subtle                             |
| `8481953` | L4/A13    | Desktop framing keeps axis numbers on screen                                | yes                                |
| `6972a1f` | A6        | No transmission pass (≈40% less render CPU, same look)                      | no                                 |
| `7acce7e` | A-x       | Turn indicator holds the result until the line reveal                       | yes                                |
| `9c09b26` | L3/B12    | Type-check and lint core and AI                                             | no                                 |
| `546857e` | B5        | AI decisions within budget on large boards                                  | yes (faster replies on big boards) |
| `19b10ef` | B1/B2/B6  | Fork blocks checked, proven-loss veto, four fixtures, eval certifies search | AI behaviour                       |
| `284dfe2` | B4        | Incremental line counting in the AI search state (1.5–3.7× faster)          | AI thinks deeper in the same time  |
| `eeca874` | B9        | Online moves accepted when behind only on presence                          | online                             |
| `444fa1e` | B8        | Room server stops replaying the match per command/poll                      | online latency                     |
| `e7a0301` | B13       | Room state re-read after credential checks; join race fixed                 | online                             |
| `37218db` | A16       | Welcome tour heading double space                                           | yes (first frame of onboarding)    |
| `d9945d6` | B1        | Instant fork-block replies unless the lookahead proves them lost            | AI timing                          |
| `ce5c044` | A4        | No shader compiles at the first move, the winning line or a new match       | yes (no stutter)                   |
| `660ec4e` | A7        | Drop preview returns after each move, hidden on the opponent's turn         | yes                                |
| `89ed46c` | A9        | Practice reuses the WebGL context                                           | yes (no flash)                     |
| `509ef1e` | A12       | Height numbers on the side edge (desktop/landscape)                         | yes                                |
| `929b7bf` | A1        | Review bar for phones                                                       | yes                                |
| `e77de86` | A8        | Pointing at a stack picks its column                                        | yes (aiming)                       |
| `bbe1d82` | A14       | Turn chip text; button names match their labels                             | no                                 |
| `f1abe07` | A17       | Bottom overlays clear of the home indicator                                 | phones                             |
| `d21c191` | A14       | Size-button names avoid "next"                                              | no                                 |
| `6c6f336` | A18       | No label texture redraws while orbiting                                     | no (smoother orbit)                |
| `900190f` | B8        | Incremental line scoring in core applyMove (replays 8–60× faster)           | no                                 |
| `4d56f52` | A19       | Arrow keys follow the camera                                                | keyboard                           |
| `f5d2c1b` | A10       | Scene loads as its own chunk; UI paints in half the time on phones          | yes (load)                         |
| `d2c4453` | A13       | Landscape phone framing keeps floor numbers on screen                       | yes                                |
| `b91251c` | Codex 1   | Shader warm-up compiles once, not every frame                               | no (perf)                          |
| `5f709ae` | Codex 2   | Empty tiles pickable with the camera below the floor                        | input                              |
| `c7f1db7` | Codex 5   | Height numbers legible at face-on angles                                    | yes                                |
| `6a8730d` | Codex 3/4 | Fork blocks checked at depth 3; refuted block never kept by default         | AI behaviour (Hard stronger)       |

## Remaining

- [x] Codex review (read-only, gpt-6-sol xhigh) of 793e0db..d2c4453; all six findings fixed (see `context.md`).
- [x] Final gate and full Playwright run (see `context.md`).
- Deferred with reasons in `plan.md`: A5 (shared geometries / instancing), B3 (lookahead iteration budgeting), B10, B11, A20, compact landscape confirm bar.
