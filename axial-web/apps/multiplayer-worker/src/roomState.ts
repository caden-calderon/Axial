import {
  applyMove,
  createGame,
  replayMoves,
  type GameSnapshot,
  type Player,
  type PlacedMove,
  type ReplayMove,
} from "@axial/core";
import type {
  MultiplayerRules,
  PlayerCredentials,
  PlayerIdentity,
  PrivateRoomSnapshot,
  RoomErrorPayload,
  RoomPhase,
  RoomPlayer,
  RoomSnapshot,
  SerializableGameSnapshot,
  ServerEvent,
  ServerEventType,
} from "@axial/multiplayer-protocol";
import {
  AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
  AXIAL_ROOM_SOURCE,
} from "@axial/multiplayer-protocol";
import { RoomServiceError } from "./errors";
import { defaultRules, normalizeDisplayName } from "./validation";

export const ROOM_EVENT_HISTORY_LIMIT = 80;
export const WAITING_EMPTY_TTL_MS = 15 * 60 * 1000;
export const WAITING_ACTIVE_TTL_MS = 6 * 60 * 60 * 1000;
export const PLAYING_EMPTY_TTL_MS = 2 * 60 * 60 * 1000;
export const PLAYING_ACTIVE_TTL_MS = 24 * 60 * 60 * 1000;
export const ENDED_TTL_MS = 45 * 60 * 1000;

export type StoredPlayer = {
  playerId: string;
  seat: Player;
  displayName: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  disconnectedAt: number | null;
  reconnectTokenHash: string;
  activeConnectionId: string | null;
  rematchReady: boolean;
};

export type StoredRoomState = {
  version: 1;
  roomCode: string;
  phase: RoomPhase;
  revision: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  hostPlayerId: string;
  rules: MultiplayerRules;
  players: StoredPlayer[];
  moveHistory: ReplayMove[];
};

export type RoomEventRecord = {
  revision: number;
  sequence: number;
  type: ServerEventType;
  event: ServerEvent;
  createdAt: number;
};

export type RoomMutationEvent = {
  event: ServerEvent;
  privateOnly?: boolean;
};

export type RoomCommandOutcome = {
  state: StoredRoomState;
  events: RoomMutationEvent[];
};

export function createInitialRoomState(input: {
  roomCode: string;
  hostPlayerId: string;
  hostDisplayName: string;
  hostTokenHash: string;
  now: number;
  rules?: MultiplayerRules;
}): StoredRoomState {
  const state: StoredRoomState = {
    version: 1,
    roomCode: input.roomCode,
    phase: "waiting",
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + WAITING_EMPTY_TTL_MS,
    hostPlayerId: input.hostPlayerId,
    rules: input.rules ?? defaultRules(),
    players: [
      {
        playerId: input.hostPlayerId,
        seat: 1,
        displayName: input.hostDisplayName,
        isHost: true,
        ready: false,
        connected: false,
        joinedAt: input.now,
        lastSeenAt: input.now,
        disconnectedAt: null,
        reconnectTokenHash: input.hostTokenHash,
        activeConnectionId: null,
        rematchReady: false,
      },
    ],
    moveHistory: [],
  };

  return refreshExpiry(state, input.now);
}

export function addSecondPlayer(
  state: StoredRoomState,
  input: {
    playerId: string;
    displayName: string;
    tokenHash: string;
    now: number;
    commandId?: string;
  },
): RoomCommandOutcome {
  assertUsableRoom(state);
  if (state.players.length >= 2) {
    throw new RoomServiceError(
      "room-full",
      "This room already has two players.",
      409,
    );
  }
  if (state.phase !== "waiting") {
    throw new RoomServiceError(
      "room-full",
      "This match has already started.",
      409,
    );
  }

  const next = cloneState(state);
  next.players.push({
    playerId: input.playerId,
    seat: 2,
    displayName: input.displayName,
    isHost: false,
    ready: false,
    connected: false,
    joinedAt: input.now,
    lastSeenAt: input.now,
    disconnectedAt: null,
    reconnectTokenHash: input.tokenHash,
    activeConnectionId: null,
    rematchReady: false,
  });
  touch(next, input.now);

  return withPublicEvent(next, "room:player-joined", input.commandId);
}

export function markConnected(
  state: StoredRoomState,
  playerId: string,
  connectionId: string,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  const next = cloneState(state);
  const player = requirePlayer(next, playerId);
  const wasDisconnected = !player.connected;

  player.connected = true;
  player.activeConnectionId = connectionId;
  player.disconnectedAt = null;
  player.lastSeenAt = now;
  touchWithoutRevision(next, now);

  if (!wasDisconnected) return { state: refreshExpiry(next, now), events: [] };

  touch(next, now);
  return withPublicEvent(next, "room:player-reconnected", commandId, {
    playerId,
  });
}

