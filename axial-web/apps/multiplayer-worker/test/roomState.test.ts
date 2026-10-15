import { describe, expect, it, vi } from "vitest";
import * as core from "@axial/core";
import type { MultiplayerRules } from "@axial/multiplayer-protocol";
import { RoomServiceError } from "../src/errors";
import {
  addSecondPlayer,
  createInitialRoomState,
  expireRoom,
  expireStalePresence,
  HTTP_FALLBACK_LEASE_MS,
  markConnected,
  markDisconnected,
  markHttpFallbackSeen,
  nextRoomAlarmAt,
  normalizeStoredRoomState,
  playClassicMove,
  setPlayerName,
  setReadyState,
  setRematchVote,
  setRoomRules,
  START_COUNTDOWN_MS,
  startMatch,
  toPrivateSnapshot,
  toPublicSnapshot,
  type RoomCommandOutcome,
  type StoredRoomState,
} from "../src/roomState";

// Pass-through spies, so tests can count how often the room replays a match.
vi.mock("@axial/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@axial/core")>();
  return {
    ...actual,
    applyMove: vi.fn(actual.applyMove),
    replayMoves: vi.fn(actual.replayMoves),
  };
});

const T0 = 10_000;
const PLAYABLE_AT = T0 + START_COUNTDOWN_MS;
const INVITE_URL = "https://playaxial.dev/?room=ABCDEFGH";
const FIVE_IN_A_ROW: MultiplayerRules = {
  mode: "classic",
  board: { height: 7, rows: 6, columns: 8 },
  winCondition: { lineLength: 5, linesToWin: 1 },
};

describe("room transport presence", () => {
  it("keeps socket ownership while HTTP fallback refreshes presence", () => {
    const startedAt = 1_000;
    const initial = createInitialRoomState({
      roomCode: "ABCDEFGH",
      hostPlayerId: "host",
      hostDisplayName: "Host",
      hostTokenHash: "hash",
      now: startedAt,
    });
    const socketState = markConnected(
      initial,
      "host",
      "socket-1",
      startedAt + 1,
    ).state;
    const fallbackState = markHttpFallbackSeen(
      socketState,
      "host",
      startedAt + 2,
    ).state;
    const player = fallbackState.players[0];

    expect(player?.activeConnectionId).toBe("socket-1");
    expect(player?.httpFallbackLeaseUntil).toBe(
      startedAt + 2 + HTTP_FALLBACK_LEASE_MS,
    );
  });

  it("keeps fallback presence after socket close, then expires its lease", () => {
    const startedAt = 2_000;
    const initial = createInitialRoomState({
      roomCode: "ABCDEFGH",
      hostPlayerId: "host",
      hostDisplayName: "Host",
      hostTokenHash: "hash",
      now: startedAt,
    });
    const socketState = markConnected(
      initial,
      "host",
      "socket-1",
      startedAt + 1,
    ).state;
    const fallbackState = markHttpFallbackSeen(
      socketState,
      "host",
      startedAt + 2,
    ).state;
    const leaseUntil = startedAt + 2 + HTTP_FALLBACK_LEASE_MS;
    const socketClosed = markDisconnected(
      fallbackState,
      "host",
      "socket-1",
      startedAt + 3,
    );

    expect(socketClosed.events).toHaveLength(0);
    expect(socketClosed.state.players[0]?.connected).toBe(true);
    expect(nextRoomAlarmAt(socketClosed.state)).toBe(leaseUntil);

    const leaseExpired = expireStalePresence(socketClosed.state, leaseUntil);

    expect(leaseExpired.state.players[0]?.connected).toBe(false);
    expect(leaseExpired.state.players[0]?.httpFallbackLeaseUntil).toBeNull();
    expect(leaseExpired.events).toHaveLength(1);
    expect(leaseExpired.events[0]?.event.type).toBe("room:player-disconnected");
    expect(nextRoomAlarmAt(leaseExpired.state)).toBe(
      leaseExpired.state.expiresAt,
    );
  });
});

