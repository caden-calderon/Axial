# Engineering notes

The active product lives in [`axial-web/`](../axial-web/). Start with its [engineering guide](../axial-web/README.md) for setup, architecture, and commands.

These are the working notes from each development pass: plans, design decisions, audits, and the verification evidence recorded at the time. Every pass listed here is finished, so the notes sit under `archive/`; work in progress uses `active/<task>/`. Dates and scope matter when reading them: test counts, branch names, deployment details, and "remaining work" items describe the state on the day they were written, not the current repository.

## Where to start

| Topic                                                                                | Notes                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [Classic AI research](archive/axial-web-rebuild/classic-ai-research.md)              | Why the browser AI is a hybrid search, and what the preserved Python baselines showed |
| [Classic AI overhaul](archive/axial-classic-ai-overhaul/plan.md)                     | Search architecture, challenge suites, difficulty ladder, and evaluation method       |
| [Multiplayer architecture](archive/axial-web-rebuild/multiplayer.md)                 | Private-room protocol and the server-authoritative Durable Object design              |
| [Multiplayer recovery](archive/axial-improvement-pass/multiplayer.md)                | Reconnect, stale revisions, and terminal-error handling                               |
| [Room resource policy](archive/axial-announcement-readiness/room-resource-policy.md) | Room-creation rate limits and expired-room cleanup                                    |
| [Deployment](archive/axial-web-rebuild/deployment.md)                                | Cloudflare Pages and Worker configuration, with dated operational history             |
| [Variant rules](archive/axial-web-rebuild/variant-modes.md)                          | Design notes for the Tactical ruleset that is still marked Coming soon                |

## Development passes

Newest first.

| Pass                                                                   | Date           | Scope                                                                                                                         |
| ---------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [Overview video](archive/axial-cinematic-video/script.md)              | October 2026   | The announcement video: a frame-exact recorder for the real game, the Remotion edit, seven review cuts, and the music conform |
| [Opus review](archive/axial-opus-review/plan.md)                       | October 2026   | Two parallel audits (experience and engine), triage, 29 implementation commits, and before/after AI evidence                  |
| [Announcement readiness](archive/axial-announcement-readiness/plan.md) | September 2026 | Code, dependency, and repository reviews before the public announcement                                                       |
| [Improvement pass](archive/axial-improvement-pass/plan.md)             | September 2026 | Rules and AI correctness, game feel, input, audio, multiplayer recovery, and playtest polish                                  |
| [Classic AI overhaul](archive/axial-classic-ai-overhaul/context.md)    | July 2026      | Rebuilt search, machine challenge evaluation, and difficulty presets                                                          |
| [AI and mobile review](archive/axial-ai-mobile-review/context.md)      | July 2026      | Difficulty ladder honesty, custom-rule correctness, and portrait controls                                                     |
| [UI pass](archive/axial-ui-pass/context.md)                            | July 2026      | Interface redesign and visual decisions                                                                                       |
| [Web rebuild](archive/axial-web-rebuild/context.md)                    | May–June 2026  | The port from Unity/Python to the browser, the original architecture, and multiplayer foundations                             |

Within each pass, `plan.md` holds the decisions, `tasks.md` the checklist, and `context.md` the running state. Audit and review files record findings with their disposition.

## Paths in older notes

The repository was reorganized in October 2026. Notes written before then use the old paths:

| Old path                      | Current path                           |
| ----------------------------- | -------------------------------------- |
| `dev/active/<pass>/`          | `dev/archive/<pass>/`                  |
| `main/`                       | `archive/python-ai/engine/`            |
| `Training/`                   | `archive/python-ai/training/`          |
| `Old/`                        | `archive/python-ai/legacy/`            |
| `pyproject.toml`, `uv.lock`   | `archive/python-ai/`                   |
| `Reports/`                    | `archive/original-project/reports/`    |
| `Context/Project Proposal.md` | `archive/original-project/proposal.md` |

Commands such as `uv run --python 3.12 python main/test_simple.py` now run from `archive/python-ai/` as `uv run python engine/test_simple.py`. Drafts for the announcement article and social posts are not part of the repository.
