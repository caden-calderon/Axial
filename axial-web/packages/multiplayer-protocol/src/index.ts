import type {
  BoardDimensions,
  CompletedLine,
  GameStatus,
  Move,
  PlacedMove,
  Player,
  WinCondition,
} from "@axial/core";

export const AXIAL_MULTIPLAYER_PROTOCOL_VERSION = 1 as const;
export const AXIAL_CLIENT_SOURCE = "axial-client" as const;
export const AXIAL_ROOM_SOURCE = "axial-room" as const;

export type MultiplayerProtocolVersion =
  typeof AXIAL_MULTIPLAYER_PROTOCOL_VERSION;
export type RoomPhase = "waiting" | "playing" | "ended" | "expired";
export type ConnectionState =
  | "idle"
  | "creating"
  | "joining"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "resyncing"
  | "opponent-disconnected"
  | "expired"
  | "fatal-error";

export type MultiplayerRules = {
  mode: "classic";
  board: BoardDimensions;
  winCondition: WinCondition;
};

export type SerializableGameSnapshot = {
  board: number[];
  dimensions: BoardDimensions;
  currentPlayer: Player;
  winCondition: WinCondition;
  completedLines: CompletedLine[];
  lastMove: PlacedMove | null;
  moveHistory: PlacedMove[];
  status: GameStatus;
};

export type RoomPlayer = {
  playerId: string;
  seat: Player;
  displayName: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  disconnectedAt: number | null;
  rematchReady: boolean;
};

export type PlayerIdentity = {
  playerId: string;
  seat: Player;
  isHost: boolean;
  displayName: string;
};

export type RoomSnapshot = {
  roomCode: string;
  phase: RoomPhase;
  revision: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  hostPlayerId: string;
  rules: MultiplayerRules;
  players: RoomPlayer[];
  game: SerializableGameSnapshot;
  match: {
    number: number;
    startingPlayer: Player;
    startedAt: number | null;
    playableAt: number | null;
  };
  rematch: {
    readyPlayerIds: string[];
    deadlineAt: number | null;
  };
};

export type PrivateRoomSnapshot = RoomSnapshot & {
  you: PlayerIdentity;
  inviteUrl: string;
  qrPayload: string;
};

export type PlayerCredentials = {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  seat: Player;
  isHost: boolean;
  displayName: string;
};

export type CreateRoomRequest = {
  displayName?: string;
  rules?: MultiplayerRules;
};

export type CreateRoomResponse = {
  roomCode: string;
  inviteUrl: string;
  qrPayload: string;
  player: PlayerCredentials;
  snapshot: PrivateRoomSnapshot;
};

export type JoinRoomRequest = {
  displayName?: string;
};

export type JoinRoomResponse = {
  roomCode: string;
  inviteUrl: string;
  qrPayload: string;
  player: PlayerCredentials;
  snapshot: PrivateRoomSnapshot;
};

export type RoomAuthPayload = {
  playerId: string;
  reconnectToken: string;
};

export type RoomSyncRequest = RoomAuthPayload & {
  lastSeenRevision?: number;
};

export type RoomSyncResponse = {
  snapshot: PrivateRoomSnapshot;
};

export type RoomCommandRequest = RoomAuthPayload & {
  command: ClientCommand;
};

export type RoomCommandResponse = {
  events: ServerEvent[];
  snapshot: PrivateRoomSnapshot;
};

export type RoomErrorCode =
  | "invalid-message"
  | "unsupported-version"
  | "duplicate-connection"
  | "room-not-found"
  | "room-conflict"
  | "room-full"
  | "invalid-name"
  | "invalid-rules"
  | "not-host"
  | "not-your-turn"
  | "illegal-move"
  | "stale-revision"
  | "rematch-expired"
  | "auth-failed"
  | "room-expired"
  | "rate-limited"
  | "internal-error";

