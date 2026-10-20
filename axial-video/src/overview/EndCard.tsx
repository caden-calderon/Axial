import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TakeName } from "./footage";
import { Shot } from "./Shot";
import { theme } from "./theme";

/** Closing card over a final board still turning: the wordmark as the game sets it, and where to play. */
export const EndCard: React.FC<{ take: TakeName; from: number }> = ({
  take,
  from,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dim = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lead = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const mark = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });
  // Background position runs 100% → 0%, moving the gradient's accent band left to right.
  const shine = interpolate(frame, [24, 204], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const url = spring({
    frame: frame - 24,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  return (
    <AbsoluteFill style={{ fontFamily: theme.font }}>
      <Shot
        take={take}
        from={from}
        push={[
          { at: 0, scale: 1.12, focus: [960, 560] },
          { at: 600, scale: 1.24, focus: [960, 560] },
        ]}
      />
      <AbsoluteFill
        style={{
          opacity: dim,
          background: `radial-gradient(ellipse 70% 65% at 50% 50%, rgba(6, 7, 15, 0.8), rgba(6, 7, 15, 0.95))`,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: theme.text,
        }}
      >
        <div
          style={{
            opacity: lead,
            transform: `translateY(${(1 - lead) * 16}px)`,
            fontSize: 64,
            fontWeight: 650,
            letterSpacing: "-0.02em",
          }}
        >
          Try it out today.
        </div>
        <div
          style={{
            opacity: mark,
            transform: `scale(${1.12 - mark * 0.12})`,
            marginTop: 40,
            fontSize: 150,
            fontWeight: 300,
            letterSpacing: "0.32em",
            marginRight: "-0.32em",
          }}
        >
          <span
            style={{
              // The game's wordmark: one colour, with the accent shining across it once it lands.
              color: "transparent",
              backgroundImage: `linear-gradient(108deg, ${theme.brand} 0%, ${theme.brand} 38%, ${theme.accent} 50%, ${theme.brand} 62%, ${theme.brand} 100%)`,
              backgroundSize: "300% 100%",
              backgroundPosition: `${shine}% 0`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            AXIAL
          </span>
        </div>
        <div
          style={{
            opacity: url,
            transform: `translateY(${(1 - url) * 14}px)`,
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 58, fontWeight: 650, color: theme.accent }}>
            playaxial.dev
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 36,
              fontWeight: 500,
              color: theme.muted,
            }}
          >
            Free in your browser.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
