# Original project (2025)

Axial was first built as a single project for two courses at once: CS462 (Game Design) and CS440 (Artificial Intelligence). The game was a Unity desktop application on a 6×6×7 board, played with hand-tracking gestures through MediaPipe against a Monte Carlo tree search opponent served by Python.

**[Gameplay video](https://youtu.be/uuLK-gQ7Y54)**

| File                                                 | Contents                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`proposal.md`](proposal.md)                         | The original proposal. It planned an AR headset and minimax search; the build moved to a desktop app with MCTS |
| [`reports/Game_Report.tex`](reports/Game_Report.tex) | Game design report: gameplay, hand-tracking controls, UX, and playtesting (CS462)                              |
| [`reports/AI_Report.tex`](reports/AI_Report.tex)     | AI report: MCTS, threat detection, Numba optimization, and evaluation (CS440)                                  |

Compiled PDFs of both reports are in [`docs/papers/`](../../docs/papers/README.md), along with a note on where the AI PDF and its LaTeX source disagree. The AI engine described in the reports is in [`../python-ai/engine/`](../python-ai/engine/).
