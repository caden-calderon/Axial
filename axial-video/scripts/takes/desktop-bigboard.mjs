// A 9x9x9 connect-five match restored one move from the end; the last piece completes a five-layer
// staircase. The settings panel is closed off camera, so the take opens on the whole board turning
// slowly; after the winning drop the camera swings round to the side, where the staircase (along
// the rows, in column 5) reads as five in a row, before the result card covers the board.
import {
  BIG,
  BIG_STAIRCASE,
  PREFERENCES,
  playMoves,
  savedMatch,
} from "./matches.mjs";

export const setup = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  path: "/?tour=0",
  pointerStart: { x: 1500, y: 300 },
  storage: {
    ...PREFERENCES,
    "axial-opponent-mode": "local",
    "axial-active-match": savedMatch({
      moves: BIG_STAIRCASE.slice(0, -1),
      ...BIG,
    }),
  },
};

const env = (name, fallback) => Number(process.env[name] ?? fallback);

export async function run(take) {
  const { page } = take;
  await take.offCamera(async () => {
    await take.moveTo(
      take.centre(page.getByRole("button", { name: "Collapse settings" })),
      0.2,
    );
    await take.click();
    await take.moveTo({ x: 1180, y: 840 }, 0.2);
    await take.drag(env("START_DX", 200), env("START_DY", 90), 0.6);
    await take.moveTo({ x: 1500, y: 760 }, 0.2);
    await take.hold(1.2);
  });

  take.mark("start");
  await take.drag(env("DRIFT_DX", -150), 0, 2.4);
  take.mark("final-move");
  await playMoves(take, BIG_STAIRCASE.slice(-1), {
    travel: 0.8,
    settle: 0.35,
    after: 0,
  });
  // The piece takes about 0.4 s to land; the result card comes 1.76 s after the move.
  await take.hold(0.3);
  take.mark("line-turn");
  await take.drag(env("LINE_DX", -230), env("LINE_DY", -120), 1.1);
  await take.hold(1.6);
  take.mark("result");
  // Keep the board, then take a slow look around the finished position.
  await take.moveTo(
    take.centre(page.getByRole("button", { name: /keep board/i })),
    0.7,
  );
  await take.hold(0.15);
  await take.click();
  await take.hold(0.4);
  await take.moveTo({ x: 1250, y: 860 }, 0.5);
  await take.drag(-420, 0, 2.6);
  await take.hold(0.8);
}
