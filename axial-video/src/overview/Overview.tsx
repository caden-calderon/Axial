import { AbsoluteFill, Series, Sequence } from "remotion";
import { Caption } from "./Caption";
import { Devices } from "./Devices";
import { EndCard } from "./EndCard";
import { at, landings, lineDrawn, resultCardAt, type TakeName } from "./footage";
import { GameSounds } from "./GameSounds";
import { barFrames, checkMusicSync, Music } from "./Music";
import { localLength, Shot, type Push, type Speed } from "./Shot";
import { Title } from "./Title";
import "./theme";

export const FPS = 60;
const s = (seconds: number) => Math.round(seconds * FPS);

// Script: dev/active/axial-cinematic-video/script.md. Spoken lines are Titles (large, over the
// board); control and feature labels are Captions (the game's pill).
type Cue = { at: number; until: number; text: string; accent?: string };
type TitleCue = Cue & { sub?: string; position?: "left" | "centre" | "top"; size?: number; slam?: boolean };

type ShotSegment = {
  kind: "shot";
  id?: string;
  take: TakeName;
  from: number;
  to: number;
  speed?: Speed[];
  push?: Push[];
  kicks?: number[];
  hideChrome?: boolean;
  captions?: Cue[];
  titles?: TitleCue[];
  win?: boolean;
};
type Segment =
  | ShotSegment
  | { kind: "devices"; desktop: { take: TakeName; from: number }; phoneFrom: number; duration: number; title: string; accent?: string; sub: string }
  | { kind: "end"; take: TakeName; from: number; duration: number };

// Retiming, anchored to the take: from source frame `source` play at `rate`, or hold a freeze
// frame at `freeze` for `seconds` and carry on at the rate before it.
type Beat = { source: number; rate: number } | { freeze: number; seconds: number };

/**
 * A shot of `take` from source frame `from` to `to`. `build` receives `local`, which maps a source
 * frame to the frame of this shot it shows at (after retiming), so cues and pushes are written
 * against the take's markers and stay on their actions if a take or its timing changes.
 */
function shot(
  take: TakeName,
  from: number,
  to: number,
  options: { beats?: Beat[]; kick?: boolean } & Omit<ShotSegment, "kind" | "take" | "from" | "to" | "speed" | "kicks"> = {},
  build: (local: (source: number) => number) => Partial<ShotSegment> = () => ({}),
): ShotSegment {
  const speed: Speed[] = [];
  let rate = 1;
  for (const beat of options.beats ?? []) {
    if ("rate" in beat) {
      speed.push({ at: localLength(beat.source - from, speed), rate: beat.rate });
      rate = beat.rate;
    } else {
      const start = localLength(beat.freeze - from, speed);
      speed.push({ at: start, rate: 0 }, { at: start + s(beat.seconds), rate });
    }
  }
  // A win shot must cut before the game's result card starts to cover the board.
  if (options.win && to > resultCardAt(take)) throw new Error(`${take} shot runs into the result card`);
  const local = (source: number) => localLength(source - from, speed);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- beats are consumed above
  const { beats, kick, ...rest } = options;
  const kicks = kick ? landings(take).filter((frame) => frame >= from && frame < to).map(local) : undefined;
  return { kind: "shot", take, from, to, speed: speed.length ? speed : undefined, kicks, ...rest, ...build(local) };
}

const lastLanding = (take: TakeName) => landings(take)[landings(take).length - 1];
// A win shot that ends on its line: the take plays to the moment the line finishes drawing, then
// holds that frame for `seconds` (the result card follows too soon to play on).
const endOnLine = (take: TakeName, seconds: number): Beat => ({ freeze: lineDrawn(take) - 1, seconds });

// Panel shots keep the game's top bar whole: pinned top right at 1.15x the wordmark is off the
// left edge and the turn chip and toolbar stay in frame.
const PANEL_WIDE: Push[] = [{ at: 0, scale: 1.15, focus: [1920, 0] }];
const PANEL_TIGHT: Push[] = [{ at: 0, scale: 1.65, focus: [1920, 0] }];

