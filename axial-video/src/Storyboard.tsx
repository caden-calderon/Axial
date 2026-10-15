import { loadFont } from "@remotion/fonts";
import {
  AbsoluteFill,
  cancelRender,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, shots } from "./shots";

loadFont({
  family: "Axial UI",
  url: staticFile("fonts/InterVariable.woff2"),
  weight: "100 900",
}).catch(cancelRender);

type Shot = (typeof shots)[number];

const ShotCard: React.FC<{ shot: Shot }> = ({ shot }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;

  return (
    <AbsoluteFill
      style={{ padding: portrait ? "200px 90px 210px" : "125px 140px 150px" }}
    >
      <div style={{ fontSize: 26, letterSpacing: 5, color: "#92aca4" }}>
        AXIAL / EDITING STORYBOARD / V1
      </div>
      <div style={{ marginTop: 38, fontSize: 28, color: "#73f5d8" }}>
        SHOT {shot.id} · {shot.start.toFixed(1)}–{shot.end.toFixed(1)}s
      </div>
      <h1
        style={{
          margin: "30px 0",
          fontWeight: 500,
          fontSize: portrait ? 86 : 94,
          letterSpacing: -3,
          lineHeight: 1.08,
        }}
      >
        {shot.title}
      </h1>
      <div
        style={{
          fontSize: portrait ? 43 : 40,
          lineHeight: 1.4,
          maxWidth: 1350,
        }}
      >
        {shot.picture}
      </div>
      <div
        style={{
          marginTop: portrait ? 90 : 54,
          borderLeft: "3px solid #a88cff",
          paddingLeft: 28,
        }}
      >
        <div
          style={{
            color: "#a88cff",
            fontSize: 22,
            letterSpacing: 3,
            marginBottom: 16,
          }}
        >
          NARRATION CUE
        </div>
        <div style={{ fontSize: portrait ? 45 : 44, lineHeight: 1.3 }}>
          {shot.voice || "No voice. Let the match speak."}
        </div>
      </div>
      <div
        style={{
          marginTop: portrait ? 55 : 32,
          color: "#92aca4",
          fontSize: 29,
          lineHeight: 1.45,
        }}
      >
        SOUND / {shot.sound}
      </div>
    </AbsoluteFill>
  );
};

export const Storyboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const portrait = height > width;
  const progress = frame / (durationInFrames - 1);

  return (
    <AbsoluteFill
      style={{
        background: "#070a0d",
        color: "#ecf8f3",
        fontFamily: "Axial UI, sans-serif",
      }}
    >
      {shots.map((shot) => (
        <Sequence
          key={shot.id}
          from={shot.start * FPS}
          durationInFrames={(shot.end - shot.start) * FPS}
          name={`${shot.id} / ${shot.title}`}
        >
          <ShotCard shot={shot} />
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: portrait ? 120 : 70,
          left: portrait ? 90 : 140,
          right: portrait ? 90 : 140,
          display: "flex",
          justifyContent: "space-between",
          gap: 30,
          fontSize: 23,
          color: "#92aca4",
        }}
      >
        <span>PLANNING GUIDE · NO FOOTAGE OR AUDIO</span>
        <span
          style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
        >
          {(frame / FPS).toFixed(1)} / {durationInFrames / FPS}s
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 8,
          width: `${progress * 100}%`,
          background: "#73f5d8",
        }}
      />
    </AbsoluteFill>
  );
};