export type RoomErrorPayload = {
  code: RoomErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

type ClientCommandBase<Type extends string, Payload = undefined> = {
  source: typeof AXIAL_CLIENT_SOURCE;
  version: MultiplayerProtocolVersion;
  id: string;
  type: Type;
  payload: Payload;
};

export type SetNameCommand = ClientCommandBase<
  "room:set-name",
  { displayName: string }
>;
export type SetRulesCommand = ClientCommandBase<
  "room:set-rules",
  { rules: MultiplayerRules; expectedRevision?: number }
>;
export type ReadyCommand = ClientCommandBase<"room:ready", { ready: boolean }>;
export type StartCommand = ClientCommandBase<
  "room:start",
  { expectedRevision?: number }
>;
export type PlayMoveCommand = ClientCommandBase<
  "game:play-move",
  { move: Move; expectedRevision?: number }
>;
export type ResyncCommand = ClientCommandBase<
  "room:resync",
  { lastSeenRevision?: number }
>;
export type LeaveCommand = ClientCommandBase<
  "room:leave",
  Record<string, never>
>;
export type RematchVoteCommand = ClientCommandBase<
  "room:rematch-vote",
  { ready: boolean }
>;

export type ClientCommand =
  | SetNameCommand
  | SetRulesCommand
  | ReadyCommand
  | StartCommand
  | PlayMoveCommand
  | ResyncCommand
  | LeaveCommand
  | RematchVoteCommand;

export type ClientCommandType = ClientCommand["type"];

type ServerEventBase<Type extends string, Payload = undefined> = {
  source: typeof AXIAL_ROOM_SOURCE;
  version: MultiplayerProtocolVersion;
  id: string;
  revision: number;
  type: Type;
  commandId?: string;
  payload: Payload;
};

export type SnapshotEvent = ServerEventBase<
  "room:snapshot",
  { snapshot: PrivateRoomSnapshot }
>;
export type RoomCreatedEvent = ServerEventBase<
  "room:created",
  { snapshot: RoomSnapshot }
>;
export type PlayerJoinedEvent = ServerEventBase<
  "room:player-joined",
  { snapshot: RoomSnapshot }
>;
export type PlayerUpdatedEvent = ServerEventBase<
  "room:player-updated",
  { snapshot: RoomSnapshot }
>;
export type PlayerDisconnectedEvent = ServerEventBase<
  "room:player-disconnected",
  { snapshot: RoomSnapshot; playerId: string }
>;
export type PlayerReconnectedEvent = ServerEventBase<
  "room:player-reconnected",
  { snapshot: RoomSnapshot; playerId: string }
>;
export type RulesUpdatedEvent = ServerEventBase<
  "room:rules-updated",
  { snapshot: RoomSnapshot }
>;
export type ReadyUpdatedEvent = ServerEventBase<
  "room:ready-updated",
  { snapshot: RoomSnapshot }
>;
export type GameStartedEvent = ServerEventBase<
  "game:started",
  { snapshot: RoomSnapshot }
>;
export type MoveAcceptedEvent = ServerEventBase<
  "game:move-accepted",
  { snapshot: RoomSnapshot; move: PlacedMove }
>;
export type MoveRejectedEvent = ServerEventBase<
  "game:move-rejected",
  { error: RoomErrorPayload }
>;
export type GameEndedEvent = ServerEventBase<
  "game:ended",
  { snapshot: RoomSnapshot }
>;
export type RematchUpdatedEvent = ServerEventBase<
  "room:rematch-updated",
  { snapshot: RoomSnapshot }
>;
export type RoomExpiredEvent = ServerEventBase<
  "room:expired",
  { snapshot: RoomSnapshot }
>;
export type RoomErrorEvent = ServerEventBase<
  "room:error",
  { error: RoomErrorPayload }
>;

export type ServerEvent =
  | SnapshotEvent
  | RoomCreatedEvent
  | PlayerJoinedEvent
  | PlayerUpdatedEvent
  | PlayerDisconnectedEvent
  | PlayerReconnectedEvent
  | RulesUpdatedEvent
  | ReadyUpdatedEvent
  | GameStartedEvent
  | MoveAcceptedEvent
  | MoveRejectedEvent
  | GameEndedEvent
  | RematchUpdatedEvent
  | RoomExpiredEvent
  | RoomErrorEvent;

export type ServerEventType = ServerEvent["type"];

export function createClientCommand<T extends ClientCommand>(
  type: T["type"],
  payload: T["payload"],
): T {
  return {
    source: AXIAL_CLIENT_SOURCE,
    version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    type,
    payload,
  } as T;
}
