import "./index.css";
import { Composition } from "remotion";
import { FPS, OVERVIEW_DURATION, Overview } from "./overview/Overview";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Overview"
    component={Overview}
    durationInFrames={OVERVIEW_DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
