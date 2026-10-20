# PDF build notes

Status: both requested LaTeX sources compiled to readable local PDFs; all 29 rendered pages visually checked. No hosting or publication performed.

## Deliverables

- `output/pdf/Game_Report.pdf`: 15 pages, compiled from `Reports/Game_Report.tex`.
- `output/pdf/AI_Report.pdf`: 14 pages, compiled from `Reports/AI_Report.tex`.

These are new compilations of the checked-in LaTeX sources, not copies of the recovered submission PDFs. The original `axial-original-game-report.pdf` and `axial-original-ai-report.pdf` remain byte-for-byte unchanged. Differences between those original submissions and the checked-in sources are recorded in `original-report-review.md`.

The new compilations are now reference alternatives. Caden selected the archived original pair after reviewing the differences. The article links to the numbered original PDFs in `output/pdf/axial-papers/`; that folder also contains a version guide and the alternate compilations. Replace the local article destinations with public PDF URLs when publishing is authorized; no public PDF URLs have been created.

## Source changes

- Replaced dynamic `\today` dates with December 11, 2025 for the game report and December 2025 for the AI report, matching the recovered historical dates.
- Kept hyperlinks functional while removing colored link-border rectangles (`hidelinks`).
- Added `array` and ragged-right paragraph columns to the game report's two wrapping tables, removing stretched word spacing.
- Wrapped the AI report's two text diagrams in minipages to keep each complete diagram on one page.

No narrative, equations, numerical results, bibliography entries, or code-listing content was rewritten. A reverse-normalization check against `git show HEAD:Reports/<name>.tex` verified that dates and the listed formatting changes account for the entire source diff. This conversion does not resolve the historical technical discrepancies noted in `original-report-review.md` or independently validate the reported benchmarks.

## Build

Compiled with Tectonic 0.17.0, downloaded from the official tectonic-typesetting/tectonic GitHub release into `/tmp/axial-tex-tools/`; no system or project dependency was installed.

From the repository root, with `tectonic` available:

```bash
tectonic --outdir output/pdf Reports/Game_Report.tex
tectonic --outdir output/pdf Reports/AI_Report.tex
```

The current local binary is `/tmp/axial-tex-tools/tectonic`. Tectonic automatically reruns LaTeX to resolve cross-references.

## Verification

- Both builds exited successfully.
- Rendered every page using Poppler at 1700-pixel resolution and inspected the full-document contact sheets, including tables, diagrams, equations, listings, page numbers and references.
- Fixed split AI diagrams and the game tables' spacing after the first visual pass, then rebuilt and inspected the final renderings.
- Final TeX logs contain no overfull/underfull boxes, undefined references, or missing-character warnings.
- Extracted text contains neither replacement glyphs nor unresolved `??` references. Margin checks found only ordinary footer page numbers in the outer margin area.
- The AI build emits a UTF-8 warning in the bundled `algorithm.sty`; no replacement character appears in the output, and its rendered algorithm was checked. The static binary also emits host Fontconfig warnings; embedded document fonts rendered correctly.
- Verified both archived originals retain their previously recorded SHA-256 hashes.

Scratch logs and rendered pages are under `/tmp/axial-tex-tools/` and `/tmp/axial-pdf-review/`, outside deliverables.

## Final PDF checksums

- `Game_Report.pdf`: `99dfc5de51a81e9d00f211ffc754ec1d81441fb111a4a2b07d5ce020a546df48`
- `AI_Report.pdf`: `a0b9ac230601c767e15a5c2b4be4dbf2a783cb6a0333fa38985f86ae03a3b399`
