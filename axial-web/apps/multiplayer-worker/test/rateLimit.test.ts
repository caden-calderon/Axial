import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

describe("room creation rate limit", () => {
  it("rejects before reading the body, with a retry response and CORS", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const request = new Request("https://worker.test/api/rooms", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "192.0.2.1",
        Origin: "https://playaxial.dev",
      },
      body: "{",
    });
    const response = await worker.fetch(request, {
      ...env,
      ROOM_CREATION_LIMITER: { limit },
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "rate-limited", details: { retryAfterSeconds: 60 } },
    });
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://playaxial.dev",
    );
    expect(request.bodyUsed).toBe(false);
    expect(limit).toHaveBeenCalledExactlyOnceWith({
      key: "axial:room-create:192.0.2.1",
    });
  });

  it("uses a shared limited bucket when the edge address is missing", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const response = await worker.fetch(
      new Request("https://worker.test/api/rooms", {
        method: "POST",
        body: "{}",
      }),
      { ...env, ROOM_CREATION_LIMITER: { limit } },
    );
    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledExactlyOnceWith({
      key: "axial:room-create:unknown",
    });
  });

  it("creates a room normally when the limiter allows it", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const response = await worker.fetch(
      new Request("https://worker.test/api/rooms", {
        method: "POST",
        body: "{}",
      }),
      { ...env, ROOM_CREATION_LIMITER: { limit } },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ player: { isHost: true } });
    expect(limit).toHaveBeenCalledOnce();
  });

  it("keeps health, preflight and existing-room requests outside the creation limit", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const testEnv = { ...env, ROOM_CREATION_LIMITER: { limit } };
    const health = await worker.fetch(
      new Request("https://worker.test/health"),
      testEnv,
    );
    const preflight = await worker.fetch(
      new Request("https://worker.test/api/rooms", { method: "OPTIONS" }),
      testEnv,
    );
    const join = await worker.fetch(
      new Request("https://worker.test/api/rooms/ABCDEFGH/join", {
        method: "POST",
        body: "{}",
      }),
      testEnv,
    );
    expect(health.status).toBe(200);
    expect(preflight.status).toBe(204);
    expect(join.status).toBe(404);
    expect(limit).not.toHaveBeenCalled();
  });

  it("does not create a room if the limiter fails", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("Limiter unavailable"));
    const request = new Request("https://worker.test/api/rooms", {
      method: "POST",
      body: "{}",
    });
    const response = await worker.fetch(request, {
      ...env,
      ROOM_CREATION_LIMITER: { limit },
    });
    expect(response.status).toBe(500);
    expect(request.bodyUsed).toBe(false);
    expect(await response.json()).toMatchObject({
      error: { code: "internal-error" },
    });
  });

  it("configures ten tokens per client bucket without sharing them across addresses", async () => {
    const key = `test:${crypto.randomUUID()}`;
    for (let index = 0; index < 10; index++) {
      expect(await env.ROOM_CREATION_LIMITER.limit({ key })).toEqual({
        success: true,
      });
    }
    expect(await env.ROOM_CREATION_LIMITER.limit({ key })).toEqual({
      success: false,
    });
    expect(
      await env.ROOM_CREATION_LIMITER.limit({ key: `${key}:other` }),
    ).toEqual({ success: true });
  });
});
