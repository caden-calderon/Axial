// Injected before any page script. Gives the page one clock that the recorder advances
// explicitly, so every frame is rendered at an exact presentation time however long the GPU,
// PNG encoding or disk writes take. It owns:
//   - performance.now, Date.now and requestAnimationFrame (the 3D scene and Svelte),
//   - setTimeout / setInterval (AI turn pacing, the result modal delay),
//   - every CSS transition, CSS animation and Web Animation (the interface).
// Workers keep real time; only the main thread is virtual.
(() => {
  const epoch = Date.now();
  let now = 0;
  let lastFlush = 0;
  let frames = new Map();
  let nextFrameId = 1;
  const timers = new Map();
  let nextTimerId = 1;
  const animationStarts = new WeakMap();

  Object.defineProperty(performance, "now", {
    value: () => now,
    configurable: true,
  });
  Date.now = () => epoch + now;

  window.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);

  const schedule = (callback, delay, args, interval) => {
    const id = nextTimerId++;
    const ms = Math.max(0, Number(delay) || 0);
    timers.set(id, {
      due: now + ms,
      callback,
      args,
      interval: interval ? Math.max(1, ms) : 0,
    });
    return id;
  };
  window.setTimeout = (callback, delay, ...args) =>
    schedule(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) =>
    schedule(callback, delay, args, true);
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);

  function runTimersThrough(target) {
    for (;;) {
      let nextId = null;
      let next = null;
      for (const [id, timer] of timers) {
        if (timer.due > target) continue;
        if (
          !next ||
          timer.due < next.due ||
          (timer.due === next.due && id < nextId)
        ) {
          nextId = id;
          next = timer;
        }
      }
      if (!next) return;
      now = Math.max(now, next.due);
      if (next.interval) next.due += next.interval;
      else timers.delete(nextId);
      try {
        if (typeof next.callback === "function") next.callback(...next.args);
      } catch (error) {
        reportError(error);
      }
    }
  }

  // Pause every animation and pin it to the virtual timeline. An animation first seen now
  // started at the previous flush: virtual time did not move in between.
  function syncAnimations() {
    for (const animation of document.getAnimations()) {
      if (!animationStarts.has(animation))
        animationStarts.set(animation, lastFlush);
      if (animation.playState === "running") animation.pause();
      const elapsed = now - animationStarts.get(animation);
      const end = animation.effect?.getComputedTiming().endTime ?? Infinity;
      if (Number.isFinite(end) && elapsed >= end) animation.finish();
      else animation.currentTime = elapsed;
    }
  }

  window.__axialClock = {
    get now() {
      return now;
    },
    /** Advance to `ms`, firing timers that fall due on the way. */
    advanceTo(ms) {
      if (ms < now)
        throw new Error(`Virtual clock cannot run backwards (${ms} < ${now})`);
      runTimersThrough(ms);
      now = ms;
    },
    /** Render one frame at the current time. */
    flushFrame() {
      syncAnimations();
      const callbacks = [...frames.values()];
      frames = new Map();
      for (const callback of callbacks) callback(now);
      lastFlush = now;
      return callbacks.length;
    },
  };
})();
