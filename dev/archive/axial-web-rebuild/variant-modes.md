# Variant Axial Design Notes

## Direction

Keep `Classic` as the clean base game and add replayability through optional `Tactical` variants. Variant rules should sit behind match config instead of changing the default board rules.

## Principles

- Special pieces are limited, visible, deterministic resources.
- Both players should know the active loadout before the match starts.
- Classic rules remain available and unmodified.
- Special-piece effects should avoid stealing, swapping, or deleting existing pieces unless explicitly approved later.
- A variant turn may contain multiple sub-actions; replay should preserve those sub-actions explicitly, even when the UI presents them as one tactical combo.

## Loadout Models

- `Fixed`: both players get the same three special pieces.
- `Random`: each match deals a mirrored three-piece kit from the available pool.
- `Draft`: players alternate picking from a shared pool before the match.
- `Constructed`: players choose a three-piece kit before the match.

Current implementation uses a fixed Tactical kit with two Blocker Combos and one Double Adjacent per player. Add editable loadouts, then consider `Random` or `Draft` after at least one more special exists and the rule engine is stable.

## Current Strong Candidates

### Blocker Combo

A player spends one Blocker Combo charge to place a neutral blocker first, then places a normal piece in the same turn.

- Blocker placement uses gravity unless a later variant says otherwise.
- Blockers occupy cells and break connection lines.
- Blockers do not belong to either player.
- The normal piece resolves after the blocker, so the blocker can affect the normal drop if placed in the same column.
- Current implementation gives each player two Blocker Combo charges per match.
- Current replay history records the blocker and regular piece as explicit ordered placements so undo/redo and future AI training can consume the exact action stream.

### Double Adjacent

A player places one normal gravity piece, then places a second normal gravity piece whose final landing cell is adjacent to the first piece.

- Adjacency should use the 26 neighboring cells in 3D.
- The second piece may be vertical, horizontal, planar-diagonal, or 3D-diagonal relative to the first.
- The second piece still obeys gravity; legality is based on the final dropped cell, not just the chosen column.
- Current implementation gives each player one Double Adjacent charge, records both sub-actions with `double-adjacent` metadata, and filters the second-step board picker to legal adjacent landings.
- If the first Double Adjacent piece wins, the match ends immediately and the second piece is not required.

### Phase Piece

An owned non-gravity piece placed directly into an empty cell to set up future structure.

- It counts as the owner's piece for lines.
- It does not support lower falling pieces.
- Gravity drops ignore it until a falling piece would naturally reach that height.
- Once the natural stack reaches the phase piece's height, that cell is occupied and future drops settle above it.

## Candidate Pool To Explore

- `Blocker Combo`: neutral blocker plus normal placement.
- `Double Adjacent`: second owned piece must land adjacent to the first.
- `Phase Piece`: owned floating setup piece.
- `Bridge`: neutral support cell that future pieces can land on.
- `Cap`: owned top-only piece that can only be placed on the highest occupied cell of a column.
- `Shield`: owned piece that cannot be affected by later tactical effects.
- `Wild Column`: place in any legal column on a chosen board edge.
- `Gravity Drill`: one owned piece can pass through exactly one blocker in its column.

## Implementation Notes

- Introduce match config before adding tactical rules.
- Preserve the existing `Move` shape for classic moves.
- `BLOCKER_CELL = 3` is now a neutral occupied cell in core. `applyMove` remains the Classic owned-piece path, and `applyBlocker` is the first Tactical primitive.
- Replay actions preserve `kind: "piece" | "blocker"` plus optional special metadata so undo/redo does not convert blockers into owned pieces or alternate players during Double Adjacent.
- Turn-time Tactical actions are available from a `Pieces` mode in the top-right control pill; the dropdown switches between normal setup/status and piece details based on the active toolbar mode.
- Keep win detection generic over cell ownership and blocker cells before adding many pieces.
- Add golden tests for every special piece before expanding the scene behavior.
