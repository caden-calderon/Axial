// The twists, set up the way a player would: on a fresh board, open the settings, grow the board
// to 9x9x9, switch to connect five, then three lines to win. Each click is marked so the edit can
// cut from it to a board that shows the rule in play. (The game only allows these changes before
// a match starts, so the board is empty.)
import { PREFERENCES } from "./matches.mjs";

export const setup = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  path: "/?tour=0",
  pointerStart: { x: 1300, y: 560 },
  storage: { ...PREFERENCES, "axial-opponent-mode": "local" },
};

export async function run(take) {
  const { page } = take;
  const press = async (locator, travel = 0.45, after = 0.35) => {
    await take.moveTo(take.centre(locator), travel);
    await take.hold(0.1);
    await take.click();
    await take.hold(after);
  };
  const group = (name) => page.getByRole("group", { name });

  await take.offCamera(async () => {
    await take.moveTo(
      take.centre(page.getByRole("button", { name: "Collapse settings" })),
      0.2,
    );
    await take.click();
    await take.moveTo({ x: 1300, y: 560 }, 0.2);
    await take.hold(1.0);
  });

  await take.hold(0.4);
  take.mark("open");
  await press(page.getByRole("button", { name: "Expand settings" }), 0.7, 0.6);

  take.mark("board");
  const dimension = (name) =>
    page.getByRole("button", { name: new RegExp(`board ${name}`) });
  for (const [name, clicks] of [
    ["height", 3],
    ["rows", 3],
    ["columns", 2],
  ]) {
    for (let click = 0; click < clicks; click += 1)
      await press(dimension(name), click ? 0.16 : 0.35, 0.22);
  }
  take.mark("board-done");
  await take.hold(1.0);

  await take.moveTo(
    take.centre(
      group("Connect length").getByRole("button", { name: "5", exact: true }),
    ),
    0.5,
  );
  await take.hold(0.25);
  take.mark("connect");
  await take.click();
  await take.hold(1.2);

  await take.moveTo(
    take.centre(
      group("Lines to win").getByRole("button", { name: "3", exact: true }),
    ),
    0.45,
  );
  await take.hold(0.25);
  take.mark("lines");
  await take.click();
  await take.hold(1.4);
  take.mark("end");
}