describe("move revision checks", () => {
  it("accepts a move whose snapshot is behind only on presence and names", () => {
    const started = startedRoom();
    let state = started;
    state = markDisconnected(state, "guest", "guest-socket", T0 + 100).state;
    state = markHttpFallbackSeen(state, "guest", T0 + 200).state;
    const leaseEnd = T0 + 200 + HTTP_FALLBACK_LEASE_MS;
    state = expireStalePresence(state, leaseEnd).state;
    state = markConnected(state, "guest", "guest-socket-2", leaseEnd + 1).state;
    state = setPlayerName(state, "guest", "Renamed", leaseEnd + 2).state;
    expect(state.revision).toBe(started.revision + 5);

    const outcome = play(state, "host", 0, started.revision, leaseEnd + 3);

    expect(outcome.events[0]?.event.type).toBe("game:move-accepted");
    expect(outcome.state.moveHistory).toHaveLength(1);
  });

  it("still rejects a move aimed at a board that has changed since", () => {
    const started = startedRoom();
    const afterHostMove = play(started, "host", 0).state;

    expect(
      roomErrorCode(() => play(afterHostMove, "guest", 1, started.revision)),
    ).toBe("stale-revision");

    const hostFlapped = markDisconnected(
      afterHostMove,
      "host",
      "host-socket",
      PLAYABLE_AT + 1,
    ).state;
    expect(
      roomErrorCode(() =>
        play(hostFlapped, "guest", 1, hostFlapped.revision + 1),
      ),
    ).toBe("stale-revision");
    expect(
      play(hostFlapped, "guest", 1, afterHostMove.revision).state.moveHistory,
    ).toHaveLength(2);
  });

  it("still rejects moves from before a rule change, match start or rematch", () => {
    const lobby = waitingRoom();
    const withRules = setRoomRules(
      lobby,
      "host",
      FIVE_IN_A_ROW,
      lobby.revision,
      T0,
    ).state;
    const readied = readyBoth(withRules);
    const started = startMatch(readied, "host", readied.revision, T0).state;

    expect(roomErrorCode(() => play(started, "host", 0, lobby.revision))).toBe(
      "stale-revision",
    );
    expect(
      roomErrorCode(() => play(started, "host", 0, readied.revision)),
    ).toBe("stale-revision");

    const ended = playHostWin(startedRoom());
    expect(ended.phase).toBe("ended");
    const hostVoted = setRematchVote(ended, "host", true, PLAYABLE_AT + 10);
    const rematch = setRematchVote(
      hostVoted.state,
      "guest",
      true,
      PLAYABLE_AT + 11,
    ).state;
    const rematchPlayable = (rematch.matchPlayableAt ?? 0) + 1;
    expect(rematch.matchNumber).toBe(2);

    for (const seen of [ended.revision, hostVoted.state.revision]) {
      expect(
        roomErrorCode(() => play(rematch, "guest", 0, seen, rematchPlayable)),
      ).toBe("stale-revision");
    }
    expect(
      play(rematch, "guest", 0, rematch.revision, rematchPlayable).state
        .moveHistory,
    ).toHaveLength(1);
  });

  it("advances the game revision only for changes to the game itself", () => {
    const gameChanges: Array<(state: StoredRoomState) => StoredRoomState> = [
      (state) =>
        setRoomRules(state, "host", FIVE_IN_A_ROW, state.revision, T0).state,
      (state) => startedRoom(state),
      (state) => play(startedRoom(state), "host", 0).state,
      (state) => {
        const ended = playHostWin(startedRoom(state));
        const hostVoted = setRematchVote(ended, "host", true, PLAYABLE_AT);
        return setRematchVote(hostVoted.state, "guest", true, PLAYABLE_AT)
          .state;
      },
      (state) => expireRoom(state, T0).state,
    ];
    for (const change of gameChanges) {
      const changed = change(waitingRoom());
      expect(changed.gameRevision).toBe(changed.revision);
    }

    const dropGuest = (state: StoredRoomState) =>
      markDisconnected(state, "guest", "guest-socket", PLAYABLE_AT).state;
    const roomChanges: Array<(state: StoredRoomState) => StoredRoomState> = [
      dropGuest,
      (state) =>
        markConnected(dropGuest(state), "guest", "guest-2", PLAYABLE_AT).state,
      (state) =>
        markHttpFallbackSeen(dropGuest(state), "guest", PLAYABLE_AT).state,
      (state) => {
        const leased = markHttpFallbackSeen(
          dropGuest(state),
          "guest",
          PLAYABLE_AT,
        ).state;
        const leaseEnd = PLAYABLE_AT + HTTP_FALLBACK_LEASE_MS;
        return expireStalePresence(leased, leaseEnd).state;
      },
      (state) => setPlayerName(state, "host", "Renamed", PLAYABLE_AT).state,
    ];
    const started = startedRoom();
    for (const change of roomChanges) {
      const changed = change(started);
      expect(changed.revision).toBeGreaterThan(started.revision);
      expect(changed.gameRevision).toBe(started.gameRevision);
    }

    const lobby = waitingRoom();
    expect(lobby.revision).toBeGreaterThan(lobby.gameRevision);
    expect(setReadyState(lobby, "host", true, T0).state.gameRevision).toBe(
      lobby.gameRevision,
    );
    const ended = playHostWin(startedRoom());
    const vote = setRematchVote(ended, "host", true, PLAYABLE_AT);
    expect(vote.state.gameRevision).toBe(ended.gameRevision);
  });

  it("keeps exact revision checks for rooms stored before game revisions", () => {
    const started = startedRoom();
    const flapped = markDisconnected(
      started,
      "guest",
      "guest-socket",
      PLAYABLE_AT,
    ).state;
    const legacy: Partial<StoredRoomState> = { ...flapped };
    delete legacy.gameRevision;
    const reloaded = normalizeStoredRoomState(legacy as StoredRoomState);

    expect(reloaded.gameRevision).toBe(flapped.revision);
    expect(
      roomErrorCode(() => play(reloaded, "host", 0, started.revision)),
    ).toBe("stale-revision");
    expect(
      play(reloaded, "host", 0, reloaded.revision).state.moveHistory,
    ).toHaveLength(1);
  });
});

