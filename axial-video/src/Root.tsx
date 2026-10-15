import "./index.css";
import { Composition } from "remotion";
import { Storyboard } from "./Storyboard";
import { TrailerProof } from "./TrailerProof";
import { Trailer } from "./Trailer";
import { DURATION_IN_FRAMES, FPS } from "./shots";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TrailerLandscape"
        component={Trailer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="TrailerPortrait"
        component={Trailer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TrailerProofLandscape"
        component={TrailerProof}
        durationInFrames={480}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="TrailerProofPortrait"
        component={TrailerProof}
        durationInFrames={480}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TrailerStoryboardLandscape"
        component={Storyboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="TrailerStoryboardPortrait"
        component={Storyboard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
