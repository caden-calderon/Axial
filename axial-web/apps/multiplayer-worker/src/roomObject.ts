import { DurableObject } from "cloudflare:workers";
import type {
  ClientCommand,
  CreateRoomResponse,
  JoinRoomResponse,
  PlayerCredentials,
  PrivateRoomSnapshot,
  ServerEvent,
} from "@axial/multiplayer-protocol";
import {
  AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
  AXIAL_ROOM_SOURCE,
} from "@axial/multiplayer-protocol";
import { fail, ok, RoomServiceError, type RoomResult } from "./errors";
import {
  addSecondPlayer,
  createInitialRoomState,
  expireRoom,
  markConnected,
  markDisconnected,
  playClassicMove,
  requirePlayer,
  ROOM_EVENT_HISTORY_LIMIT,
  setPlayerName,
  setReadyState,
  setRematchVote,
  setRoomRules,
  shouldExpire,
  toCredentials,
  toErrorEvent,
  toMoveRejectedEvent,
  toPrivateSnapshot,
  toPublicSnapshot,
  type RoomCommandOutcome,
  type RoomMutationEvent,
  type StoredRoomState,
} from "./roomState";
import { hashSecret, verifySecret } from "./secrets";
import { normalizeDisplayName, parseClientCommand } from "./validation";

type ConnectionAttachment = {
  connectionId: string;
  playerId: string;
  roomCode: string;
  connectedAt: number;
  inviteUrl: string;
};

type CommandCredentials = Pick<
  PlayerCredentials,
  "playerId" | "reconnectToken"
>;

const STATE_ROW_ID = "current";
const CLOSE_DUPLICATE = 4001;
const CLOSE_EXPIRED = 4002;
const CLOSE_AUTH = 4003;

export type RoomObjectRpc = {
  createRoom(input: {
    roomCode: string;
    displayName?: string;
    reconnectToken: string;
    inviteUrl: string;
    rules?: StoredRoomState["rules"];
  }): Promise<RoomResult<CreateRoomResponse>>;
  joinRoom(input: {
    displayName?: string;
    reconnectToken: string;
    inviteUrl: string;
  }): Promise<RoomResult<JoinRoomResponse>>;
  submitCommand(
    credentials: CommandCredentials,
    command: ClientCommand,
    inviteUrl: string,
  ): Promise<
    RoomResult<{ events: ServerEvent[]; snapshot: PrivateRoomSnapshot }>
  >;
  fetch(request: Request): Promise<Response>;
};