export function markDisconnected(
  state: StoredRoomState,
  playerId: string,
  connectionId: string,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  const next = cloneState(state);
  const player = requirePlayer(next, playerId);
  if (player.activeConnectionId !== connectionId) {
    return { state: refreshExpiry(next, now), events: [] };
  }

  player.connected = false;
  player.activeConnectionId = null;
  player.disconnectedAt = now;
  player.lastSeenAt = now;
  touch(next, now);

  return withPublicEvent(next, "room:player-disconnected", commandId, {
    playerId,
  });
}

export function setPlayerName(
  state: StoredRoomState,
  playerId: string,
  displayName: string,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  assertUsableRoom(state);
  const next = cloneState(state);
  const player = requirePlayer(next, playerId);
  player.displayName = normalizeDisplayName(displayName, player.displayName);
  player.lastSeenAt = now;
  touch(next, now);
  return withPublicEvent(next, "room:player-updated", commandId);
}

export function setRoomRules(
  state: StoredRoomState,
  playerId: string,
  rules: MultiplayerRules,
  expectedRevision: number | undefined,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  assertUsableRoom(state);
  assertExpectedRevision(state, expectedRevision);
  const player = requirePlayer(state, playerId);
  if (!player.isHost) {
    throw new RoomServiceError(
      "not-host",
      "Only the host can change room rules.",
      403,
    );
  }
  if (state.phase !== "waiting") {
    throw new RoomServiceError(
      "invalid-rules",
      "Rules can only change before the match starts.",
      409,
    );
  }

  const next = cloneState(state);
  next.rules = rules;
  next.moveHistory = [];
  for (const roomPlayer of next.players) roomPlayer.ready = false;
  touch(next, now);
  return withPublicEvent(next, "room:rules-updated", commandId);
}

export function setReadyState(
  state: StoredRoomState,
  playerId: string,
  ready: boolean,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  assertUsableRoom(state);
  if (state.phase !== "waiting") {
    throw new RoomServiceError(
      "invalid-message",
      "Ready state only applies before the match starts.",
      409,
    );
  }

  const next = cloneState(state);
  const player = requirePlayer(next, playerId);
  player.ready = ready;
  player.lastSeenAt = now;

  const bothReady =
    next.players.length === 2 &&
    next.players.every((roomPlayer) => roomPlayer.ready);
  if (bothReady) {
    next.phase = "playing";
    next.moveHistory = [];
    for (const roomPlayer of next.players) roomPlayer.rematchReady = false;
    touch(next, now);
    return withPublicEvent(next, "game:started", commandId);
  }

  touch(next, now);
  return withPublicEvent(next, "room:ready-updated", commandId);
}

export function playClassicMove(
  state: StoredRoomState,
  playerId: string,
  move: { row: number; col: number },
  expectedRevision: number | undefined,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  assertUsableRoom(state);
  assertExpectedRevision(state, expectedRevision);
  if (state.phase !== "playing") {
    throw new RoomServiceError(
      "illegal-move",
      "Moves are only accepted while the match is playing.",
      409,
    );
  }

  const player = requirePlayer(state, playerId);
  const game = currentGame(state);
  if (game.status.state !== "playing") {
    throw new RoomServiceError(
      "illegal-move",
      "This match is already over.",
      409,
    );
  }
  if (game.currentPlayer !== player.seat) {
    throw new RoomServiceError("not-your-turn", "It is not your turn.", 409);
  }

  let nextGame: GameSnapshot;
  try {
    nextGame = applyMove(game, move);
  } catch (error) {
    throw new RoomServiceError(
      "illegal-move",
      error instanceof Error ? error.message : "That move is not legal.",
      400,
    );
  }

  const placed = nextGame.lastMove;
  if (!placed) {
    throw new RoomServiceError(
      "internal-error",
      "The core rules accepted a move without placing it.",
      500,
    );
  }

  const next = cloneState(state);
  next.moveHistory = nextGame.moveHistory.map(toReplayMove);
  if (nextGame.status.state !== "playing") {
    next.phase = "ended";
    for (const roomPlayer of next.players) {
      roomPlayer.ready = false;
      roomPlayer.rematchReady = false;
    }
  }
  touch(next, now);

  const events = createPublicEvents(next, "game:move-accepted", commandId, {
    move: placed,
  });
  if (next.phase === "ended") {
    events.push(...createPublicEvents(next, "game:ended", commandId));
  }

  return { state: next, events };
}

