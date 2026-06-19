const DEFAULT_BASE_URL = "https://playaxial.dev";
const PROTOCOL_VERSION = 1;
const CLIENT_SOURCE = "axial-client";
const ROOM_SOURCE = "axial-room";

const baseUrl = (
  process.env.AXIAL_MULTIPLAYER_SMOKE_URL ?? DEFAULT_BASE_URL
).replace(/\/$/, "");

const timeoutMs = Number(
  process.env.AXIAL_MULTIPLAYER_SMOKE_TIMEOUT_MS ?? 8000,
);

async function main() {
  await checkHealth();

  const created = await postJson("/api/rooms", {
    displayName: "Smoke Host",
  });
  assertRoomResponse(created, "create");

  const joined = await postJson(`/api/rooms/${created.roomCode}/join`, {
    displayName: "Smoke Guest",
  });
  assertRoomResponse(joined, "join");

  const host = await connectRoom(created.player, created.snapshot.revision);
  const guest = await connectRoom(joined.player, joined.snapshot.revision);

  try {
    await Promise.all([
      host.waitForSnapshot((snapshot) => snapshot.you.seat === 1),
      guest.waitForSnapshot((snapshot) => snapshot.you.seat === 2),
    ]);

    host.send(command("room:ready", { ready: true }));
    guest.send(command("room:ready", { ready: true }));

    const playing = await host.waitForSnapshot(
      (snapshot) => snapshot.phase === "playing",
    );
    await guest.waitForSnapshot((snapshot) => snapshot.phase === "playing");

    host.send(
      command("game:play-move", {
        move: { row: 0, col: 0 },
        expectedRevision: playing.revision,
      }),
    );

    const moved = await guest.waitForSnapshot(
      (snapshot) => snapshot.game.moveHistory.length === 1,
    );

    const lastMove = moved.game.moveHistory.at(-1);
    if (!lastMove || lastMove.row !== 0 || lastMove.col !== 0) {
      throw new Error("Live smoke did not observe the expected accepted move.");
    }
  } finally {
    host.close();
    guest.close();
  }

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      roomCode: created.roomCode,
      inviteUrl: created.inviteUrl,
      message: "Production multiplayer smoke passed.",
    }),
  );
}

async function checkHealth() {
  const response = await fetch(`${baseUrl}/health`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      `Health check failed with ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `POST ${path} failed with ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function assertRoomResponse(payload, label) {
  if (
    !payload ||
    typeof payload.roomCode !== "string" ||
    !payload.player?.playerId ||
    !payload.player?.reconnectToken ||
    !payload.snapshot?.revision
  ) {
    throw new Error(`Invalid ${label} response: ${JSON.stringify(payload)}`);
  }
}

async function connectRoom(credentials, lastSeenRevision) {
  const url = new URL(
    `/api/rooms/${encodeURIComponent(credentials.roomCode)}/socket`,
    baseUrl.replace(/^http/, "ws"),
  );
  url.searchParams.set("playerId", credentials.playerId);
  url.searchParams.set("reconnectToken", credentials.reconnectToken);
  url.searchParams.set("lastSeenRevision", String(lastSeenRevision));

  const socket = new WebSocket(url);
  const events = [];
  const waiters = [];

  socket.addEventListener("message", (event) => {
    const parsed = JSON.parse(String(event.data));
    if (parsed.source !== ROOM_SOURCE || parsed.version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported room event: ${event.data}`);
    }
    events.push(parsed);
    flushWaiters();
  });

  socket.addEventListener("close", (event) => {
    const error = new Error(
      `Socket closed before smoke completed: ${event.code} ${event.reason}`,
    );
    rejectWaiters(error);
  });

  socket.addEventListener("error", () => {
    rejectWaiters(new Error("Socket error before smoke completed."));
  });

  await waitForOpen(socket);

  return {
    close() {
      socket.close(1000, "smoke-complete");
    },
    send(payload) {
      socket.send(JSON.stringify(payload));
    },
    waitForSnapshot(predicate) {
      return waitForEvent((event) => {
        const snapshot = event.payload?.snapshot;
        return snapshot && predicate(snapshot) ? snapshot : null;
      }, `snapshot for ${credentials.roomCode}`);
    },
  };

  function waitForEvent(mapper, label) {
    const existing = firstMapped(events, mapper);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${label}.`));
      }, timeoutMs);
      waiters.push({ mapper, resolve, reject, timer });
    });
  }

  function flushWaiters() {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      const mapped = firstMapped(events, waiter.mapper);
      if (mapped) {
        clearTimeout(waiter.timer);
        waiters.splice(index, 1);
        waiter.resolve(mapped);
      }
    }
  }

  function rejectWaiters(error) {
    while (waiters.length > 0) {
      const waiter = waiters.pop();
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}

function firstMapped(events, mapper) {
  for (const event of events) {
    const mapped = mapper(event);
    if (mapped) return mapped;
  }
  return null;
}

function waitForOpen(socket) {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for socket open."));
    }, timeoutMs);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Socket failed to open."));
      },
      { once: true },
    );
  });
}

function command(type, payload) {
  return {
    source: CLIENT_SOURCE,
    version: PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    type,
    payload,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
