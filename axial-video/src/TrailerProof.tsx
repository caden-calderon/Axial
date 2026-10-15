import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

loadFont({
  family: "Axial UI",
  url: staticFile("fonts/InterVariable.woff2"),
  weight: "100 900",
});

const clips = [
  { move: 11, from: 0, duration: 69 },
  { move: 12, from: 69, duration: 69 },
  { move: 13, from: 138, duration: 69 },
  { move: 14, from: 207, duration: 69 },
  { move: 15, from: 276, duration: 99 },
] as const;

const BoardFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070f" }}>
      <AbsoluteFill
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(180deg, rgba(9,8,17,.44) 0%, transparent 35%, transparent 80%, rgba(9,8,17,.36) 100%)"
            : "linear-gradient(180deg, rgba(9,8,17,.32) 0%, transparent 42%, rgba(9,8,17,.18) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

const TitleReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;

  return (
    <AbsoluteFill>
      <Img
        src={staticFile("footage/opening/win-hold.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: portrait ? "contain" : "cover",
          scale: portrait ? 1.75 : 1.12,
          translate: portrait ? undefined : "0 -95px",
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(7,7,15,.36), rgba(7,7,15,.08) 55%, rgba(7,7,15,.45))",
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: portrait ? "flex-start" : "center",
          justifyContent: "flex-start",
          flexDirection: "column",
          padding: portrait ? "340px 90px 0" : "135px 150px 0",
          fontFamily: "Axial UI, sans-serif",
          color: "#f6f4ff",
        }}
      >
        <div
          style={{
            fontSize: portrait ? 124 : 146,
            fontWeight: 380,
            letterSpacing: portrait ? 30 : 39,
            opacity: interpolate(frame, [0, 17], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [0, 20], [26, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          AXIAL
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const TrailerProof: React.FC = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;

  return (
    <BoardFrame>
      {clips.map((clip) => (
        <Sequence
          key={clip.move}
          name={`Opening move ${clip.move}`}
          from={clip.from}
          durationInFrames={clip.duration}
        >
          <Video
            src={staticFile(`footage/opening/move-${clip.move}.mp4`)}
            playbackRate={0.5}
            muted
            objectFit={portrait ? "contain" : "cover"}
            style={{
              width: "100%",
              height: "100%",
              scale: portrait ? 1.75 : 1.12,
              translate: portrait ? undefined : "0 -95px",
            }}
          />
        </Sequence>
      ))}
      <Sequence name="Axial title reveal" from={375} durationInFrames={105}>
        <TitleReveal />
      </Sequence>
      <Audio src={staticFile("audio/music-bed.wav")} volume={0.75} />
      <Audio src={staticFile("audio/game-effects.wav")} volume={0.9} />
      <Sequence from={385} durationInFrames={95} name="Narration: This is Axial">
        <Audio src={staticFile("audio/voice-01.wav")} volume={0.9} />
      </Sequence>
    </BoardFrame>
  );
};
