// The AI's own beat: a match under way against Max (stored as 'nightmare'). Orange's move in the
// corner ignores blue's climbing diagonal, and the AI completes it.
import {
  AI_WIN,
  AI_WIN_ORANGE,
  CLASSIC,
  PREFERENCES,
  savedMatch,
} from "./matches.mjs";

export const setup = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  path: "/?tour=0",
  pointerStart: { x: 1500, y: 300 },
  storage: {
    ...PREFERENCES,
    "axial-opponent-mode": "ai",
    "axial-ai-difficulty": "nightmare",
    "axial-active-match": savedMatch({
      moves: AI_WIN,
      ...CLASSIC,
      opponentMode: "ai",
      aiDifficulty: "nightmare",
    }),
  },
};

export async function run(take) {
  const { page } = take;
  await take.offCamera(async () => {
    await take.moveTo(
      take.centre(page.getByRole("button", { name: "Collapse settings" })),
      0.2,
    );
    await take.click();
    await take.moveTo({ x: 1450, y: 820 }, 0.2);
    await take.hold(1.2);
  });

  await take.hold(0.3);
  const [row, col] = AI_WIN_ORANGE;
  take.mark("aim");
  await take.moveTo(take.cell(row, col), 0.8);
  await take.hold(0.3);
  take.mark("drop");
  await take.click();
  await take.moveTo({ x: 1500, y: 880 }, 0.6);
  await take.until(
    (count) =>
      JSON.parse(localStorage.getItem("axial-active-match") ?? "{}").moveHistory
        ?.length >= count,
    AI_WIN.length + 2,
    12,
  );
  take.mark("reply");
  await take.hold(3.2);
  take.mark("end");
}
