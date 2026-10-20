import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/**
 * A short control or feature label styled like the game's turn chip. `accent` words are tinted.
 * Lives inside a Sequence; fades out over its last few frames.
 */
export const Caption: React.FC<{
  text: string;
  accent?: string;
  duration: number;
  position?: "bottom" | "top" | "left";
  size?: number;
}> = ({ text, accent, duration, position = "bottom", size = 52 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 14,
  });
  const exit = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const parts = accent ? text.split(accent) : [text];
  const placement: React.CSSProperties =
    position === "top"
      ? { top: 110, left: 0, right: 0, justifyContent: "center" }
      : position === "left"
        ? { top: 0, bottom: 0, left: 120, alignItems: "center" }
        : { bottom: 84, left: 0, right: 0, justifyContent: "center" };
  return (
    <div style={{ position: "absolute", display: "flex", ...placement }}>
      <div
        style={{
          opacity: enter * exit,
          transform: `translateY(${(1 - enter) * 18}px)`,
          padding: `${size * 0.42}px ${size * 0.8}px`,
          borderRadius: 999,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          backdropFilter: "blur(18px)",
          color: theme.text,
          fontFamily: theme.font,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        {parts[0]}
        {accent && parts.length > 1 ? (
          <>
            <span style={{ color: theme.accent }}>{accent}</span>
            {parts[1]}
          </>
        ) : null}
      </div>
    </div>
  );
};
