import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/**
 * A spoken line of the script set large over the live board: it rises in word by word and fades
 * out over its last frames. `accent` words are tinted; `sub` is a smaller muted line beneath.
 * `slam` lands the whole line at once from slightly larger, for quick beats. No scrim or shadow:
 * the type sits straight on the board. Lives inside a Sequence.
 */
export const Title: React.FC<{
  text: string;
  accent?: string;
  sub?: string;
  duration: number;
  position?: "left" | "centre" | "top" | "top-left";
  size?: number;
  slam?: boolean;
}> = ({
  text,
  accent,
  sub,
  duration,
  position = "left",
  size = 104,
  slam = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentWords = new Set(accent?.split(" ") ?? []);
  const words = text.split(" ");
  const stagger = slam ? 0 : 3;
  const subIn = spring({
    frame: frame - words.length * stagger - 6,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const land = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 260, mass: 0.6 },
  });

  const placement: React.CSSProperties =
    position === "centre"
      ? {
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }
      : position === "top"
        ? {
            top: 120,
            left: 0,
            right: 0,
            justifyContent: "center",
            textAlign: "center",
          }
        : position === "top-left"
          ? { top: 84, left: 150 }
          : { top: 0, bottom: 0, left: 130, width: 940, alignItems: "center" };

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        ...placement,
        opacity: exit,
      }}
    >
      <div
        style={{
          position: "relative",
          fontFamily: theme.font,
          color: theme.text,
          transform: slam ? `scale(${1.18 - 0.18 * land})` : undefined,
          transformOrigin: position === "left" ? "0 50%" : "50% 50%",
        }}
      >
        <div
          style={{
            fontSize: size,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.04,
          }}
        >
          {words.map((word, index) => {
            const rise = slam
              ? Math.min(1, frame / 4)
              : spring({
                  frame: frame - index * stagger,
                  fps,
                  config: { damping: 200 },
                  durationInFrames: 16,
                });
            return (
              <span
                key={index}
                style={{
                  display: "inline-block",
                  opacity: rise,
                  transform: slam
                    ? undefined
                    : `translateY(${(1 - rise) * 0.32 * size}px)`,
                  color: accentWords.has(word.replace(/[.,…]/g, ""))
                    ? theme.accent
                    : undefined,
                  marginRight: "0.24em",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        {sub ? (
          <div
            style={{
              marginTop: size * 0.28,
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 14}px)`,
              fontSize: size * 0.4,
              fontWeight: 550,
              color: theme.muted,
              letterSpacing: "-0.01em",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