// Max shows as selected 3.03 s after the modes take's "difficulty" marker (measured from the
// footage; the pointer heads back to Hard straight after), so the levels shot holds that frame
// and cuts there.
const maxSelected = at("desktop-modes", "difficulty", 3.03);

const segments: Segment[] = [
  // 1. What it is. One unbroken shot: square to the front the board reads as a Connect 4 rack; a
  // piece drops, then the camera turns to show the rows behind.
  shot("desktop-reveal", at("desktop-reveal", "drop", -0.45), at("desktop-reveal", "end", -0.4), { kick: true, hideChrome: true }, (local) => ({
    push: [
      { at: 0, scale: 1.32, focus: [760, 560] },
      { at: local(at("desktop-reveal", "reveal", 0.3)), scale: 1.32, focus: [760, 560] },
      { at: local(at("desktop-reveal", "end", -1.2)), scale: 1.18, focus: [900, 580] },
    ],
    titles: [
      { at: local(at("desktop-reveal", "drop", 0.12)), until: local(at("desktop-reveal", "drop", 1.75)), text: "This is Axial.", accent: "Axial" },
      { at: local(at("desktop-reveal", "drop", 1.75)), until: local(at("desktop-reveal", "reveal", 0.9)), text: "Think Connect\u00a04…" },
      { at: local(at("desktop-reveal", "reveal", 0.9)), until: local(at("desktop-reveal", "end", -0.4)), text: "…but in 3D.", accent: "3D" },
    ],
  })),
  // 2. …with a few twists, set up in the settings the way a player would. Each change is cut on its
  // click to a board where it's in play; each line spans both shots (see spanningTitles).
  shot("desktop-twists", at("desktop-twists", "open", -0.4), at("desktop-twists", "board"), { id: "twists-open", push: PANEL_WIDE }),
  shot("desktop-twists", at("desktop-twists", "board"), at("desktop-twists", "board-done", 0.3), {
    id: "bigger",
    push: PANEL_WIDE,
    beats: [{ source: at("desktop-twists", "board"), rate: 2 }],
  }),
  // The 9x9x9 board turning slowly (its settings panel was closed off camera).
  shot("desktop-bigboard", at("desktop-bigboard", "start"), at("desktop-bigboard", "final-move", -0.2), {
    id: "bigger-end",
    hideChrome: true,
    push: [
      { at: 0, scale: 1.14, focus: [960, 600] },
      { at: s(2.2), scale: 1.24, focus: [960, 600] },
    ],
  }),
  shot("desktop-twists", at("desktop-twists", "connect", -0.9), at("desktop-twists", "connect", 0.9), { id: "longer", push: PANEL_TIGHT }),
  shot(
    "desktop-bigboard",
    at("desktop-bigboard", "final-move", -0.25),
    lineDrawn("desktop-bigboard"),
    { id: "longer-end", kick: true, win: true, hideChrome: true, beats: [endOnLine("desktop-bigboard", 1.2)] },
    (local) => ({
      // After the drop the camera swings side-on, where the staircase reads as five in a row.
      push: [
        { at: 0, scale: 1.24, focus: [980, 600] },
        { at: local(at("desktop-bigboard", "line-turn")), scale: 1.24, focus: [980, 600] },
        { at: local(lineDrawn("desktop-bigboard")) + s(0.6), scale: 1.36, focus: [980, 620] },
      ],
    }),
  ),
  // Long enough to see the pointer reach the button and the choice light up.
  shot("desktop-twists", at("desktop-twists", "lines", -1.0), at("desktop-twists", "lines", 1.0), { id: "more", push: PANEL_TIGHT }),
  shot(
    "desktop-multiline",
    at("desktop-multiline", "final-move", -0.25),
    lineDrawn("desktop-multiline"),
    { id: "more-end", kick: true, win: true, hideChrome: true, beats: [endOnLine("desktop-multiline", 1.3)] },
    (local) => ({
      push: [
        { at: 0, scale: 1.18, focus: [1000, 600] },
        { at: local(lineDrawn("desktop-multiline")) + s(0.7), scale: 1.36, focus: [1010, 580] },
      ],
    }),
  ),
  // 3. How you play, on a match already under way.
  shot(
    "desktop-controls",
    at("desktop-controls", "aim", 0.25),
    at("desktop-controls", "zoom", 1.9),
    {
      kick: true,
      hideChrome: true,
      beats: [{ source: at("desktop-controls", "reply", 0.25), rate: 1.4 }, { source: at("desktop-controls", "zoom"), rate: 1 }],
    },
    (local) => ({
      push: [{ at: 0, scale: 1.3, focus: [960, 620] }],
      captions: [
        { at: local(at("desktop-controls", "aim", 0.4)), until: local(at("desktop-controls", "orbit")), text: "Click to drop", accent: "Click" },
        { at: local(at("desktop-controls", "orbit", 0.15)), until: local(at("desktop-controls", "zoom")), text: "Drag to look around", accent: "Drag" },
        { at: local(at("desktop-controls", "zoom")), until: local(at("desktop-controls", "zoom", 1.9)), text: "Scroll to zoom", accent: "Scroll" },
      ],
    }),
  ),
  shot(
    "desktop-match",
    at("desktop-match", "win", -0.6),
    lineDrawn("desktop-match"),
    { id: "staircase", kick: true, win: true, hideChrome: true, beats: [endOnLine("desktop-match", 1.3)] },
    (local) => ({
      push: [
        { at: 0, scale: 1.18, focus: [930, 620] },
        { at: local(lineDrawn("desktop-match")) - s(0.3), scale: 1.2, focus: [930, 610] },
        { at: local(lineDrawn("desktop-match")) + s(0.8), scale: 1.38, focus: [930, 580] },
      ],
      captions: [
        {
          at: local(lastLanding("desktop-match")),
          until: local(lineDrawn("desktop-match")) + s(1.3),
          text: "Lines run across, up or diagonally",
          accent: "across, up or diagonally",
        },
      ],
    }),
  ),
  // 4. Who you play: the opponent switch and the AI's levels (the game only allows these before a
  // match starts). Max holds a moment, then the cut to desktop and phone.
  shot(
    "desktop-modes",
    at("desktop-modes", "modes", -0.1),
    maxSelected,
    {
      id: "levels",
      // A little quick through the opponent switch, real time through the levels, and a beat on
      // Max. Its length puts the cut to desktop and phone on the music's second drop.
      beats: [
        { source: at("desktop-modes", "modes", -0.1), rate: 1.1 },
        { source: at("desktop-modes", "difficulty", -0.2), rate: 1 },
        { freeze: maxSelected - 1, seconds: 0.95 },
      ],
    },
    (local) => ({
      push: [
        { at: 0, scale: 1.0, focus: [960, 540] },
        { at: s(0.55), scale: 1.7, focus: [1920, 0] },
      ],
      titles: [
        {
          at: local(at("desktop-modes", "modes", 0.15)),
          until: local(at("desktop-modes", "difficulty")),
          text: "Play local, online, or against the AI.",
          accent: "local online AI",
          size: 92,
        },
      ],
    }),
  ),
  {
    kind: "devices",
    desktop: { take: "desktop-bigboard", from: at("desktop-bigboard", "result", 1.6) },
    phoneFrom: at("phone-play", "orbit", -0.2),
    duration: barFrames(3, FPS),
    title: "On desktop or phone.",
    accent: "desktop phone",
    sub: "Tap to aim, tap to drop.",
  },
  // 5. Try it.
  { kind: "end", take: "desktop-multiline", from: at("desktop-multiline", "result", 1.3), duration: s(5) },
];

