import { Audio, Sequence, staticFile } from "remotion";
import { landings, lineDrawn, movesOf, type TakeName } from "./footage";
import { localLength, type Speed } from "./Shot";

/**
 * The game's own impact and win sounds for the moves visible in source frames [from, to) of a
 * take, placed where they land under the shot's `speed`.
 */
export const GameSounds: React.FC<{
  take: TakeName;
  from: number;
  to: number;
  winOnLastMove?: boolean;
  speed?: Speed[];
}> = ({ take, from, to, winOnLastMove = false, speed }) => {
  const moves = movesOf(take);
  const cues: { at: number; src: string }[] = landings(take).map(
    (at, index) => ({
      at,
      src: `audio/impact-p${moves[index].player}-h${Math.min(9, moves[index].height)}.wav`,
    }),
  );
  const last = moves[moves.length - 1];
  if (winOnLastMove && last)
    cues.push({ at: lineDrawn(take), src: `audio/win-p${last.player}.wav` });
  return (
    <>
      {cues
        .filter((cue) => cue.at >= from && cue.at < to)
        .map((cue) => (
          <Sequence
            key={`${cue.at}-${cue.src}`}
            from={localLength(cue.at - from, speed)}
            layout="none"
          >
            <Audio src={staticFile(cue.src)} />
          </Sequence>
        ))}
    </>
  );
};