describe("derived game cache", () => {
  it("serves the same snapshots as a fresh replay across moves, rules and rematch", () => {
    const steps: Array<{
      label: string;
      run: (state: StoredRoomState) => RoomCommandOutcome;
    }> = [];
    const at = (offset: number) => PLAYABLE_AT + offset;
    let state = waitingRoom();
    // Warm the cache with the default rules, then change them in the lobby.
    toPublicSnapshot(state);
    steps.push({
      label: "rules",
      run: (current) =>
        setRoomRules(current, "host", FIVE_IN_A_ROW, current.revision, T0),
    });
    steps.push({
      label: "start",
      run: (current) => {
        const readied = readyBoth(current);
        return startMatch(readied, "host", readied.revision, T0);
      },
    });
    const match1 = [0, 1, 0, 1, 0, 1, 0, 1, 0];
    match1.forEach((col, index) =>
      steps.push({
        label: `match 1 move ${index + 1}`,
        run: (current) =>
          play(
            current,
            index % 2 === 0 ? "host" : "guest",
            col,
            current.revision,
            at(index),
          ),
      }),
    );
    steps.push({
      label: "guest flap",
      run: (current) =>
        markDisconnected(current, "guest", "guest-socket", at(20)),
    });
    steps.push({
      label: "host rematch vote",
      run: (current) => setRematchVote(current, "host", true, at(21)),
    });
    steps.push({
      label: "guest rematch vote",
      run: (current) => setRematchVote(current, "guest", true, at(22)),
    });
    [2, 2, 3].forEach((col, index) =>
      steps.push({
        label: `match 2 move ${index + 1}`,
        run: (current) =>
          play(
            current,
            index % 2 === 0 ? "guest" : "host",
            col,
            current.revision,
            (current.matchPlayableAt ?? 0) + index,
          ),
      }),
    );
    steps.push({
      label: "leave",
      run: (current) => expireRoom(current, at(9_000)),
    });

    for (const step of steps) {
      const outcome = step.run(state);
      state = outcome.state;
      const fresh = toPublicSnapshot(reloadFromStorage(state));

      expect(toPublicSnapshot(state), step.label).toStrictEqual(fresh);
      for (const { event } of outcome.events) {
        if ("snapshot" in event.payload) {
          expect(event.payload.snapshot, step.label).toStrictEqual(fresh);
        }
      }
    }

    expect(state.matchNumber).toBe(2);
    expect(toPublicSnapshot(state).game.dimensions).toEqual(
      FIVE_IN_A_ROW.board,
    );
    expect(toPublicSnapshot(state).game.moveHistory).toHaveLength(3);
  });

  it("replays a match at most once per command, and not at all once warm", () => {
    const replays = vi.mocked(core.replayMoves);
    const applied = vi.mocked(core.applyMove);
    let state = startedRoom();
    for (const [index, col] of [0, 1, 0, 1].entries()) {
      state = play(state, index % 2 === 0 ? "host" : "guest", col).state;
    }

    // A room object that just woke up has only the stored JSON.
    replays.mockClear();
    applied.mockClear();
    const cold = reloadFromStorage(state);
    const coldMove = play(cold, "host", 0);
    toPrivateSnapshot(coldMove.state, "host", INVITE_URL);
    expect(replays).toHaveBeenCalledTimes(1);
    expect(applied).toHaveBeenCalledTimes(1);

    replays.mockClear();
    applied.mockClear();
    const poll = markHttpFallbackSeen(coldMove.state, "guest", PLAYABLE_AT + 1);
    toPrivateSnapshot(poll.state, "guest", INVITE_URL);
    const flap = markDisconnected(
      poll.state,
      "host",
      "host-socket",
      PLAYABLE_AT + 2,
    );
    const guestMove = play(flap.state, "guest", 1, flap.state.revision);
    toPrivateSnapshot(guestMove.state, "guest", INVITE_URL);
    // This move wins, so it also emits game:ended with its own snapshot.
    const winningMove = play(guestMove.state, "host", 0);
    toPrivateSnapshot(winningMove.state, "host", INVITE_URL);
    expect(winningMove.events.map(({ event }) => event.type)).toEqual([
      "game:move-accepted",
      "game:ended",
    ]);
    expect(replays).not.toHaveBeenCalled();
    expect(applied).toHaveBeenCalledTimes(2);
  });
});