export function setRematchVote(
  state: StoredRoomState,
  playerId: string,
  ready: boolean,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  assertUsableRoom(state);
  if (state.phase !== "ended") {
    throw new RoomServiceError(
      "invalid-message",
      "Rematch voting opens after game over.",
      409,
    );
  }

  const next = cloneState(state);
  const player = requirePlayer(next, playerId);
  player.rematchReady = ready;
  player.lastSeenAt = now;

  if (
    next.players.length === 2 &&
    next.players.every((roomPlayer) => roomPlayer.rematchReady)
  ) {
    next.phase = "playing";
    next.moveHistory = [];
    for (const roomPlayer of next.players) {
      roomPlayer.ready = false;
      roomPlayer.rematchReady = false;
    }
    touch(next, now);
    return withPublicEvent(next, "game:started", commandId);
  }

  touch(next, now);
  return withPublicEvent(next, "room:rematch-updated", commandId);
}

export function expireRoom(
  state: StoredRoomState,
  now: number,
  commandId?: string,
): RoomCommandOutcome {
  if (state.phase === "expired") return { state, events: [] };

  const next = cloneState(state);
  next.phase = "expired";
  for (const player of next.players) {
    player.connected = false;
    player.activeConnectionId = null;
    player.disconnectedAt = player.disconnectedAt ?? now;
    player.lastSeenAt = now;
  }
  touch(next, now);
  next.expiresAt = now;
  return withPublicEvent(next, "room:expired", commandId);
}

export function shouldExpire(state: StoredRoomState, now: number): boolean {
  return state.phase !== "expired" && state.expiresAt <= now;
}

export function currentGame(state: StoredRoomState): GameSnapshot {
  if (state.moveHistory.length === 0) {
    return createGame(state.rules.winCondition, state.rules.board);
  }
  return replayMoves(
    state.moveHistory,
    state.rules.winCondition,
    state.rules.board,
  );
}

export function toPublicSnapshot(state: StoredRoomState): RoomSnapshot {
  const game = currentGame(state);
  return {
    roomCode: state.roomCode,
    phase: state.phase,
    revision: state.revision,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    expiresAt: state.expiresAt,
    hostPlayerId: state.hostPlayerId,
    rules: cloneRules(state.rules),
    players: state.players.map(toPublicPlayer),
    game: toSerializableGame(game),
    rematch: {
      readyPlayerIds: state.players
        .filter((player) => player.rematchReady)
        .map((player) => player.playerId),
    },
  };
}

export function toPrivateSnapshot(
  state: StoredRoomState,
  playerId: string,
  inviteUrl: string,
): PrivateRoomSnapshot {
  const player = requirePlayer(state, playerId);
  return {
    ...toPublicSnapshot(state),
    you: toPlayerIdentity(player),
    inviteUrl,
    qrPayload: inviteUrl,
  };
}

export function toCredentials(
  state: StoredRoomState,
  playerId: string,
  reconnectToken: string,
): PlayerCredentials {
  const player = requirePlayer(state, playerId);
  return {
    roomCode: state.roomCode,
    playerId,
    reconnectToken,
    seat: player.seat,
    isHost: player.isHost,
    displayName: player.displayName,
  };
}

export function toErrorEvent(
  state: StoredRoomState | null,
  error: RoomErrorPayload,
  commandId?: string,
): ServerEvent {
  return {
    source: AXIAL_ROOM_SOURCE,
    version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    revision: state?.revision ?? 0,
    type: "room:error",
    ...(commandId ? { commandId } : {}),
    payload: { error },
  };
}

export function toMoveRejectedEvent(
  state: StoredRoomState,
  error: RoomErrorPayload,
  commandId?: string,
): ServerEvent {
  return {
    source: AXIAL_ROOM_SOURCE,
    version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    revision: state.revision,
    type: "game:move-rejected",
    ...(commandId ? { commandId } : {}),
    payload: { error },
  };
}

export function requirePlayer(
  state: StoredRoomState,
  playerId: string,
): StoredPlayer {
  const player = state.players.find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!player)
    throw new RoomServiceError(
      "auth-failed",
      "Player credentials do not match this room.",
      403,
    );
  return player;
}

function withPublicEvent(
  state: StoredRoomState,
  type: ServerEventType,
  commandId?: string,
  extraPayload?: Record<string, unknown>,
): RoomCommandOutcome {
  return {
    state,
    events: createPublicEvents(state, type, commandId, extraPayload),
  };
}