export class RoomObject extends DurableObject<Env> {
  private sessions = new Map<WebSocket, ConnectionAttachment>();
  private cachedState: StoredRoomState | null | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
      this.restoreSessions();
      this.ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair("ping", "pong"),
      );
    });
  }

  async createRoom(input: {
    roomCode: string;
    displayName?: string;
    reconnectToken: string;
    inviteUrl: string;
    rules?: StoredRoomState["rules"];
  }): Promise<RoomResult<CreateRoomResponse>> {
    try {
      const existing = this.loadState();
      if (existing && existing.phase !== "expired") {
        throw new RoomServiceError(
          "room-conflict",
          "A room already exists for this code.",
          409,
        );
      }

      const now = Date.now();
      const hostPlayerId = crypto.randomUUID();
      const displayName = normalizeDisplayName(input.displayName, "Player 1");
      const tokenHash = await hashSecret(input.reconnectToken);
      const state = createInitialRoomState({
        roomCode: input.roomCode,
        hostPlayerId,
        hostDisplayName: displayName,
        hostTokenHash: tokenHash,
        now,
        rules: input.rules,
      });

      this.cachedState = state;
      this.persistState(state);
      this.appendEvents(state, [
        {
          event: this.publicEvent(state, "room:created"),
        },
      ]);
      await this.scheduleExpiry(state);

      const player = toCredentials(state, hostPlayerId, input.reconnectToken);
      const snapshot = toPrivateSnapshot(state, hostPlayerId, input.inviteUrl);
      return ok({
        roomCode: state.roomCode,
        inviteUrl: input.inviteUrl,
        qrPayload: input.inviteUrl,
        player,
        snapshot,
      });
    } catch (error) {
      return fail(error);
    }
  }

  async joinRoom(input: {
    displayName?: string;
    reconnectToken: string;
    inviteUrl: string;
  }): Promise<RoomResult<JoinRoomResponse>> {
    try {
      const state = this.requireState();
      const now = Date.now();
      const playerId = crypto.randomUUID();
      const displayName = normalizeDisplayName(input.displayName, "Player 2");
      const tokenHash = await hashSecret(input.reconnectToken);
      const outcome = addSecondPlayer(state, {
        playerId,
        displayName,
        tokenHash,
        now,
      });

      await this.commit(outcome);
      const updated = outcome.state;
      const player = toCredentials(updated, playerId, input.reconnectToken);
      const snapshot = toPrivateSnapshot(updated, playerId, input.inviteUrl);
      return ok({
        roomCode: updated.roomCode,
        inviteUrl: input.inviteUrl,
        qrPayload: input.inviteUrl,
        player,
        snapshot,
      });
    } catch (error) {
      return fail(error);
    }
  }

  async submitCommand(
    credentials: CommandCredentials,
    command: ClientCommand,
    inviteUrl: string,
  ): Promise<
    RoomResult<{ events: ServerEvent[]; snapshot: PrivateRoomSnapshot }>
  > {
    try {
      const state = await this.authenticate(
        credentials.playerId,
        credentials.reconnectToken,
      );
      const outcome = this.executeCommand(state, credentials.playerId, command);
      await this.commit(outcome);
      return ok({
        events: outcome.events.map((entry) => entry.event),
        snapshot: toPrivateSnapshot(
          outcome.state,
          credentials.playerId,
          inviteUrl,
        ),
      });
    } catch (error) {
      return fail(error);
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    try {
      const url = new URL(request.url);
      const playerId = url.searchParams.get("playerId") ?? "";
      const reconnectToken = url.searchParams.get("reconnectToken") ?? "";
      const inviteUrl =
        url.searchParams.get("inviteUrl") ??
        roomInviteUrl(url.origin, this.requireState().roomCode);
      const state = await this.authenticate(playerId, reconnectToken);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const connectionId = crypto.randomUUID();
      const attachment: ConnectionAttachment = {
        connectionId,
        playerId,
        roomCode: state.roomCode,
        connectedAt: Date.now(),
        inviteUrl,
      };

      this.ctx.acceptWebSocket(server, [playerId]);
      server.serializeAttachment(attachment);
      this.sessions.set(server, attachment);
      this.closeDuplicateSockets(server, attachment, state);

      const connectOutcome = markConnected(
        state,
        playerId,
        connectionId,
        Date.now(),
      );
      await this.commit(connectOutcome);
      this.send(
        server,
        this.snapshotEvent(connectOutcome.state, playerId, inviteUrl),
      );
      this.broadcast(connectOutcome.events, server);

      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      const payload =
        error instanceof RoomServiceError
          ? error.toPayload()
          : {
              code: "internal-error" as const,
              message: "Could not open room socket.",
            };
      return Response.json(
        { error: payload },
        { status: error instanceof RoomServiceError ? error.status : 500 },
      );
    }
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const attachment = this.connectionFor(ws);
    if (!attachment) {
      ws.close(CLOSE_AUTH, "Missing session");
      return;
    }

    const state = this.loadState();
    let commandId: string | undefined;
    try {
      if (typeof message !== "string") {
        throw new RoomServiceError(
          "invalid-message",
          "Binary messages are not supported.",
          400,
        );
      }

      const command = parseClientCommand(JSON.parse(message) as unknown);
      commandId = command.id;
      const player = requirePlayer(this.requireState(), attachment.playerId);
      if (player.activeConnectionId !== attachment.connectionId) {
        throw new RoomServiceError(
          "duplicate-connection",
          "A newer tab owns this player seat.",
          409,
        );
      }

      const outcome = this.executeCommand(
        this.requireState(),
        attachment.playerId,
        command,
      );
      await this.commit(outcome);
      if (command.type === "room:resync") {
        this.send(
          ws,
          this.snapshotEvent(
            outcome.state,
            attachment.playerId,
            attachment.inviteUrl,
            command.id,
          ),
        );
        return;
      }
      this.broadcast(outcome.events);
    } catch (error) {
      const payload =
        error instanceof RoomServiceError
          ? error.toPayload()
          : {
              code: "invalid-message" as const,
              message: "Client message could not be processed.",
            };
      const event =
        state && payload.code === "illegal-move"
          ? toMoveRejectedEvent(state, payload, commandId)
          : toErrorEvent(state, payload, commandId);
      this.send(ws, event);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    const attachment = this.connectionFor(ws);
    this.sessions.delete(ws);
    closeSocket(ws, code, reason);
    if (!attachment) return;

    const state = this.loadState();
    if (!state || state.phase === "expired") return;

    const outcome = markDisconnected(
      state,
      attachment.playerId,
      attachment.connectionId,
      Date.now(),
    );
    await this.commit(outcome);
    this.broadcast(outcome.events);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error(
      JSON.stringify({
        level: "error",
        message: "room websocket error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    ws.close(1011, "Socket error");
  }

  async alarm(): Promise<void> {
    const state = this.loadState();
    if (!state) return;
    const now = Date.now();
    if (!shouldExpire(state, now)) {
      await this.scheduleExpiry(state);
      return;
    }

    const outcome = expireRoom(state, now);
    await this.commit(outcome);
    this.broadcast(outcome.events);
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(CLOSE_EXPIRED, "Room expired");
    }
  }

  private executeCommand(
    state: StoredRoomState,
    playerId: string,
    command: ClientCommand,
  ): RoomCommandOutcome {
    const now = Date.now();
    switch (command.type) {
      case "room:set-name":
        return setPlayerName(
          state,
          playerId,
          command.payload.displayName,
          now,
          command.id,
        );
      case "room:set-rules":
        return setRoomRules(
          state,
          playerId,
          command.payload.rules,
          command.payload.expectedRevision,
          now,
          command.id,
        );
      case "room:ready":
        return setReadyState(
          state,
          playerId,
          command.payload.ready,
          now,
          command.id,
        );
      case "game:play-move":
        return playClassicMove(
          state,
          playerId,
          command.payload.move,
          command.payload.expectedRevision,
          now,
          command.id,
        );
      case "room:resync":
        return {
          state,
          events: [],
        };
      case "room:leave":
        return markDisconnected(
          state,
          playerId,
          requirePlayer(state, playerId).activeConnectionId ?? "",
          now,
          command.id,
        );
      case "room:rematch-vote":
        return setRematchVote(
          state,
          playerId,
          command.payload.ready,
          now,
          command.id,
        );
    }
  }

  private async authenticate(
    playerId: string,
    reconnectToken: string,
  ): Promise<StoredRoomState> {
    const state = this.requireState();
    if (state.phase === "expired") {
      throw new RoomServiceError("room-expired", "This room has expired.", 410);
    }
    const player = requirePlayer(state, playerId);
    if (
      !reconnectToken ||
      !(await verifySecret(reconnectToken, player.reconnectTokenHash))
    ) {
      throw new RoomServiceError(
        "auth-failed",
        "Player credentials do not match this room.",
        403,
      );
    }
    return state;
  }

  private async commit(outcome: RoomCommandOutcome): Promise<void> {
    this.cachedState = outcome.state;
    this.persistState(outcome.state);
    this.appendEvents(
      outcome.state,
      outcome.events.filter((entry) => !entry.privateOnly),
    );
    await this.scheduleExpiry(outcome.state);
  }

  private loadState(): StoredRoomState | null {
    if (this.cachedState !== undefined) return this.cachedState;

    const row = this.ctx.storage.sql
      .exec<{
        state_json: string;
      }>("SELECT state_json FROM room_state WHERE id = ?", STATE_ROW_ID)
      .toArray()[0];
    this.cachedState = row
      ? (JSON.parse(row.state_json) as StoredRoomState)
      : null;
    return this.cachedState;
  }

  private requireState(): StoredRoomState {
    const state = this.loadState();
    if (!state)
      throw new RoomServiceError("room-not-found", "Room not found.", 404);
    return state;
  }

  private persistState(state: StoredRoomState): void {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO room_state (id, room_code, state_json, updated_at)
       VALUES (?, ?, ?, ?)`,
      STATE_ROW_ID,
      state.roomCode,
      JSON.stringify(state),
      state.updatedAt,
    );
  }

  private appendEvents(
    state: StoredRoomState,
    events: RoomMutationEvent[],
  ): void {
    for (const entry of events) {
      this.ctx.storage.sql.exec(
        `INSERT INTO room_events (revision, type, event_json, created_at)
         VALUES (?, ?, ?, ?)`,
        entry.event.revision,
        entry.event.type,
        JSON.stringify(entry.event),
        state.updatedAt,
      );
    }

    this.ctx.storage.sql.exec(
      `DELETE FROM room_events
       WHERE sequence NOT IN (
         SELECT sequence FROM room_events ORDER BY sequence DESC LIMIT ?
       )`,
      ROOM_EVENT_HISTORY_LIMIT,
    );
  }

  private async scheduleExpiry(state: StoredRoomState): Promise<void> {
    if (state.phase === "expired") {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(state.expiresAt);
  }

  private restoreSessions(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment =
        ws.deserializeAttachment() as ConnectionAttachment | null;
      if (attachment) this.sessions.set(ws, attachment);
    }
  }

  private closeDuplicateSockets(
    currentSocket: WebSocket,
    attachment: ConnectionAttachment,
    state: StoredRoomState,
  ): void {
    for (const ws of this.ctx.getWebSockets(attachment.playerId)) {
      if (ws === currentSocket) continue;
      const previous =
        ws.deserializeAttachment() as ConnectionAttachment | null;
      if (!previous || previous.connectionId === attachment.connectionId)
        continue;
      this.send(
        ws,
        toErrorEvent(state, {
          code: "duplicate-connection",
          message: "A newer tab took over this player seat.",
        }),
      );
      ws.close(CLOSE_DUPLICATE, "Newer connection opened");
    }
  }

  private connectionFor(ws: WebSocket): ConnectionAttachment | null {
    const cached = this.sessions.get(ws);
    if (cached) return cached;

    const attachment =
      ws.deserializeAttachment() as ConnectionAttachment | null;
    if (attachment) this.sessions.set(ws, attachment);
    return attachment;
  }

  private snapshotEvent(
    state: StoredRoomState,
    playerId: string,
    inviteUrl: string,
    commandId?: string,
  ): ServerEvent {
    return {
      source: AXIAL_ROOM_SOURCE,
      version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
      id: crypto.randomUUID(),
      revision: state.revision,
      type: "room:snapshot",
      ...(commandId ? { commandId } : {}),
      payload: {
        snapshot: toPrivateSnapshot(state, playerId, inviteUrl),
      },
    };
  }

  private publicEvent(
    state: StoredRoomState,
    type: ServerEvent["type"],
  ): ServerEvent {
    return {
      source: AXIAL_ROOM_SOURCE,
      version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
      id: crypto.randomUUID(),
      revision: state.revision,
      type,
      payload: { snapshot: toPublicSnapshot(state) },
    } as ServerEvent;
  }

  private broadcast(
    events: readonly RoomMutationEvent[],
    except?: WebSocket,
  ): void {
    if (events.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
      for (const entry of events) this.send(ws, entry.event);
    }
  }

  private send(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const current = this.ctx.storage.sql
      .exec<{
        version: number;
      }>("SELECT COALESCE(MAX(id), 0) as version FROM _sql_schema_migrations")
      .one().version;

    if (current < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id TEXT PRIMARY KEY,
          room_code TEXT NOT NULL,
          state_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          revision INTEGER NOT NULL,
          type TEXT NOT NULL,
          event_json TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_room_events_revision ON room_events(revision);
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }
}

function roomInviteUrl(origin: string, roomCode: string): string {
  return `${origin.replace(/\/$/, "")}/room/${roomCode}`;
}

function closeSocket(ws: WebSocket, code: number, reason: string): void {
  if (
    code >= 1000 &&
    code < 5000 &&
    code !== 1005 &&
    code !== 1006 &&
    code !== 1015
  ) {
    ws.close(code, reason);
    return;
  }
  ws.close();
}