function waitingRoom(): StoredRoomState {
  let state = createInitialRoomState({
    roomCode: "ABCDEFGH",
    hostPlayerId: "host",
    hostDisplayName: "Host",
    hostTokenHash: "host-hash",
    now: T0,
  });
  state = addSecondPlayer(state, {
    playerId: "guest",
    displayName: "Guest",
    tokenHash: "guest-hash",
    now: T0,
  }).state;
  state = markConnected(state, "host", "host-socket", T0).state;
  return markConnected(state, "guest", "guest-socket", T0).state;
}

function readyBoth(state: StoredRoomState): StoredRoomState {
  const hostReady = setReadyState(state, "host", true, T0).state;
  return setReadyState(hostReady, "guest", true, T0).state;
}

function startedRoom(state = waitingRoom()): StoredRoomState {
  const readied = readyBoth(state);
  return startMatch(readied, "host", readied.revision, T0).state;
}

function play(
  state: StoredRoomState,
  playerId: string,
  col: number,
  expectedRevision = state.revision,
  now = PLAYABLE_AT,
): RoomCommandOutcome {
  return playClassicMove(
    state,
    playerId,
    { row: 0, col },
    expectedRevision,
    now,
  );
}

// Four host pieces stacked in one column win under the default rules.
function playHostWin(started: StoredRoomState): StoredRoomState {
  let state = started;
  for (const [index, col] of [0, 1, 0, 1, 0, 1, 0].entries()) {
    state = play(state, index % 2 === 0 ? "host" : "guest", col).state;
  }
  return state;
}

function reloadFromStorage(state: StoredRoomState): StoredRoomState {
  return normalizeStoredRoomState(
    JSON.parse(JSON.stringify(state)) as StoredRoomState,
  );
}

function roomErrorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof RoomServiceError) return error.code;
    throw error;
  }
  return "no error";
}
