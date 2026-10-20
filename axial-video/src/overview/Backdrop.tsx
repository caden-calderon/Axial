import { AbsoluteFill } from "remotion";
import { theme } from "./theme";

/** The game's background: near-black with a faint violet bloom behind the board. */
export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 60% 55% at 50% 48%, rgba(108, 82, 190, 0.22), transparent 70%), ${theme.background}`,
    }}
  />
);
