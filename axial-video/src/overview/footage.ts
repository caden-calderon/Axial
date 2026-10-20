// Recorded takes (scripts/record.mjs) and the labelled frames each take marked while recording.
import ai from "../../public/footage/desktop-ai.markers.json";
import controls from "../../public/footage/desktop-controls.markers.json";
import modes from "../../public/footage/desktop-modes.markers.json";
import reveal from "../../public/footage/desktop-reveal.markers.json";
import match from "../../public/footage/desktop-match.markers.json";
import twists from "../../public/footage/desktop-twists.markers.json";
import bigboard from "../../public/footage/desktop-bigboard.markers.json";
import multiline from "../../public/footage/desktop-multiline.markers.json";
import phone from "../../public/footage/phone-play.markers.json";

type Markers = {
  fps: number;
  frames: number;
  viewport: { width: number; height: number };
  markers: { label: string; frame: number }[];
};

export const TAKES = {
  "desktop-reveal": reveal,
  "desktop-controls": controls,
  "desktop-match": match,
  "desktop-modes": modes,
  "desktop-ai": ai,
  "desktop-twists": twists,
  "desktop-bigboard": bigboard,
  "desktop-multiline": multiline,
  "phone-play": phone,
} satisfies Record<string, Markers>;

export type TakeName = keyof typeof TAKES;

/** Source frame of the nth occurrence of `label` in a take, shifted by `offset` seconds. */
export function at(take: TakeName, label: string, offset = 0, occurrence = 0): number {
  const data: Markers = TAKES[take];
  const hits = data.markers.filter((marker) => marker.label === label);
  const hit = hits[occurrence];
  if (!hit) throw new Error(`No marker "${label}" #${occurrence} in ${take}`);
  return Math.max(0, Math.round(hit.frame + offset * data.fps));
}

export const lengthOf = (take: TakeName) => TAKES[take].frames;

type LoggedMove = { frame: number; row: number; col: number; height: number; player: 1 | 2 };

// Mirrors the game's timing (apps/web/src/lib/game/animation.ts): a piece lands after its drop;
// the completed line finishes drawing after the impact settles.
const IMPACT_SECONDS = 0.18;
const LINE_DRAW_SECONDS = 0.72 + 0.24;
const dropSeconds = (boardHeight: number, height: number) =>
  Math.min(0.5, Math.max(0.26, 0.17 + Math.sqrt(Math.max(1, boardHeight - height)) * 0.11));

export function movesOf(take: TakeName): LoggedMove[] {
  return ((TAKES[take] as { moves?: LoggedMove[] }).moves ?? []) as LoggedMove[];
}

/** Source frames where each recorded move's piece lands, in order. */
export function landings(take: TakeName): number[] {
  const data = TAKES[take] as { fps: number; match?: { dimensions: { height: number } } | null };
  const boardHeight = data.match?.dimensions.height ?? 6;
  return movesOf(take).map((move) => move.frame + Math.round(dropSeconds(boardHeight, move.height) * data.fps));
}

/** Source frame where the winning line (completed by the take's last move) finishes drawing. */
export function lineDrawn(take: TakeName): number {
  const all = landings(take);
  if (!all.length) throw new Error(`${take} has no moves`);
  const last = all[all.length - 1];
  return last + Math.round((IMPACT_SECONDS + LINE_DRAW_SECONDS) * TAKES[take].fps);
}

// apps/web/src/lib/game/animation.ts GAME_OVER_MODAL_DELAY_MS: the result card starts to fade in
// this long after the winning move, covering the board.
const RESULT_CARD_SECONDS = 0.5 + 0.18 + 0.72 + 0.24 + 0.12;

/** Source frame where the result card starts to appear after the take's winning (last) move. */
export function resultCardAt(take: TakeName): number {
  const moves = movesOf(take);
  if (!moves.length) throw new Error(`${take} has no moves`);
  return moves[moves.length - 1].frame + Math.round(RESULT_CARD_SECONDS * TAKES[take].fps);
}
