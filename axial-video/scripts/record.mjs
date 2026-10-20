// Frame-exact recordings of the real Axial page driven by real pointer and touch input.
//
//   node scripts/record.mjs <take> [--preview] [--from-frame N]
//
// A take (scripts/takes/<take>.mjs) exports `setup` (viewport, storage, URL) and an async
// `run(take)` that drives the page through the API below. Every frame advances the page's
// virtual clock (scripts/virtual-clock.js) by exactly 1/60 s and is screenshotted, so the
// recording plays back at true speed no matter how slowly it was captured. A cursor (or touch
// marker) is drawn into the page because headless Chrome has none.
//
// Output: public/footage/<take>.mp4 plus <take>.markers.json (labelled frames for the edit).
// Needs the web dev server (AXIAL_RECORD_URL, default http://127.0.0.1:5173), Google Chrome
// (AXIAL_RECORD_CHROME) and ffmpeg on PATH. --preview records at 1x DPR and 30 fps.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(here, "..");
const requireFromWeb = createRequire(
  resolve(workspace, "../axial-web/apps/web/package.json"),
);
const { chromium } = requireFromWeb("@playwright/test");

const args = process.argv.slice(2);
const takeName = args.find((arg) => !arg.startsWith("--"));
if (!takeName) {
  console.error("Usage: node scripts/record.mjs <take> [--preview]");
  process.exit(1);
}
const preview = args.includes("--preview");
const appUrl = process.env.AXIAL_RECORD_URL ?? "http://127.0.0.1:5173";
const take = await import(
  pathToFileURL(resolve(here, "takes", `${takeName}.mjs`)).href
);
const setup = take.setup;
const fps = preview ? 30 : 60;
const dpr = preview ? 1 : setup.deviceScaleFactor;
const name = `${takeName}${preview ? "-preview" : ""}`;
const frameDirectory = resolve(workspace, "out/frames", name);
await rm(frameDirectory, { recursive: true, force: true });
await mkdir(frameDirectory, { recursive: true });

const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const browser = await chromium.launch({
  executablePath:
    process.env.AXIAL_RECORD_CHROME ??
    "/run/current-system/sw/bin/google-chrome",
  args: [
    "--use-angle=vulkan",
    "--enable-features=Vulkan",
    "--ignore-gpu-blocklist",
    "--hide-scrollbars",
  ],
});

