// A local two-player match restored at move 24 and played out by clicks: two blocks, the fork,
// blue's block, and orange's staircase win, then the result.
import {
  CLASSIC,
  CLASSIC_FORK,
  PREFERENCES,
  playMoves,
  savedMatch,
} from "./matches.mjs";

const RESTORE_AT = 24;

export const setup = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  path: "/?tour=0",
  pointerStart: { x: 1500, y: 300 },
  storage: {
    ...PREFERENCES,
    "axial-opponent-mode": "local",
    "axial-active-match": savedMatch({
      moves: CLASSIC_FORK.slice(0, RESTORE_AT),
      ...CLASSIC,
    }),
  },
};

export async function run(take) {
  const { page } = take;
  await take.moveTo(
    take.centre(page.getByRole("button", { name: "Collapse settings" })),
    0.5,
  );
  await take.click();
  // Turn the board so the staircase (row 3, columns 2-5) faces the camera, and lean in.
  await take.moveTo({ x: 1150, y: 820 }, 0.5);
  await take.drag(
    Number(process.env.ORBIT_DX ?? 240),
    Number(process.env.ORBIT_DY ?? 110),
    1.2,
  );
  await take.wheel(-450, 0.6);
  take.mark("match");
  await playMoves(take, CLASSIC_FORK.slice(RESTORE_AT, -1));
  take.mark("win");
  await playMoves(take, CLASSIC_FORK.slice(-1), { after: 0 });
  await take.hold(3.2);
  take.mark("result");
  await take.hold(1.2);
}
