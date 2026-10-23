import {
  env,
  SELF,
  runInDurableObject,
  runDurableObjectAlarm,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { EXPIRED_RETENTION_MS } from "../src/roomState";

afterEach(() => vi.restoreAllMocks());
let nextFixtureClient = 1;

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

    // A match only starts with both players present.
    await stub.syncPlayer(created.player, created.inviteUrl);
    await stub.syncPlayer(joined.player, joined.inviteUrl);
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

    const earlyMove = await stub.submitCommand(
      created.player,
      command("game:play-move", {
        move: { row: 0, col: 0 },
        expectedRevision: snapshot.revision,
      }),
      created.inviteUrl,
    );
    expect(earlyMove.ok).toBe(false);
    if (!earlyMove.ok) {
      expect(earlyMove.error.code).toBe("match-not-playable");
      expect(earlyMove.error.details?.playableAt).toBe(
        snapshot.match.playableAt,
      );
    }

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

    await waitUntilPlayable(snapshot);

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

  it("rejects an oversized socket message without changing the room or losing the connection", async () => {
    const created = await createRoom("Host");
    const connection = await openSocket(created.player);
    await connection.firstEvent;
    const rejected = nextEvent(connection.socket);
    connection.socket.send("x".repeat(4097));
    const error = await rejected;
    expect(error.type).toBe("room:error");
    if (error.type === "room:error") {
      expect(error.payload.error.code).toBe("invalid-message");
      expect(error.payload.error.message).toBe("Client message is too large.");
    }
    const accepted = nextEvent(connection.socket);
    connection.socket.send(
      JSON.stringify(
        command("room:set-name", { displayName: "Still connected" }),
      ),
    );
    const updated = await accepted;
    expect(updated.type).toBe("room:player-updated");
    connection.socket.close();
  });

  it("keeps a healthy socket authoritative during HTTPS fallback sync", async () => {
    const created = await createRoom("Host");
    const connection = await openSocket(created.player);
    await connection.firstEvent;

    await syncRoom(created.player);

    const updateEvent = nextEvent(connection.socket);
    connection.socket.send(
      JSON.stringify(
        command("room:set-name", {
          displayName: "Socket Host",
        }),
      ),
    );
    const event = await updateEvent;

    expect(event.type).toBe("room:player-updated");
    if (event.type === "room:player-updated") {
      expect(
        event.payload.snapshot.players.find(
          (player) => player.playerId === created.player.playerId,
        )?.displayName,
      ).toBe("Socket Host");
    }

    connection.socket.close();
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

  it("accepts a fallback move whose snapshot is behind only on presence", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const stub = roomStub(created.roomCode);
    const started = await readyBoth(
      stub,
      created.player,
      joined.player,
      created.inviteUrl,
    );
    vi.spyOn(Date, "now").mockReturnValue((started.match.playableAt ?? 0) + 1);

    const hostView = await syncRoom(created.player);
    // A rename, like a reconnect, bumps the revision but not the game after the host's last
    // poll. (Both players are already present: a match only starts when they are.)
    const guestView = await sendHttpCommand(
      joined.player,
      command("room:set-name", { displayName: "Friend 2" }),
    );
    expect(guestView.snapshot.revision).toBeGreaterThan(
      hostView.snapshot.revision,
    );

    const hostMove = await sendHttpCommand(
      created.player,
      command("game:play-move", {
        move: { row: 0, col: 0 },
        expectedRevision: hostView.snapshot.revision,
      }),
    );
    expect(hostMove.events.map((event) => event.type)).toContain(
      "game:move-accepted",
    );
    expect(hostMove.snapshot.game.moveHistory).toHaveLength(1);

    const staleGuestMove = await postHttpCommand(
      joined.player,
      command("game:play-move", {
        move: { row: 0, col: 1 },
        expectedRevision: guestView.snapshot.revision,
      }),
    );
    const staleError = (await staleGuestMove.json()) as {
      error: RoomErrorPayload;
    };
    expect(staleGuestMove.status).toBe(409);
    expect(staleError.error.code).toBe("stale-revision");
  });

  it("expires the private room for both players on explicit leave", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const stub = roomStub(created.roomCode);

    const left = await stub.submitCommand(
      created.player,
      command("room:leave", {}),
      created.inviteUrl,
    );

    expect(unwrap(left).snapshot.phase).toBe("expired");
    expect(unwrap(left).events.at(-1)?.type).toBe("room:expired");

    const opponentSync = await stub.syncPlayer(joined.player, joined.inviteUrl);
    expect(opponentSync.ok).toBe(false);
    if (!opponentSync.ok) expect(opponentSync.error.code).toBe("room-expired");
  });
});

