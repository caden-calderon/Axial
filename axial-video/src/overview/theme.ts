import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// The game's own palette and typeface, so captions read as part of the interface.
export const theme = {
  background: "#06070f",
  accent: "#a88cff",
  text: "#edf7f2",
  brand: "#dfece8",
  muted: "#9aa3ad",
  surface: "rgba(14, 16, 24, 0.84)",
  border: "rgba(168, 140, 255, 0.32)",
  font: "Axial UI",
};

loadFont({
  family: theme.font,
  url: staticFile("fonts/InterVariable.woff2"),
  weight: "100 900",
});
