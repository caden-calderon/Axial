import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  AXIAL_CLIENT_SOURCE,
  AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
  type ClientCommand,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type PlayerCredentials,
  type PrivateRoomSnapshot,
  type RoomCommandResponse,
  type RoomErrorPayload,
  type RoomSyncResponse,
  type ServerEvent,
} from "@axial/multiplayer-protocol";
import type { RoomObjectRpc } from "../src/roomObject";

describe("Axial multiplayer room service", () => {
  it("creates a private room with host credentials and invite metadata", async () => {
    const created = await createRoom(" Caden ");

    expect(created.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(created.inviteUrl).toBe(
      `https://playaxial.dev/?room=${created.roomCode}`,
    );
    expect(created.qrPayload).toBe(created.inviteUrl);
    expect(created.player.seat).toBe(1);
    expect(created.player.isHost).toBe(true);
    expect(created.player.reconnectToken.length).toBeGreaterThan(30);
    expect(created.snapshot.players).toHaveLength(1);
    expect(created.snapshot.players[0]?.displayName).toBe("Caden");
  });

  it("joins a second player and rejects a third seat", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const third = await SELF.fetch(
      `https://worker.test/api/rooms/${created.roomCode}/join`,
      {
        method: "POST",
        body: JSON.stringify({ displayName: "Third" }),
      },
    );
    const error = (await third.json()) as { error: RoomErrorPayload };

    expect(joined.player.seat).toBe(2);
    expect(joined.snapshot.players).toHaveLength(2);
    expect(joined.snapshot.players[1]?.displayName).toBe("Friend");
    expect(third.status).toBe(409);
    expect(error.error.code).toBe("room-full");
  });

  it("keeps rule edits host-only and starts only when the host confirms both players are ready", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const stub = roomStub(created.roomCode);

    const nonHostRules = await stub.submitCommand(
      joined.player,
      command("room:set-rules", {
        rules: {
          mode: "classic",
          board: { height: 6, rows: 6, columns: 7 },
          winCondition: { lineLength: 5, linesToWin: 2 },
        },
        expectedRevision: joined.snapshot.revision,
      }),
      joined.inviteUrl,
    );
    expect(nonHostRules.ok).toBe(false);
    if (!nonHostRules.ok) expect(nonHostRules.error.code).toBe("not-host");

    const hostRules = await stub.submitCommand(
      created.player,
      command("room:set-rules", {
        rules: {
          mode: "classic",
          board: { height: 6, rows: 6, columns: 7 },
          winCondition: { lineLength: 5, linesToWin: 2 },
        },
        expectedRevision: joined.snapshot.revision,
      }),
      created.inviteUrl,
    );
    expect(hostRules.ok).toBe(true);
    const afterRules = unwrap(hostRules).snapshot;
    expect(afterRules.rules.winCondition).toEqual({
      lineLength: 5,
      linesToWin: 2,
    });
    expect(afterRules.players.every((player) => !player.ready)).toBe(true);

    const hostReady = await stub.submitCommand(
      created.player,
      command("room:ready", { ready: true }),
      created.inviteUrl,
    );
    expect(unwrap(hostReady).snapshot.phase).toBe("waiting");

    const friendReady = await stub.submitCommand(
      joined.player,
      command("room:ready", { ready: true }),
      joined.inviteUrl,
    );
    const ready = unwrap(friendReady);
    expect(ready.events.at(-1)?.type).toBe("room:ready-updated");
    expect(ready.snapshot.phase).toBe("waiting");

    const nonHostStart = await stub.submitCommand(
      joined.player,
      command("room:start", { expectedRevision: ready.snapshot.revision }),
      joined.inviteUrl,
    );
    expect(nonHostStart.ok).toBe(false);
    if (!nonHostStart.ok) expect(nonHostStart.error.code).toBe("not-host");

    const start = await stub.submitCommand(
      created.player,
      command("room:start", { expectedRevision: ready.snapshot.revision }),
      created.inviteUrl,
    );
    const started = unwrap(start);
    expect(started.events.at(-1)?.type).toBe("game:started");
    expect(started.snapshot.phase).toBe("playing");
    expect(started.snapshot.game.status).toEqual({
      state: "playing",
      currentPlayer: 1,
    });
    expect(started.snapshot.match.number).toBe(1);
    expect(started.snapshot.match.startingPlayer).toBe(1);
    expect(started.snapshot.match.startedAt).toEqual(expect.any(Number));
    expect(started.snapshot.match.playableAt).toBeGreaterThan(
      started.snapshot.match.startedAt ?? 0,
    );
  });

  it("validates turn order, move legality, stale revisions, game over, and rematch", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const stub = roomStub(created.roomCode);
    let snapshot = await readyBoth(
      stub,
      created.player,
      joined.player,
      created.inviteUrl,
    );

    const stale = await stub.submitCommand(
      created.player,
      command("game:play-move", {
        move: { row: 0, col: 0 },
        expectedRevision: snapshot.revision - 1,
      }),
      created.inviteUrl,
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe("stale-revision");

    const outOfTurn = await stub.submitCommand(
      joined.player,
      command("game:play-move", {
        move: { row: 0, col: 1 },
        expectedRevision: snapshot.revision,
      }),
      joined.inviteUrl,
    );
    expect(outOfTurn.ok).toBe(false);
    if (!outOfTurn.ok) expect(outOfTurn.error.code).toBe("not-your-turn");

    snapshot = await play(
      stub,
      created.player,
      created.inviteUrl,
      snapshot,
      0,
      0,
    );
    expect(snapshot.game.moveHistory).toHaveLength(1);
    expect(snapshot.game.status).toEqual({
      state: "playing",
      currentPlayer: 2,
    });

    snapshot = await play(
      stub,
      joined.player,
      joined.inviteUrl,
      snapshot,
      0,
      1,
    );
    snapshot = await play(
      stub,
      created.player,
      created.inviteUrl,
      snapshot,
      0,
      0,
    );
    snapshot = await play(
      stub,
      joined.player,
      joined.inviteUrl,
      snapshot,
      0,
      1,
    );
    snapshot = await play(
      stub,
      created.player,
      created.inviteUrl,
      snapshot,
      0,
      0,
    );
    snapshot = await play(
      stub,
      joined.player,
      joined.inviteUrl,
      snapshot,
      0,
      1,
    );
    snapshot = await play(
      stub,
      created.player,
      created.inviteUrl,
      snapshot,
      0,
      0,
    );

    expect(snapshot.phase).toBe("ended");
    expect(snapshot.game.status.state).toBe("won");
    if (snapshot.game.status.state === "won")
      expect(snapshot.game.status.winner).toBe(1);

    const hostRematch = await stub.submitCommand(
      created.player,
      command("room:rematch-vote", { ready: true }),
      created.inviteUrl,
    );
    expect(unwrap(hostRematch).snapshot.rematch.readyPlayerIds).toContain(
      created.player.playerId,
    );

    const friendRematch = await stub.submitCommand(
      joined.player,
      command("room:rematch-vote", { ready: true }),
      joined.inviteUrl,
    );
    const rematched = unwrap(friendRematch).snapshot;
    expect(rematched.phase).toBe("playing");
    expect(rematched.game.moveHistory).toHaveLength(0);
    expect(rematched.match.number).toBe(2);
    expect(rematched.match.startingPlayer).toBe(2);
    expect(rematched.game.currentPlayer).toBe(2);
  });

  it("authenticates sockets, sends private snapshots, and lets the latest tab win", async () => {
    const created = await createRoom("Host");
    const first = await openSocket(created.player);
    const firstSnapshot = await first.firstEvent;
    expect(firstSnapshot.type).toBe("room:snapshot");
    if (firstSnapshot.type === "room:snapshot") {
      expect(firstSnapshot.payload.snapshot.you.playerId).toBe(
        created.player.playerId,
      );
    }

    const duplicateEvent = nextEvent(first.socket);
    const second = await openSocket(created.player);
    const duplicate = await duplicateEvent;
    const secondSnapshot = await second.firstEvent;

    expect(duplicate.type).toBe("room:error");
    if (duplicate.type === "room:error") {
      expect(duplicate.payload.error.code).toBe("duplicate-connection");
    }
    expect(secondSnapshot.type).toBe("room:snapshot");
    expect(first.socket.readyState).toBe(WebSocket.CLOSED);

    const bad = await SELF.fetch(
      `https://worker.test/api/rooms/${created.roomCode}/socket?playerId=${created.player.playerId}&reconnectToken=bad`,
      { headers: { Upgrade: "websocket" } },
    );
    const badPayload = (await bad.json()) as { error: RoomErrorPayload };
    expect(bad.status).toBe(403);
    expect(badPayload.error.code).toBe("auth-failed");

    second.socket.close();
  });

  it("supports HTTPS sync and command fallback when sockets are unavailable", async () => {
    const created = await createRoom("Host");
    const synced = await syncRoom(created.player);

    expect(synced.snapshot.players[0]?.connected).toBe(true);
    expect(synced.snapshot.you.playerId).toBe(created.player.playerId);

    const joined = await joinRoom(created.roomCode, "Friend");
    const hostReady = await sendHttpCommand(
      created.player,
      command("room:ready", { ready: true }),
    );

    expect(
      hostReady.snapshot.players.find(
        (player) => player.playerId === created.player.playerId,
      )?.ready,
    ).toBe(true);

    const friendReady = await sendHttpCommand(
      joined.player,
      command("room:ready", { ready: true }),
    );

    expect(friendReady.snapshot.phase).toBe("waiting");

    const started = await sendHttpCommand(
      created.player,
      command("room:start", {
        expectedRevision: friendReady.snapshot.revision,
      }),
    );

    expect(started.snapshot.phase).toBe("playing");
    expect(started.events.some((event) => event.type === "game:started")).toBe(
      true,
    );
  });
});