try {
  const context = await browser.newContext({
    viewport: setup.viewport,
    deviceScaleFactor: dpr,
    isMobile: setup.touch ?? false,
    hasTouch: setup.touch ?? false,
    userAgent: setup.userAgent,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`  [page] ${message.text()}`);
  });
  // Vite's HMR socket would reload the page on any source edit mid-recording.
  await page.routeWebSocket(/./, () => {});
  await page.addInitScript({ path: resolve(here, "virtual-clock.js") });
  await page.addInitScript({ path: resolve(here, "pointer-overlay.js") });
  await page.addInitScript((storage) => {
    if (sessionStorage.getItem("__axialSeeded")) return;
    localStorage.clear();
    for (const [key, value] of Object.entries(storage))
      localStorage.setItem(key, value);
    sessionStorage.setItem("__axialSeeded", "1");
  }, setup.storage ?? {});
  await page.addInitScript(() => {
    // A macrotask: lets every queued microtask (Svelte's flush) run first.
    const settle = () =>
      new Promise((done) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => done();
        channel.port2.postMessage(0);
      });
    window.__axialStep = async (ms) => {
      window.__axialClock.advanceTo(ms);
      await settle();
      // Two passes at one instant: the scene's tasks update state, Svelte applies it, then
      // the second pass renders what the first computed.
      window.__axialClock.flushFrame();
      await settle();
      window.__axialClock.flushFrame();
      await settle();
    };
  });

  await page.goto(`${appUrl}${setup.path ?? "/"}`);
  // The one departure from the game as shipped. The interface's drop shadows (48 px of 44% black)
  // are faint on a screen, but punched in and encoded to 8-bit h.264 they come out as heavy dark
  // halos with visible steps. Recordings soften them; the game itself is unchanged.
  await page.addStyleTag({
    content:
      ".game-shell { --shadow: color-mix(in oklab, #000 14%, transparent) !important; }",
  });
  // The page defers the 3D scene behind timers and frames, which only move when the virtual
  // clock does: pump it (before frame 0, so none of this is recorded) until the board exists.
  let loadMs = 0;
  const loadDeadline = Date.now() + 90_000;
  for (;;) {
    const ready = await page.evaluate(() =>
      Boolean(window.__axialStep && document.querySelector("canvas")),
    );
    if (ready) break;
    if (Date.now() > loadDeadline) throw new Error("The board never mounted");
    loadMs += 16;
    await page
      .evaluate((ms) => window.__axialStep?.(ms), loadMs)
      .catch(() => {});
    await new Promise((done) => setTimeout(done, 20));
  }

  let frame = 0;
  let pointer = setup.pointerStart ?? {
    x: setup.viewport.width / 2,
    y: setup.viewport.height * 0.62,
  };
  let pointerDown = false;
  const markers = [];
  // Moves as they appear in the saved match, so the edit can place the game's own sounds.
  const moves = [];
  let knownMoves = null;
  let matchShape = null;
  let baseMs = 0;
  // Frames stepped off camera (take.offCamera): the clock runs, nothing is written.
  let offCameraFrames = 0;
  let offCamera = false;
  const virtualMs = () => baseMs + ((frame + offCameraFrames) * 1000) / fps;

  // Let the scene mount and compile its shaders on the virtual clock before recording.
  // Settle for a second of virtual time (shaders, entrance transitions) before frame 0.
  for (let warm = 1; warm <= 60; warm += 1)
    await page.evaluate((ms) => window.__axialStep(ms), loadMs + warm * 16);
  baseMs = loadMs + 60 * 16 + 16;
  if (!setup.touch) await page.mouse.move(pointer.x, pointer.y);

  async function capture() {
    await page.evaluate((ms) => window.__axialStep(ms), virtualMs());
    if (offCamera) {
      offCameraFrames += 1;
      return;
    }
    await page.screenshot({
      path: resolve(
        frameDirectory,
        `frame-${String(frame).padStart(5, "0")}.png`,
      ),
      type: "png",
    });
    const saved = await page.evaluate(() =>
      localStorage.getItem("axial-active-match"),
    );
    const match = saved ? JSON.parse(saved) : null;
    const history = match?.moveHistory ?? [];
    if (knownMoves === null || history.length < knownMoves) {
      knownMoves = history.length; // restored position or a new match: not new moves
    }
    for (let index = knownMoves; index < history.length; index += 1) {
      const { row, col } = history[index];
      const height = history
        .slice(0, index)
        .filter((move) => move.row === row && move.col === col).length;
      const player = ((index + (match.startingPlayer === 2 ? 1 : 0)) % 2) + 1;
      moves.push({ frame, index, row, col, height, player });
    }
    knownMoves = history.length;
    if (match)
      matchShape = {
        dimensions: match.boardDimensions,
        winCondition: match.winCondition,
      };
    if (frame % 60 === 0)
      console.log(`${name}: frame ${frame} (${(frame / fps).toFixed(1)} s)`);
    frame += 1;
  }

  async function placePointer(point) {
    pointer = point;
    if (setup.touch) {
      await page.evaluate(
        ({ x, y }) => window.__axialPointer?.touchMove(x, y),
        point,
      );
      if (pointerDown) await touch("touchMove", point);
    } else {
      await page.mouse.move(point.x, point.y);
    }
  }

  let cdp = null;
  async function touch(type, point) {
    cdp ??= await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" ? [] : [{ x: point.x, y: point.y, id: 1 }],
    });
  }

  const api = {
    page,
    fps,
    get frame() {
      return frame;
    },
    get pointer() {
      return pointer;
    },
    /** Record frames with no input. */
    async hold(seconds) {
      const count = Math.round(seconds * fps);
      for (let index = 0; index < count; index += 1) await capture();
    },
    /** Glide the pointer to a point (or a promise of one) with an ease-in-out path. */
    async moveTo(target, seconds = 0.6) {
      const to = await target;
      const from = { ...pointer };
      const count = Math.max(1, Math.round(seconds * fps));
      for (let index = 1; index <= count; index += 1) {
        const t = easeInOut(index / count);
        await placePointer({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
        await capture();
      }
    },
    /** Press and release at the pointer, holding a few frames so the press reads. */
    async click(holdFrames = 4) {
      if (setup.touch) return api.tap(holdFrames);
      await page.mouse.down();
      for (let index = 0; index < holdFrames; index += 1) await capture();
      await page.mouse.up();
    },
    async tap(holdFrames = 4) {
      await page.evaluate(
        ({ x, y }) => window.__axialPointer?.touchStart(x, y),
        pointer,
      );
      await touch("touchStart", pointer);
      for (let index = 0; index < holdFrames; index += 1) await capture();
      await touch("touchEnd", pointer);
      await page.evaluate(() => window.__axialPointer?.touchEnd());
    },
    /** Press, travel by (dx, dy) over `seconds`, release: an orbit drag on the board. */
    async drag(dx, dy, seconds = 1.2) {
      const from = { ...pointer };
      pointerDown = true;
      if (setup.touch) {
        await page.evaluate(
          ({ x, y }) => window.__axialPointer?.touchStart(x, y),
          from,
        );
        await touch("touchStart", from);
      } else {
        await page.mouse.down();
      }
      const count = Math.max(1, Math.round(seconds * fps));
      for (let index = 1; index <= count; index += 1) {
        const t = easeInOut(index / count);
        await placePointer({ x: from.x + dx * t, y: from.y + dy * t });
        await capture();
      }
      pointerDown = false;
      if (setup.touch) {
        await touch("touchEnd", pointer);
        await page.evaluate(() => window.__axialPointer?.touchEnd());
      } else {
        await page.mouse.up();
      }
    },
    /** Scroll the wheel by `deltaY` spread over `seconds` (zoom on the board). */
    async wheel(deltaY, seconds = 0.8) {
      const count = Math.max(1, Math.round(seconds * fps));
      for (let index = 0; index < count; index += 1) {
        await page.mouse.wheel(0, deltaY / count);
        await capture();
      }
    },
    /** Screen point where a piece dropped in (row, col) would land, through the live camera. */
    cell(row, col) {
      return page
        .evaluate(({ row, col }) => window.__axialScene.aim(row, col), {
          row,
          col,
        })
        .then((point) => {
          if (!point)
            throw new Error(
              `No aim point picks row ${row}, col ${col} from this view`,
            );
          return point;
        });
    },
    /** Centre of a visible element (Playwright locator). */
    async centre(locator) {
      const box = await locator.boundingBox();
      if (!box) throw new Error(`No box for ${locator}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
    /** Record frames until `predicate` (evaluated in the page) holds; fails after `maxSeconds`. */
    async until(predicate, arg, maxSeconds = 6) {
      const limit = frame + Math.round(maxSeconds * fps);
      while (!(await page.evaluate(predicate, arg))) {
        if (frame >= limit)
          throw new Error(`until() timed out at frame ${frame}`);
        await capture();
      }
    },
    /** Number of moves in the saved match (the controller persists after every move). */
    moveCount() {
      return page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("axial-active-match") ?? "{}")
            .moveHistory?.length ?? 0,
      );
    },
    /** Run steps (setting up the camera, say) on the clock without recording them. */
    async offCamera(steps) {
      offCamera = true;
      try {
        await steps();
      } finally {
        offCamera = false;
        knownMoves = null;
      }
    },
    /** Label this frame for the edit (e.g. where a caption should appear). */
    mark(label) {
      markers.push({ label, frame, seconds: frame / fps });
    },
  };

  await take.run(api);
  if (pageErrors.length)
    throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  await context.close();

  const output = resolve(workspace, "public/footage", `${name}.mp4`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    resolve(workspace, "public/footage", `${name}.markers.json`),
    JSON.stringify(
      {
        fps,
        frames: frame,
        viewport: setup.viewport,
        deviceScaleFactor: dpr,
        markers,
        match: matchShape,
        moves,
      },
      null,
      2,
    ),
  );
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-framerate",
      String(fps),
      "-i",
      resolve(frameDirectory, "frame-%05d.png"),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      preview ? "20" : "14",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ],
    { encoding: "utf8" },
  );
  if (encoded.status !== 0)
    throw new Error(encoded.stderr || `ffmpeg exited ${encoded.status}`);
  await rm(frameDirectory, { recursive: true, force: true });
  console.log(`${name}: ${frame} frames → ${output}`);
} finally {
  await browser.close();
}
