import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "./Backdrop";
import type { TakeName } from "./footage";
import { Title } from "./Title";
import { theme } from "./theme";

/**
 * The same game on both screens: a desktop take in a browser window and the phone take in a
 * device outline, side by side under the line they illustrate.
 */
export const Devices: React.FC<{
  desktop: { take: TakeName; from: number };
  phoneFrom: number;
  duration: number;
  title: string;
  accent?: string;
  sub: string;
}> = ({ desktop, phoneFrom, duration, title, accent, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const windowIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 140 },
  });
  const phoneIn = spring({
    frame: frame - 6,
    fps,
    config: { damping: 18, stiffness: 140 },
  });
  const out = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = interpolate(frame, [0, duration], [0, 1]);

  const windowWidth = 1120;
  const windowHeight = (windowWidth * 9) / 16;
  const phoneHeight = 780;
  const phoneWidth = (phoneHeight * 414) / 736;
  const frameStyle: React.CSSProperties = {
    position: "absolute",
    background: "#0b0d14",
    border: "2px solid rgba(237, 247, 242, 0.14)",
    boxShadow: "0 40px 120px rgba(0, 0, 0, 0.6)",
  };

  return (
    <AbsoluteFill>
      <Backdrop />
      <div
        style={{
          ...frameStyle,
          left: 130,
          top: 300 - drift * 12,
          width: windowWidth + 16,
          height: windowHeight + 46,
          padding: "38px 8px 8px",
          borderRadius: 22,
          opacity: windowIn * out,
          transform: `translateX(${(1 - windowIn) * -140}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 18,
            display: "flex",
            gap: 9,
          }}
        >
          {[0, 1, 2].map((dot) => (
            <div
              key={dot}
              style={{
                width: 11,
                height: 11,
                borderRadius: 99,
                background: "rgba(237, 247, 242, 0.18)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: 9,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: theme.font,
            fontSize: 17,
            color: theme.muted,
          }}
        >
          playaxial.dev
        </div>
        <div
          style={{
            width: windowWidth,
            height: windowHeight,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <OffthreadVideo
            src={staticFile(`footage/${desktop.take}.mp4`)}
            trimBefore={desktop.from}
            muted
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
      <div
        style={{
          ...frameStyle,
          left: 1360,
          top: 236 + drift * 12,
          width: phoneWidth + 24,
          height: phoneHeight + 24,
          padding: 12,
          borderRadius: 56,
          opacity: phoneIn * out,
          transform: `translateY(${(1 - phoneIn) * 160}px)`,
        }}
      >
        <div
          style={{
            width: phoneWidth,
            height: phoneHeight,
            borderRadius: 44,
            overflow: "hidden",
          }}
        >
          <OffthreadVideo
            src={staticFile("footage/phone-play.mp4")}
            trimBefore={phoneFrom}
            muted
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
      <Title
        text={title}
        accent={accent}
        sub={sub}
        duration={duration}
        position="top-left"
        size={84}
      />
    </AbsoluteFill>
  );
};
