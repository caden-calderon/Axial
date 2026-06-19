import {
  DEFAULT_BOARD_DIMENSIONS,
  DEFAULT_WIN_CONDITION,
  normalizeBoardDimensions,
  normalizeWinCondition,
  type BoardDimensions,
  type Move,
  type WinCondition,
} from "@axial/core";
import type {
  ClientCommand,
  CreateRoomRequest,
  JoinRoomRequest,
  MultiplayerRules,
  RoomCommandRequest,
  RoomSyncRequest,
} from "@axial/multiplayer-protocol";
import {
  AXIAL_CLIENT_SOURCE,
  AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
} from "@axial/multiplayer-protocol";
import { RoomServiceError } from "./errors";

const MAX_JSON_BYTES = 4096;
const MAX_DISPLAY_NAME_LENGTH = 24;

export async function readJsonRequest(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_JSON_BYTES) {
    throw new RoomServiceError(
      "invalid-message",
      "Request body is too large.",
      413,
    );
  }

  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) {
    throw new RoomServiceError(
      "invalid-message",
      "Request body is too large.",
      413,
    );
  }
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RoomServiceError(
      "invalid-message",
      "Request body must be valid JSON.",
      400,
    );
  }
}

export function parseCreateRoomRequest(value: unknown): CreateRoomRequest {
  if (!isRecord(value))
    throw new RoomServiceError(
      "invalid-message",
      "Create payload must be an object.",
    );
  return {
    ...(typeof value.displayName === "string"
      ? { displayName: value.displayName }
      : {}),
    ...(isRecord(value.rules) ? { rules: parseRules(value.rules) } : {}),
  };
}

export function parseJoinRoomRequest(value: unknown): JoinRoomRequest {
  if (!isRecord(value))
    throw new RoomServiceError(
      "invalid-message",
      "Join payload must be an object.",
    );
  return {
    ...(typeof value.displayName === "string"
      ? { displayName: value.displayName }
      : {}),
  };
}

export function parseRoomSyncRequest(value: unknown): RoomSyncRequest {
  if (!isRecord(value)) {
    throw new RoomServiceError(
      "invalid-message",
      "Sync payload must be an object.",
      400,
    );
  }

  return {
    playerId: parseCredentialText(value.playerId, "playerId"),
    reconnectToken: parseCredentialText(value.reconnectToken, "reconnectToken"),
    ...(typeof value.lastSeenRevision === "number"
      ? { lastSeenRevision: value.lastSeenRevision }
      : {}),
  };
}

export function parseRoomCommandRequest(value: unknown): RoomCommandRequest {
  if (!isRecord(value)) {
    throw new RoomServiceError(
      "invalid-message",
      "Command payload must be an object.",
      400,
    );
  }

  return {
    playerId: parseCredentialText(value.playerId, "playerId"),
    reconnectToken: parseCredentialText(value.reconnectToken, "reconnectToken"),
    command: parseClientCommand(value.command),
  };
}

