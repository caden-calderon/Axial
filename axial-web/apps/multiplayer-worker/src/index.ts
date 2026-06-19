import { RoomObject, type RoomObjectRpc } from "./roomObject";
import {
  formatRoomCode,
  generateReconnectToken,
  generateRoomCode,
  normalizeRoomCode,
} from "./roomCodes";
import { RoomServiceError, fail } from "./errors";
import {
  parseCreateRoomRequest,
  parseJoinRoomRequest,
  parseRoomCommandRequest,
  parseRoomSyncRequest,
  readJsonRequest,
} from "./validation";

export { RoomObject };

const CREATE_ROOM_ATTEMPTS = 5;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") return optionsResponse(request, env);
      enforceOrigin(request, env);

      let response: Response;
      if (url.pathname === "/health" && request.method === "GET") {
        response = Response.json({ ok: true, service: "axial-multiplayer" });
      } else if (url.pathname === "/api/rooms" && request.method === "POST") {
        response = await handleCreateRoom(request, env);
      } else {
        const route = parseRoomRoute(url.pathname);
        if (route?.action === "join" && request.method === "POST") {
          response = await handleJoinRoom(request, env, route.roomCode);
        } else if (route?.action === "socket" && request.method === "GET") {
          response = await handleRoomSocket(request, env, route.roomCode);
        } else if (route?.action === "sync" && request.method === "POST") {
          response = await handleRoomSync(request, env, route.roomCode);
        } else if (route?.action === "commands" && request.method === "POST") {
          response = await handleRoomCommand(request, env, route.roomCode);
        } else {
          response = errorResponse(
            { code: "invalid-message", message: "Route not found." },
            404,
          );
        }
      }

      log("info", "request completed", {
        requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      if (response.status === 101) return response;
      return withCors(request, env, response);
    } catch (error) {
      const result = fail(error);
      log("error", "request failed", {
        requestId,
        method: request.method,
        path: url.pathname,
        status: result.status,
        error: result.error.code,
        durationMs: Date.now() - startedAt,
      });
      return withCors(request, env, errorResponse(result.error, result.status));
    }
  },
} satisfies ExportedHandler<Env>;

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const payload = parseCreateRoomRequest(await readJsonRequest(request));
  const inviteOrigin = publicWebOrigin(request, env);

  for (let attempt = 0; attempt < CREATE_ROOM_ATTEMPTS; attempt += 1) {
    const roomCode = generateRoomCode();
    const reconnectToken = generateReconnectToken();
    const stub = roomStub(env, roomCode);
    const inviteUrl = roomInviteUrl(inviteOrigin, roomCode);
    const result = await stub.createRoom({
      roomCode,
      displayName: payload.displayName,
      reconnectToken,
      inviteUrl,
      rules: payload.rules,
    });

    if (result.ok) return Response.json(result.value, { status: 201 });
    if (result.error.code !== "room-conflict")
      return errorResponse(result.error, result.status);
  }

  throw new RoomServiceError(
    "room-conflict",
    "Could not reserve a unique room code. Try again.",
    503,
  );
}

async function handleRoomSync(
  request: Request,
  env: Env,
  roomCode: string,
): Promise<Response> {
  const payload = parseRoomSyncRequest(await readJsonRequest(request));
  const result = await roomStub(env, roomCode).syncPlayer(
    {
      playerId: payload.playerId,
      reconnectToken: payload.reconnectToken,
    },
    roomInviteUrl(publicWebOrigin(request, env), roomCode),
  );

  return result.ok
    ? Response.json(result.value)
    : errorResponse(result.error, result.status);
}

async function handleRoomCommand(
  request: Request,
  env: Env,
  roomCode: string,
): Promise<Response> {
  const payload = parseRoomCommandRequest(await readJsonRequest(request));
  const result = await roomStub(env, roomCode).submitHttpCommand(
    {
      playerId: payload.playerId,
      reconnectToken: payload.reconnectToken,
    },
    payload.command,
    roomInviteUrl(publicWebOrigin(request, env), roomCode),
  );

  return result.ok
    ? Response.json(result.value)
    : errorResponse(result.error, result.status);
}

async function handleJoinRoom(
  request: Request,
  env: Env,
  roomCode: string,
): Promise<Response> {
  const payload = parseJoinRoomRequest(await readJsonRequest(request));
  const reconnectToken = generateReconnectToken();
  const stub = roomStub(env, roomCode);
  const result = await stub.joinRoom({
    displayName: payload.displayName,
    reconnectToken,
    inviteUrl: roomInviteUrl(publicWebOrigin(request, env), roomCode),
  });

  return result.ok
    ? Response.json(result.value)
    : errorResponse(result.error, result.status);
}

async function handleRoomSocket(
  request: Request,
  env: Env,
  roomCode: string,
): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    throw new RoomServiceError(
      "invalid-message",
      "Room socket expects a WebSocket upgrade.",
      426,
    );
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(request.url);
  targetUrl.searchParams.set(
    "inviteUrl",
    roomInviteUrl(publicWebOrigin(request, env), roomCode),
  );

  const playerId = sourceUrl.searchParams.get("playerId");
  const reconnectToken = sourceUrl.searchParams.get("reconnectToken");
  if (!playerId || !reconnectToken) {
    throw new RoomServiceError(
      "auth-failed",
      "Room socket requires player credentials.",
      403,
    );
  }

  const stub = roomStub(env, roomCode);
  return stub.fetch(new Request(targetUrl.toString(), request));
}

function roomStub(env: Env, roomCode: string): RoomObjectRpc {
  return env.AXIAL_ROOM.getByName(roomCode) as unknown as RoomObjectRpc;
}

function parseRoomRoute(pathname: string): {
  roomCode: string;
  action: "join" | "socket" | "sync" | "commands";
} | null {
  const match = /^\/api\/rooms\/([^/]+)\/(join|socket|sync|commands)$/.exec(
    pathname,
  );
  if (!match) return null;

  const roomCode = normalizeRoomCode(decodeURIComponent(match[1]));
  if (!roomCode) {
    throw new RoomServiceError(
      "room-not-found",
      "Room code is not valid.",
      404,
      {
        roomCode: formatRoomCode(match[1]),
      },
    );
  }

  return {
    roomCode,
    action: match[2] as "join" | "socket" | "sync" | "commands",
  };
}

function publicWebOrigin(request: Request, env: Env): string {
  if (env.PUBLIC_WEB_ORIGIN) return env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function roomInviteUrl(origin: string, roomCode: string): string {
  return `${origin.replace(/\/$/, "")}/?room=${roomCode}`;
}

function enforceOrigin(request: Request, env: Env): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  if (allowedOrigins(env).size === 0) return;
  if (allowedOrigins(env).has(origin)) return;

  throw new RoomServiceError(
    "auth-failed",
    "Origin is not allowed for multiplayer requests.",
    403,
  );
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}

function optionsResponse(request: Request, env: Env): Response {
  return withCors(request, env, new Response(null, { status: 204 }));
}

function withCors(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get("Origin");
  const headers = new Headers(response.headers);
  const allowed = allowedOrigins(env);
  if (origin && (allowed.size === 0 || allowed.has(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appendVary(current: string | null, value: string): string {
  if (!current) return value;
  const parts = new Set(
    current
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  parts.add(value);
  return Array.from(parts).join(", ");
}

function errorResponse(
  error: { code: string; message: string; details?: Record<string, unknown> },
  status: number,
): Response {
  return Response.json({ error }, { status });
}

function log(
  level: "info" | "error",
  message: string,
  data: Record<string, unknown>,
): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