const lengthOfSegment = (segment: Segment) =>
  segment.kind === "shot" ? localLength(segment.to - segment.from, segment.speed) : segment.duration;
export const OVERVIEW_DURATION = segments.reduce((total, segment) => total + lengthOfSegment(segment), 0);

/** Composition frame where the segment with `id` (a shot's id, or "devices" / "end") starts or ends. */
function edgeOf(id: string, edge: "start" | "end"): number {
  let total = 0;
  for (const segment of segments) {
    const length = lengthOfSegment(segment);
    if ((segment.kind === "shot" ? segment.id : segment.kind) === id) return edge === "start" ? total : total + length;
    total += length;
  }
  throw new Error(`No segment "${id}"`);
}

// The music's first drop lands on the cut to the twists; the edit's other section changes sit on
// its bars (Music.tsx).
const MUSIC_DROP = edgeOf("twists-open", "start");
checkMusicSync(FPS, MUSIC_DROP, {
  breakdown: edgeOf("levels", "start"),
  secondDrop: edgeOf("devices", "start"),
  outro: edgeOf("end", "start"),
});

/** Composition frame where source frame `source` of the shot with `id` shows, after retiming. */
function frameOf(id: string, source: number): number {
  const segment = segments.find((candidate) => candidate.kind === "shot" && candidate.id === id) as ShotSegment;
  return edgeOf(id, "start") + localLength(source - segment.from, segment.speed);
}

