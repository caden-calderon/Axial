import { Audio, interpolate, Sequence, staticFile } from "remotion";

// "A Solitary Pulse (Future Garage Motive)" by 9JackJack8 (Pixabay Content License: free to use,
// no attribution required). 130 bpm. The track: a sparse intro, a 16-bar full section from 14.898 s,
// an 8-bar breakdown, a second 16-bar full section (59.205 s) and an outro.
export const MUSIC_SRC = "audio/music/solitary-pulse.mp3";
const BAR_SECONDS = 240 / 130;
const DROP_SECONDS = 14.898;
/** Track time (s) at the start of bar `n`, counted from the first drop. */
const trackBar = (n: number) => DROP_SECONDS + n * BAR_SECONDS;

// The edit, in bars from the first drop: the full section under the twists and how to play, a
// breakdown shortened to four bars (its first two, then the two that build into the second drop)
// under the AI levels, the second drop on "desktop or phone", and the outro under the end card.
// Each piece plays from track time `from`, starting at bar `at` of the edit, until the next piece.
// The first starts with the cut, lined up so its drop lands on bar 0.
const PIECES: { at: number; from: number }[] = [
  { at: 0, from: DROP_SECONDS },
  { at: 18, from: trackBar(22) },
  { at: 23, from: trackBar(40) },
];
/** Length of `bars` bars in frames. */
export const barFrames = (bars: number, fps: number) =>
  Math.round(bars * BAR_SECONDS * fps);

/** Bars (from the first drop) where the edit has to cut. */
export const MUSIC_CUTS = { breakdown: 16, secondDrop: 20, outro: 23 } as const;

const VOLUME = 0.5;
const CROSSFADE = 3; // frames either side of a splice
const FADE_IN = 12;
const FADE_OUT = 75;

/**
 * The music under the whole cut. `drop` is the composition frame of the first drop; `cuts` gives
 * the composition frame of each MUSIC_CUTS cut, and the edit must land each on its bar.
 */
export function checkMusicSync(
  fps: number,
  drop: number,
  cuts: Record<keyof typeof MUSIC_CUTS, number>,
) {
  for (const name of Object.keys(MUSIC_CUTS) as (keyof typeof MUSIC_CUTS)[]) {
    const expected = drop + MUSIC_CUTS[name] * BAR_SECONDS * fps;
    const actual = cuts[name];
    if (Math.abs(actual - expected) > 2) {
      throw new Error(
        `The ${name} cut is at frame ${actual}; the music wants ${Math.round(expected)}`,
      );
    }
  }
}

export const Music: React.FC<{
  fps: number;
  drop: number;
  duration: number;
}> = ({ fps, drop, duration }) => {
  const frameOfBar = (bars: number) =>
    Math.round(drop + bars * BAR_SECONDS * fps);
  return (
    <>
      {PIECES.map((piece, index) => {
        const first = index === 0;
        const last = index === PIECES.length - 1;
        const at = first ? 0 : frameOfBar(piece.at) - CROSSFADE;
        const end = last
          ? duration
          : frameOfBar(PIECES[index + 1].at) + CROSSFADE;
        const from = first
          ? piece.from - drop / fps
          : piece.from - CROSSFADE / fps;
        const length = end - at;
        return (
          <Sequence
            key={index}
            from={at}
            durationInFrames={length}
            layout="none"
          >
            <Audio
              src={staticFile(MUSIC_SRC)}
              trimBefore={Math.round(from * fps)}
              volume={(frame) =>
                VOLUME *
                Math.min(
                  interpolate(
                    frame,
                    [0, first ? FADE_IN : 2 * CROSSFADE],
                    [0, 1],
                    { extrapolateRight: "clamp" },
                  ),
                  interpolate(
                    frame,
                    [length - (last ? FADE_OUT : 2 * CROSSFADE), length],
                    [1, 0],
                    { extrapolateLeft: "clamp" },
                  ),
                )
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};