describe("concurrent room requests", () => {
  it("does not let an HTTP command commit the state it read before checking credentials", async () => {
    const created = await createRoom("Host");
    const joined = await joinRoom(created.roomCode, "Friend");
    const stub = roomStub(created.roomCode);
    const digest = pauseNextDigest();

    const slowCommand = sendHttpCommand(
      created.player,
      command("room:ready", { ready: true }),
    );
    await digest.reached();
    const rename = unwrap(
      await stub.submitCommand(
        joined.player,
        command("room:set-name", { displayName: "Renamed friend" }),
        joined.inviteUrl,
      ),
    );
    digest.release();
    const result = await slowCommand;

    const friend = result.snapshot.players.find(
      (player) => player.playerId === joined.player.playerId,
    );
    expect(friend?.displayName).toBe("Renamed friend");
    expect(result.snapshot.revision).toBeGreaterThan(rename.snapshot.revision);
    const stored = unwrap(
      await stub.syncPlayer(joined.player, joined.inviteUrl),
    );
    expect(
      stored.snapshot.players.find(
        (player) => player.playerId === joined.player.playerId,
      )?.displayName,
    ).toBe("Renamed friend");
    expect(
      stored.snapshot.players.find(
        (player) => player.playerId === created.player.playerId,
      )?.ready,
    ).toBe(true);
  });

  it("gives the second seat to only one of two simultaneous joins", async () => {
    const created = await createRoom("Host");
    const digest = pauseNextDigest();

    const slowJoin = SELF.fetch(
      `https://worker.test/api/rooms/${created.roomCode}/join`,
      { method: "POST", body: JSON.stringify({ displayName: "Slow" }) },
    );
    await digest.reached();
    const fastJoin = await joinRoom(created.roomCode, "Fast");
    digest.release();
    const slow = await slowJoin;
    const slowError = (await slow.json()) as { error: RoomErrorPayload };

    expect(slow.status).toBe(409);
    expect(slowError.error.code).toBe("room-full");
    const synced = unwrap(
      await roomStub(created.roomCode).syncPlayer(
        fastJoin.player,
        fastJoin.inviteUrl,
      ),
    );
    expect(synced.snapshot.players.map((player) => player.displayName)).toEqual(
      ["Host", "Fast"],
    );
  });
});