export function normalizeDisplayName(
  value: string | undefined,
  fallback: string,
): string {
  const candidate = (value ?? fallback).trim().replace(/\s+/g, " ");

  if (candidate.length < 1) {
    throw new RoomServiceError("invalid-name", "Choose a display name.", 400);
  }

  if (candidate.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new RoomServiceError(
      "invalid-name",
      `Display names must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
      400,
    );
  }

  if (/[\p{Cc}<>]/u.test(candidate)) {
    throw new RoomServiceError(
      "invalid-name",
      "Display names cannot include control or markup characters.",
      400,
    );
  }

  return candidate;
}

export function parseRules(value: unknown): MultiplayerRules {
  if (!isRecord(value)) return defaultRules();
  if (value.mode !== undefined && value.mode !== "classic") {
    throw new RoomServiceError(
      "invalid-rules",
      "Online multiplayer v1 supports Classic rooms only.",
      400,
    );
  }

  let board: BoardDimensions;
  let winCondition: WinCondition;

  try {
    board = normalizeBoardDimensions(
      isRecord(value.board)
        ? coerceBoardDimensions(value.board)
        : DEFAULT_BOARD_DIMENSIONS,
    );
    winCondition = normalizeWinCondition(
      isRecord(value.winCondition)
        ? coerceWinCondition(value.winCondition)
        : DEFAULT_WIN_CONDITION,
    );
  } catch (error) {
    throw new RoomServiceError(
      "invalid-rules",
      error instanceof Error ? error.message : "Unsupported room rules.",
      400,
    );
  }

  return { mode: "classic", board, winCondition };
}

export function defaultRules(): MultiplayerRules {
  return {
    mode: "classic",
    board: { ...DEFAULT_BOARD_DIMENSIONS },
    winCondition: { ...DEFAULT_WIN_CONDITION },
  };
}

export function parseClientCommand(value: unknown): ClientCommand {
  if (!isRecord(value)) {
    throw new RoomServiceError(
      "invalid-message",
      "Client messages must be objects.",
      400,
    );
  }
  if (value.source !== AXIAL_CLIENT_SOURCE) {
    throw new RoomServiceError(
      "invalid-message",
      "Unsupported message source.",
      400,
    );
  }
  if (value.version !== AXIAL_MULTIPLAYER_PROTOCOL_VERSION) {
    throw new RoomServiceError(
      "unsupported-version",
      "Unsupported multiplayer protocol version.",
      400,
    );
  }
  if (
    typeof value.id !== "string" ||
    value.id.length < 1 ||
    value.id.length > 80
  ) {
    throw new RoomServiceError(
      "invalid-message",
      "Client messages need a bounded id.",
      400,
    );
  }
  if (typeof value.type !== "string") {
    throw new RoomServiceError(
      "invalid-message",
      "Client messages need a type.",
      400,
    );
  }

  const payload = isRecord(value.payload) ? value.payload : {};

  switch (value.type) {
    case "room:set-name":
      if (typeof payload.displayName !== "string") {
        throw new RoomServiceError(
          "invalid-name",
          "Display name must be text.",
          400,
        );
      }
      return {
        ...base(value),
        type: value.type,
        payload: { displayName: payload.displayName },
      };
    case "room:set-rules":
      return {
        ...base(value),
        type: value.type,
        payload: {
          rules: parseRules(payload.rules),
          ...(typeof payload.expectedRevision === "number"
            ? { expectedRevision: payload.expectedRevision }
            : {}),
        },
      };
    case "room:ready":
      if (typeof payload.ready !== "boolean") {
        throw new RoomServiceError(
          "invalid-message",
          "Ready payload must include a boolean.",
          400,
        );
      }
      return {
        ...base(value),
        type: value.type,
        payload: { ready: payload.ready },
      };
    case "room:start":
      return {
        ...base(value),
        type: value.type,
        payload: {
          ...(typeof payload.expectedRevision === "number"
            ? { expectedRevision: payload.expectedRevision }
            : {}),
        },
      };
    case "game:play-move":
      return {
        ...base(value),
        type: value.type,
        payload: {
          move: parseMove(payload.move),
          ...(typeof payload.expectedRevision === "number"
            ? { expectedRevision: payload.expectedRevision }
            : {}),
        },
      };
    case "room:resync":
      return {
        ...base(value),
        type: value.type,
        payload: {
          ...(typeof payload.lastSeenRevision === "number"
            ? { lastSeenRevision: payload.lastSeenRevision }
            : {}),
        },
      };
    case "room:leave":
      return { ...base(value), type: value.type, payload: {} };
    case "room:rematch-vote":
      if (typeof payload.ready !== "boolean") {
        throw new RoomServiceError(
          "invalid-message",
          "Rematch payload must include a boolean.",
          400,
        );
      }
      return {
        ...base(value),
        type: value.type,
        payload: { ready: payload.ready },
      };
    default:
      throw new RoomServiceError(
        "invalid-message",
        `Unsupported command: ${value.type}`,
        400,
      );
  }
}

function parseMove(value: unknown): Move {
  if (!isRecord(value))
    throw new RoomServiceError(
      "invalid-message",
      "Move payload must be an object.",
      400,
    );
  const row = typeof value.row === "number" ? value.row : Number.NaN;
  const col = typeof value.col === "number" ? value.col : Number.NaN;
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    throw new RoomServiceError(
      "illegal-move",
      "Move coordinates must be integers.",
      400,
    );
  }
  return { row, col };
}

function coerceBoardDimensions(
  value: Record<string, unknown>,
): BoardDimensions {
  return {
    height: Number(value.height),
    rows: Number(value.rows),
    columns: Number(value.columns),
  };
}

function coerceWinCondition(value: Record<string, unknown>): WinCondition {
  return {
    lineLength: Number(value.lineLength),
    linesToWin: Number(value.linesToWin),
  };
}

function base(value: Record<string, unknown>) {
  return {
    source: AXIAL_CLIENT_SOURCE,
    version: AXIAL_MULTIPLAYER_PROTOCOL_VERSION,
    id: value.id as string,
  };
}

function parseCredentialText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) {
    throw new RoomServiceError(
      "auth-failed",
      `Room ${label} credential is missing or invalid.`,
      403,
    );
  }
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