async function createRoom(displayName: string): Promise<CreateRoomResponse> {
  const response = await SELF.fetch("https://worker.test/api/rooms", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as CreateRoomResponse;
}

async function joinRoom(
  roomCode: string,
  displayName: string,
): Promise<JoinRoomResponse> {
  const response = await SELF.fetch(
    `https://worker.test/api/rooms/${roomCode}/join`,
    {
      method: "POST",
      body: JSON.stringify({ displayName }),
    },
  );
  expect(response.status).toBe(200);
  return (await response.json()) as JoinRoomResponse;
}

async function syncRoom(
  credentials: PlayerCredentials,
): Promise<RoomSyncResponse> {
  const response = await SELF.fetch(
    `https://worker.test/api/rooms/${credentials.roomCode}/sync`,
    {
      method: "POST",
      body: JSON.stringify({
        playerId: credentials.playerId,
        reconnectToken: credentials.reconnectToken,
      }),
    },
  );
  expect(response.status).toBe(200);
  return (await response.json()) as RoomSyncResponse;
}

async function sendHttpCommand<T extends ClientCommand>(
  credentials: PlayerCredentials,
  command: T,
): Promise<RoomCommandResponse> {
  const response = await SELF.fetch(
    `https://worker.test/api/rooms/${credentials.roomCode}/commands`,
    {
      method: "POST",
      body: JSON.stringify({
        playerId: credentials.playerId,
        reconnectToken: credentials.reconnectToken,
        command,
      }),
    },
  );
  expect(response.status).toBe(200);
  return (await response.json()) as RoomCommandResponse;
}

async function readyBoth(
  stub: RoomObjectRpc,
  host: PlayerCredentials,
  friend: PlayerCredentials,
  inviteUrl: string,
): Promise<PrivateRoomSnapshot> {
  const hostReady = await stub.submitCommand(
    host,
    command("room:ready", { ready: true }),
    inviteUrl,
  );
  unwrap(hostReady);
  const friendReady = await stub.submitCommand(
    friend,
    command("room:ready", { ready: true }),
    inviteUrl,
  );
  const ready = unwrap(friendReady).snapshot;
  const started = await stub.submitCommand(
    host,
    command("room:start", { expectedRevision: ready.revision }),
    inviteUrl,
  );
  return unwrap(started).snapshot;
}

async function play(
  stub: RoomObjectRpc,
  player: PlayerCredentials,
  inviteUrl: string,
  snapshot: PrivateRoomSnapshot,
  row: number,
  col: number,
): Promise<PrivateRoomSnapshot> {
  const result = await stub.submitCommand(
    player,
    command("game:play-move", {
      move: { row, col },
      expectedRevision: snapshot.revision,
    }),
    inviteUrl,
  );
  const value = unwrap(result);
  expect(
    value.events.some((event) => event.type === "game:move-accepted"),
  ).toBe(true);
  return value.snapshot;
}

function roomStub(roomCode: string): RoomObjectRpc {
  return env.AXIAL_ROOM.getByName(roomCode) as unknown as RoomObjectRpc;
}

function command<T extends ClientCommand["type"]>(
  type: T,
  payload: Extract<ClientCommand, { type: T }>["payload"],
): Extract<ClientCommand, { type: T }> {
  return {
    source: AXIAL_CLIENT_SOURCE,
    version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    type,
    payload,
  } as Extract<ClientCommand, { type: T }>;
}

function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: RoomErrorPayload },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

async function openSocket(credentials: PlayerCredentials): Promise<{
  socket: WebSocket;
  firstEvent: Promise<ServerEvent>;
}> {
  const response = await SELF.fetch(
    `https://worker.test/api/rooms/${credentials.roomCode}/socket?playerId=${credentials.playerId}&reconnectToken=${credentials.reconnectToken}`,
    { headers: { Upgrade: "websocket" } },
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  expect(socket).toBeTruthy();
  if (!socket) throw new Error("Expected test WebSocket");
  const firstEvent = nextEvent(socket);
  socket.accept();
  return { socket, firstEvent };
}

async function nextEvent(socket: WebSocket): Promise<ServerEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for WebSocket event")),
      1000,
    );
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(JSON.parse(String(event.data)) as ServerEvent);
      },
      { once: true },
    );
  });
}
