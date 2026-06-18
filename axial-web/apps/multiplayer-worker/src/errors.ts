import type {
  RoomErrorCode,
  RoomErrorPayload,
} from "@axial/multiplayer-protocol";

export class RoomServiceError extends Error {
  readonly code: RoomErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: RoomErrorCode,
    message: string,
    status = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RoomServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toPayload(): RoomErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export type RoomResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: RoomErrorPayload };

export function ok<T>(value: T): RoomResult<T> {
  return { ok: true, value };
}

export function fail(error: unknown): {
  ok: false;
  status: number;
  error: RoomErrorPayload;
} {
  if (error instanceof RoomServiceError) {
    return { ok: false, status: error.status, error: error.toPayload() };
  }

  const payload: RoomErrorPayload = {
    code: "internal-error",
    message: "The room service hit an unexpected error.",
  };
  return { ok: false, status: 500, error: payload };
}