function createPublicEvents(
  state: StoredRoomState,
  type: ServerEventType,
  commandId?: string,
  extraPayload: Record<string, unknown> = {},
): RoomMutationEvent[] {
  const payload =
    type === "room:error" || type === "game:move-rejected"
      ? extraPayload
      : { snapshot: toPublicSnapshot(state), ...extraPayload };

  return [
    {
      event: {
        source: AXIAL_ROOM_SOURCE,
        version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
        id: crypto.randomUUID(),
        revision: state.revision,
        type,
        ...(commandId ? { commandId } : {}),
        payload,
      } as ServerEvent,
    },
  ];
}

function assertExpectedRevision(
  state: StoredRoomState,
  expectedRevision: number | undefined,
): void {
  if (expectedRevision === undefined) return;
  if (
    !Number.isInteger(expectedRevision) ||
    expectedRevision !== state.revision
  ) {
    throw new RoomServiceError(
      "stale-revision",
      "Room state changed; resync before retrying.",
      409,
      {
        currentRevision: state.revision,
      },
    );
  }
}

function assertUsableRoom(state: StoredRoomState): void {
  if (state.phase === "expired") {
    throw new RoomServiceError("room-expired", "This room has expired.", 410);
  }
}

function touch(state: StoredRoomState, now: number): void {
  state.revision += 1;
  touchWithoutRevision(state, now);
}

function touchWithoutRevision(state: StoredRoomState, now: number): void {
  state.updatedAt = now;
  refreshExpiry(state, now);
}

function refreshExpiry(state: StoredRoomState, now: number): StoredRoomState {
  const connectedCount = state.players.filter(
    (player) => player.connected,
  ).length;

  if (state.phase === "expired") {
    state.expiresAt = now;
    return state;
  }

  if (state.phase === "waiting") {
    state.expiresAt =
      now + (connectedCount > 0 ? WAITING_ACTIVE_TTL_MS : WAITING_EMPTY_TTL_MS);
    return state;
  }

  if (state.phase === "playing") {
    state.expiresAt =
      now + (connectedCount > 0 ? PLAYING_ACTIVE_TTL_MS : PLAYING_EMPTY_TTL_MS);
    return state;
  }

  state.expiresAt = now + ENDED_TTL_MS;
  return state;
}

function toSerializableGame(game: GameSnapshot): SerializableGameSnapshot {
  return {
    board: Array.from(game.board),
    dimensions: { ...game.dimensions },
    currentPlayer: game.currentPlayer,
    winCondition: { ...game.winCondition },
    completedLines: game.completedLines.map((line) => ({
      ...line,
      cells: [...line.cells],
      direction: [...line.direction] as [number, number, number],
    })),
    lastMove: game.lastMove ? clonePlacedMove(game.lastMove) : null,
    moveHistory: game.moveHistory.map(clonePlacedMove),
    status: cloneStatus(game.status),
  };
}

function toPublicPlayer(player: StoredPlayer): RoomPlayer {
  return {
    playerId: player.playerId,
    seat: player.seat,
    displayName: player.displayName,
    isHost: player.isHost,
    ready: player.ready,
    connected: player.connected,
    joinedAt: player.joinedAt,
    lastSeenAt: player.lastSeenAt,
    disconnectedAt: player.disconnectedAt,
    rematchReady: player.rematchReady,
  };
}

function toPlayerIdentity(player: StoredPlayer): PlayerIdentity {
  return {
    playerId: player.playerId,
    seat: player.seat,
    isHost: player.isHost,
    displayName: player.displayName,
  };
}

function toReplayMove(move: PlacedMove): ReplayMove {
  return {
    row: move.row,
    col: move.col,
    kind: move.kind,
    ...(move.special ? { special: { ...move.special } } : {}),
  };
}

function cloneState(state: StoredRoomState): StoredRoomState {
  return {
    ...state,
    rules: cloneRules(state.rules),
    players: state.players.map((player) => ({ ...player })),
    moveHistory: state.moveHistory.map((move) => ({
      ...move,
      ...(move.special ? { special: { ...move.special } } : {}),
    })),
  };
}

function cloneRules(rules: MultiplayerRules): MultiplayerRules {
  return {
    mode: "classic",
    board: { ...rules.board },
    winCondition: { ...rules.winCondition },
  };
}

function clonePlacedMove(move: PlacedMove): PlacedMove {
  return {
    ...move,
    ...(move.special ? { special: { ...move.special } } : {}),
  };
}

function cloneStatus(status: GameSnapshot["status"]): GameSnapshot["status"] {
  if (status.state === "playing")
    return { state: "playing", currentPlayer: status.currentPlayer };
  if (status.state === "draw") return { state: "draw" };
  return {
    state: "won",
    winner: status.winner,
    line: [...status.line],
    lines: status.lines.map((line) => [...line]),
    lineCount: status.lineCount,
  };
}