describe("expired room retention", () => {
  it("does not recreate storage on a fresh lookup for a missing room", async () => {
    const stub = env.AXIAL_ROOM.getByName("MISSING1");
    const missing = await stub.syncPlayer(
      { playerId: "old-player", reconnectToken: "old-secret" },
      "https://playaxial.dev/?room=MISSING1",
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("room-not-found");
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
      expect(
        state.storage.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE name IN ('room_state', 'room_events', '_sql_schema_migrations')",
          )
          .toArray(),
      ).toHaveLength(0);
    });
  });

  it("retains expired rooms for 24 hours, then removes storage and safely reuses the code", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const created = await createRoom("Retention host");
    const stub = env.AXIAL_ROOM.getByName(created.roomCode);
    const expired = unwrap(
      await stub.submitCommand(
        created.player,
        command("room:leave", {}),
        created.inviteUrl,
      ),
    );
    const cleanupAt = expired.snapshot.expiresAt + EXPIRED_RETENTION_MS;
    expect(cleanupAt).toBe(now + 24 * 60 * 60 * 1000);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBe(cleanupAt);
      await state.storage.put("retention-test", "also removed");
    });

    const reuseInput = {
      roomCode: created.roomCode,
      displayName: "Replacement host",
      reconnectToken: "replacement-secret",
      inviteUrl: created.inviteUrl,
    };
    const prematureReuse = await stub.createRoom(reuseInput);
    expect(prematureReuse.ok).toBe(false);
    if (!prematureReuse.ok)
      expect(prematureReuse.error.code).toBe("room-conflict");

    clock.mockReturnValue(cleanupAt - 1);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const graceSync = await stub.syncPlayer(created.player, created.inviteUrl);
    expect(graceSync.ok).toBe(false);
    if (!graceSync.ok) expect(graceSync.error.code).toBe("room-expired");
    await runInDurableObject(stub, async (_instance, state) => {
      expect(
        state.storage.sql.exec("SELECT * FROM room_state").toArray(),
      ).toHaveLength(1);
      expect(await state.storage.getAlarm()).toBe(cleanupAt);
    });

    clock.mockReturnValue(cleanupAt);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
      expect((await state.storage.list()).size).toBe(0);
      expect(
        state.storage.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE name IN ('room_state', 'room_events', '_sql_schema_migrations')",
          )
          .toArray(),
      ).toHaveLength(0);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(false);
    const missingSync = await stub.syncPlayer(
      created.player,
      created.inviteUrl,
    );
    expect(missingSync.ok).toBe(false);
    if (!missingSync.ok) expect(missingSync.error.code).toBe("room-not-found");

    const replacement = unwrap(await stub.createRoom(reuseInput));
    expect(replacement.player.playerId).not.toBe(created.player.playerId);
    expect(replacement.snapshot.players).toHaveLength(1);
    expect(replacement.snapshot.players[0]?.displayName).toBe(
      "Replacement host",
    );
    const oldCredentials = await stub.syncPlayer(
      created.player,
      created.inviteUrl,
    );
    expect(oldCredentials.ok).toBe(false);
    if (!oldCredentials.ok)
      expect(oldCredentials.error.code).toBe("auth-failed");
    const newCredentials = await stub.syncPlayer(
      replacement.player,
      replacement.inviteUrl,
    );
    expect(newCredentials.ok).toBe(true);
    await runInDurableObject(stub, (_instance, state) => {
      const events = state.storage.sql
        .exec<{ type: string }>("SELECT type FROM room_events")
        .toArray();
      expect(events.some((event) => event.type === "room:expired")).toBe(false);
      expect(events[0]?.type).toBe("room:created");
    });
  });

  it("does not delete an active room and gives natural expiry its own retention period", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const created = await createRoom("Active host");
    const stub = env.AXIAL_ROOM.getByName(created.roomCode);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql
        .exec<{ state_json: string }>("SELECT state_json FROM room_state")
        .one();
      expect(JSON.parse(row.state_json).phase).toBe("waiting");
      expect(await state.storage.getAlarm()).toBe(created.snapshot.expiresAt);
    });
    clock.mockReturnValue(created.snapshot.expiresAt);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql
        .exec<{ state_json: string }>("SELECT state_json FROM room_state")
        .one();
      expect(JSON.parse(row.state_json).phase).toBe("expired");
      expect(await state.storage.getAlarm()).toBe(
        created.snapshot.expiresAt + EXPIRED_RETENTION_MS,
      );
    });
  });

  it("repairs legacy missing alarms on access and lazily removes overdue records", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const created = await createRoom("Legacy host");
    const stub = env.AXIAL_ROOM.getByName(created.roomCode);
    unwrap(
      await stub.submitCommand(
        created.player,
        command("room:leave", {}),
        created.inviteUrl,
      ),
    );
    await runInDurableObject(stub, async (_instance, state) => {
      await state.storage.deleteAlarm();
      expect(await state.storage.getAlarm()).toBeNull();
    });
    const grace = await stub.syncPlayer(created.player, created.inviteUrl);
    expect(grace.ok).toBe(false);
    if (!grace.ok) expect(grace.error.code).toBe("room-expired");
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBe(now + EXPIRED_RETENTION_MS);
      await state.storage.deleteAlarm();
    });
    clock.mockReturnValue(now + EXPIRED_RETENTION_MS + 1);
    const lateJoin = await stub.joinRoom({
      displayName: "Visitor",
      reconnectToken: "visitor-secret",
      inviteUrl: created.inviteUrl,
    });
    expect(lateJoin.ok).toBe(false);
    if (!lateJoin.ok) expect(lateJoin.error.code).toBe("room-not-found");
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
      expect(
        state.storage.sql
          .exec("SELECT name FROM sqlite_master WHERE name = 'room_state'")
          .toArray(),
      ).toHaveLength(0);
    });
  });
});

async function createRoom(displayName: string): Promise<CreateRoomResponse> {
  const clientIp = `192.0.2.${nextFixtureClient++}`;
  const response = await SELF.fetch("https://worker.test/api/rooms", {
    method: "POST",
    body: JSON.stringify({ displayName }),
    headers: { "CF-Connecting-IP": clientIp },
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
  const response = await postHttpCommand(credentials, command);
  expect(response.status).toBe(200);
  return (await response.json()) as RoomCommandResponse;
}

function postHttpCommand(
  credentials: PlayerCredentials,
  command: ClientCommand,
): Promise<Response> {
  return SELF.fetch(
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
}

async function readyBoth(
  stub: RoomObjectRpc,
  host: PlayerCredentials,
  friend: PlayerCredentials,
  inviteUrl: string,
): Promise<PrivateRoomSnapshot> {
  await stub.syncPlayer(host, inviteUrl);
  await stub.syncPlayer(friend, inviteUrl);
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

async function waitUntilPlayable(snapshot: PrivateRoomSnapshot): Promise<void> {
  const waitMs = Math.max(
    0,
    (snapshot.match.playableAt ?? 0) - Date.now() + 25,
  );
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// Holds the next SHA-256 digest until released. Credential hashing awaits
// crypto rather than storage, so the room's input gate admits other requests
// while it is pending; this makes that interleaving deterministic.
function pauseNextDigest(): {
  reached: () => Promise<void>;
  release: () => void;
} {
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let reached = false;
  let released = false;
  vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
    async (algorithm, data) => {
      reached = true;
      await until(() => released);
      return digest(algorithm, data);
    },
  );
  return {
    reached: () => until(() => reached),
    release: () => {
      released = true;
    },
  };
}

// Polls with timers instead of sharing a promise: workerd continues a promise
// in the I/O context that resolved it, and the test and the room object must
// each keep running in their own context.
async function until(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
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
