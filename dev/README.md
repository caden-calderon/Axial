# Engineering notes

The active product lives in [`axial-web/`](../axial-web/). Start with its [engineering guide](../axial-web/README.md) for current setup, architecture, and commands. These notes preserve decisions and verification evidence; dates and scope matter when interpreting test counts, branch names, deployment state, and remaining work.

## Current work

[Opus review](active/axial-opus-review/) is a review-and-improve pass over the whole codebase after the announcement work (October 2026):

- [Plan](active/axial-opus-review/plan.md): triage of both audits, decisions, deferrals and proposals for Caden.
- [Tasks](active/axial-opus-review/tasks.md): every shipped commit and what it changes.
- [Context](active/axial-opus-review/context.md): environment notes, baseline gates and before/after AI evidence.
- Audit summaries: [experience](active/axial-opus-review/audit-experience.md) and [engine](active/axial-opus-review/audit-engine.md).

## Announcement readiness

[Announcement readiness](active/axial-announcement-readiness/) was the September review and polish pass:

- [Plan](active/axial-announcement-readiness/plan.md): scope and review approach.
- [Context](active/axial-announcement-readiness/context.md): current state and handoff.
- [Tasks](active/axial-announcement-readiness/tasks.md): completed and outstanding work.
- [Repository review](active/axial-announcement-readiness/repository-review.md): recruiter-facing documentation, public GitHub metadata, and proposed cleanup.
- [Code review](active/axial-announcement-readiness/code-review.md): confirmed fixes and remaining multiplayer policy decisions.
- [Dependency review](active/axial-announcement-readiness/dependency-review.md): compatible security updates and remaining upstream advisories.
- [LinkedIn article](active/axial-announcement-readiness/linkedin-article.md): original Unity hand tracking and AI, followed by the browser rebuild.
- [Social drafts](active/axial-announcement-readiness/social-post-drafts.md): article publishing notes and X/Instagram text.
- [Original reports](active/axial-announcement-readiness/original-report-review.md): recovered PDFs, source evidence and paper review findings.
- [Verification](active/axial-announcement-readiness/verification.md): current local gates and remaining release decisions.
- [Room resource policy](active/axial-announcement-readiness/room-resource-policy.md): creation limits and expired-room cleanup chosen after Caden delegated the decisions.

## Earlier work

The folders below retain their original paths for existing links. Their `active/` location does not make every recorded issue or deployment detail current.

| Notes                                                                                 | Purpose                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Improvement pass](active/axial-improvement-pass/context.md)                          | Rules/AI corrections, input and scene behavior, multiplayer recovery, and subsequent interface polish |
| [September 21 polish](active/axial-improvement-pass/polish-2026-09-21.md)             | Detailed onboarding, typography, controls, and compact-layout work                                    |
| [September 21 merge review](active/axial-improvement-pass/merge-review-2026-09-21.md) | Findings captured before the announcement-readiness pass; consult current tasks for disposition       |
| [Classic AI overhaul](active/axial-classic-ai-overhaul/context.md)                    | Search architecture, challenge evaluation, and difficulty work                                        |
| [AI and mobile review](active/axial-ai-mobile-review/context.md)                      | Earlier AI and portrait-layout review                                                                 |
| [UI pass](active/axial-ui-pass/context.md)                                            | Earlier interface work and visual decisions                                                           |
| [Web rebuild](active/axial-web-rebuild/context.md)                                    | Browser rebuild, original architecture, and historical verification                                   |
| [Multiplayer architecture](active/axial-web-rebuild/multiplayer.md)                   | Private-room protocol and server/client design history                                                |
| [Deployment notes](active/axial-web-rebuild/deployment.md)                            | Hosting configuration and dated operational evidence; verify live state before release                |
| [Original AI research](active/axial-web-rebuild/classic-ai-research.md)               | Preserved Python baselines and rationale for browser AI direction                                     |

The original academic background and reports remain in [`Context/`](../Context/) and [`Reports/`](../Reports/). They describe the Unity/Python project, not the current browser product.