// Lines that run across cuts.
const twist = (id: string, text: string, accent: string, sub: string): TitleCue => ({
  at: edgeOf(id, "start") + s(0.05),
  until: edgeOf(`${id}-end`, "end"),
  text,
  accent,
  sub,
  slam: true,
});
const spanningTitles: (TitleCue & { pill?: boolean })[] = [
  { at: edgeOf("twists-open", "start") + s(0.2), until: edgeOf("twists-open", "end"), text: "…with a few twists.", accent: "twists" },
  twist("bigger", "Bigger boards.", "Bigger", "Up to 10 × 10 × 10"),
  twist("longer", "Longer lines.", "Longer", "Connect 4 or 5"),
  twist("more", "More lines to win.", "More lines", "First to 1, 2 or 3 lines"),
  { at: frameOf("levels", at("desktop-modes", "difficulty", 0.05)), until: edgeOf("levels", "end"), text: "Four levels, Easy to Max", accent: "Four levels", pill: true },
];

const TitleAt: React.FC<{ cue: TitleCue }> = ({ cue }) => (
  <Sequence from={cue.at} durationInFrames={cue.until - cue.at} layout="none">
    <Title text={cue.text} accent={cue.accent} sub={cue.sub} duration={cue.until - cue.at} position={cue.position} size={cue.size} slam={cue.slam} />
  </Sequence>
);

export const Overview: React.FC = () => (
  <AbsoluteFill style={{ background: "#06070f" }}>
    <Music fps={FPS} drop={MUSIC_DROP} duration={OVERVIEW_DURATION} />
    <Series>
      {segments.map((segment, index) => {
        const length = lengthOfSegment(segment);
        return (
          <Series.Sequence key={index} durationInFrames={length}>
            {segment.kind === "shot" ? (
              <>
                <Shot
                  take={segment.take}
                  from={segment.from}
                  push={segment.push}
                  speed={segment.speed}
                  kicks={segment.kicks}
                  hideChrome={segment.hideChrome}
                />
                <GameSounds take={segment.take} from={segment.from} to={segment.to} winOnLastMove={segment.win} speed={segment.speed} />
                {segment.captions?.map((cue) => (
                  <Sequence key={cue.text} from={cue.at} durationInFrames={cue.until - cue.at} layout="none">
                    <Caption text={cue.text} accent={cue.accent} duration={cue.until - cue.at} />
                  </Sequence>
                ))}
                {segment.titles?.map((cue) => <TitleAt key={cue.text} cue={cue} />)}
              </>
            ) : segment.kind === "devices" ? (
              <>
                <Devices
                  desktop={segment.desktop}
                  phoneFrom={segment.phoneFrom}
                  duration={segment.duration}
                  title={segment.title}
                  accent={segment.accent}
                  sub={segment.sub}
                />
                <GameSounds take="phone-play" from={segment.phoneFrom} to={segment.phoneFrom + segment.duration} />
              </>
            ) : (
              <EndCard take={segment.take} from={segment.from} />
            )}
          </Series.Sequence>
        );
      })}
    </Series>
    {spanningTitles.map((cue) =>
      cue.pill ? (
        <Sequence key={cue.text} from={cue.at} durationInFrames={cue.until - cue.at} layout="none">
          <Caption text={cue.text} accent={cue.accent} duration={cue.until - cue.at} />
        </Sequence>
      ) : (
        <TitleAt key={cue.text} cue={cue} />
      ),
    )}
  </AbsoluteFill>
);
