import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TrailerProof } from "./TrailerProof";

type FeatureShotProps = {
  clip: string;
  still: string;
  duration: number;
  clipFrames: number;
  speed?: number;
  title: string;
  eyebrow?: string;
  uiStill?: string;
  uiFrames?: number;
};

const FeatureShot: React.FC<FeatureShotProps> = ({
  clip,
  still,
  duration,
  clipFrames,
  speed = 1,
  title,
  eyebrow,
  uiStill,
  uiFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const uiDuration = portrait ? 0 : uiFrames;
  const footageStarts = uiDuration;
  const holdStarts = footageStarts + clipFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070f" }}>
      {uiStill && uiDuration > 0 && (
        <Sequence durationInFrames={uiDuration} name="Real settings interface">
          <Img
            src={staticFile(uiStill)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Sequence>
      )}
      <Sequence
        from={footageStarts}
        durationInFrames={clipFrames}
        name="Real gameplay"
      >
        <Video
          src={staticFile(clip)}
          playbackRate={speed}
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
      <Sequence
        from={holdStarts}
        durationInFrames={duration - holdStarts}
        name="Result hold"
      >
        <Img
          src={staticFile(still)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: portrait ? "contain" : "cover",
            scale: portrait ? 1.75 : 1.12,
            translate: portrait ? undefined : "0 -95px",
          }}
        />
      </Sequence>
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(180deg, rgba(7,7,15,.78), rgba(7,7,15,.14) 43%, transparent 66%)"
            : "linear-gradient(180deg, rgba(7,7,15,.70), transparent 53%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: portrait ? 82 : 145,
          top: portrait ? 270 : 110,
          right: portrait ? 82 : 145,
          fontFamily: "Axial UI, sans-serif",
          color: "#f6f4ff",
        }}
      >
        {eyebrow && (
          <div
            style={{
              fontSize: portrait ? 27 : 23,
              fontWeight: 600,
              color: "#b9a5ff",
              letterSpacing: 5,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 12], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            marginTop: eyebrow ? 22 : 0,
            maxWidth: portrait ? 850 : 1500,
            fontSize: portrait ? 63 : 70,
            lineHeight: 1.12,
            letterSpacing: -1.6,
            fontWeight: 430,
            opacity: interpolate(frame, [0, 13], [0, 1], {
              extrapolateRight: "clamp",
            }),
            translate: `0 ${interpolate(frame, [0, 16], [22, 0], {
              extrapolateRight: "clamp",
            })}px`,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LinesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const showingThree = frame >= 75;
  const two = "footage/features/two-lines";
  const three = "footage/features/three-lines";

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070f" }}>
      {!portrait && (
        <>
          <Sequence durationInFrames={24} name="Two-line progress UI">
            <Img src={staticFile(`${two}-ui.png`)} style={{ width: "100%", height: "100%" }} />
          </Sequence>
          <Sequence from={75} durationInFrames={24} name="Three-line progress UI">
            <Img src={staticFile(`${three}-ui.png`)} style={{ width: "100%", height: "100%" }} />
          </Sequence>
        </>
      )}
      <Sequence from={portrait ? 0 : 24} durationInFrames={portrait ? 66 : 51}>
        <Video
          src={staticFile(`${two}.mp4`)}
          playbackRate={0.9}
          muted
          objectFit={portrait ? "contain" : "cover"}
          style={{ width: "100%", height: "100%", scale: portrait ? 1.75 : 1 }}
        />
      </Sequence>
      {portrait && (
        <Sequence from={66} durationInFrames={9}>
          <Img
            src={staticFile(`${two}-hold.png`)}
            style={{ width: "100%", height: "100%", objectFit: "contain", scale: 1.75 }}
          />
        </Sequence>
      )}
      <Sequence from={portrait ? 75 : 99} durationInFrames={portrait ? 66 : 60}>
        <Video
          src={staticFile(`${three}.mp4`)}
          playbackRate={0.9}
          muted
          objectFit={portrait ? "contain" : "cover"}
          style={{ width: "100%", height: "100%", scale: portrait ? 1.75 : 1 }}
        />
      </Sequence>
      <Sequence from={portrait ? 141 : 159} durationInFrames={portrait ? 69 : 51}>
        <Img
          src={staticFile(`${three}-hold.png`)}
          style={{ width: "100%", height: "100%", objectFit: portrait ? "contain" : "cover", scale: portrait ? 1.75 : 1 }}
        />
      </Sequence>
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(180deg, rgba(7,7,15,.78), rgba(7,7,15,.15) 43%, transparent 66%)"
            : "linear-gradient(180deg, rgba(7,7,15,.68), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: portrait ? 82 : 145,
          top: portrait ? 270 : 110,
          right: portrait ? 82 : 145,
          fontFamily: "Axial UI, sans-serif",
          color: "#f6f4ff",
        }}
      >
        <div style={{ color: "#b9a5ff", letterSpacing: 5, fontSize: portrait ? 27 : 23 }}>
          CHANGE THE GOAL
        </div>
        <div style={{ marginTop: 22, fontSize: portrait ? 66 : 75, fontWeight: 430 }}>
          {showingThree ? "Or three." : "Two lines to win."}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070f", fontFamily: "Axial UI, sans-serif" }}>
      <Img
        src={staticFile("footage/features/three-dimensional-line-hold.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: portrait ? "contain" : "cover",
          opacity: 0.52,
          scale: portrait ? 1.75 : 1.12,
          translate: portrait ? undefined : "0 -95px",
        }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,7,15,.50), rgba(7,7,15,.25))" }} />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: portrait ? "center" : "flex-start",
          justifyContent: "center",
          padding: portrait ? "0 80px 350px" : "0 150px 120px",
          color: "#f6f4ff",
          opacity: interpolate(frame, [0, 17], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontSize: portrait ? 55 : 58, fontWeight: 430, marginBottom: 35 }}>
          Your move.
        </div>
        <div style={{ fontSize: portrait ? 132 : 150, fontWeight: 380, letterSpacing: portrait ? 28 : 42 }}>
          AXIAL
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: portrait ? 47 : 42,
            color: "#77f3da",
            letterSpacing: 2,
          }}
        >
          playaxial.dev
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#06070f" }}>
    <TrailerProof />
    <Sequence from={480} durationInFrames={180} name="Connect four in three dimensions">
      <FeatureShot
        clip="footage/features/three-dimensional-line.mp4"
        still="footage/features/three-dimensional-line-hold.png"
        duration={180}
        clipFrames={100}
        speed={0.65}
        title="Connect four. In three dimensions."
        eyebrow="One move changes everything"
      />
    </Sequence>
    <Sequence from={660} durationInFrames={150} name="Connect five">
      <FeatureShot
        clip="footage/features/connect-five.mp4"
        still="footage/features/connect-five-hold.png"
        uiStill="footage/features/connect-five-ui.png"
        uiFrames={30}
        duration={150}
        clipFrames={90}
        speed={0.67}
        title="Then change the rules. Connect five."
      />
    </Sequence>
    <Sequence from={810} durationInFrames={150} name="Change board size">
      <FeatureShot
        clip="footage/features/larger-board.mp4"
        still="footage/features/larger-board-hold.png"
        uiStill="footage/features/larger-board-ui.png"
        uiFrames={32}
        duration={150}
        clipFrames={72}
        speed={0.62}
        title="Change the size of the board."
      />
    </Sequence>
    <Sequence from={960} durationInFrames={210} name="Two or three lines to win">
      <LinesScene />
    </Sequence>
    <Sequence from={1170} durationInFrames={150} name="Play Axial in your browser">
      <EndCard />
    </Sequence>
    <Sequence from={485} name="Narration: 3D">
      <Audio src={staticFile("audio/voice-02.wav")} volume={0.9} />
    </Sequence>
    <Sequence from={666} name="Narration: connect five">
      <Audio src={staticFile("audio/voice-04.wav")} volume={0.9} />
    </Sequence>
    <Sequence from={823} name="Narration: board size">
      <Audio src={staticFile("audio/voice-05.wav")} volume={0.9} />
    </Sequence>
    <Sequence from={969} name="Narration: line goals">
      <Audio src={staticFile("audio/voice-06.wav")} volume={0.9} />
    </Sequence>
    <Sequence from={1180} name="Narration: play">
      <Audio src={staticFile("audio/voice-07.wav")} volume={0.9} />
    </Sequence>
  </AbsoluteFill>
);
