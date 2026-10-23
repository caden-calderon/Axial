import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import {
  composeFeedbackEmail,
  parseFeedbackRequest,
  verifyTurnstile,
} from "../src/feedback";
import { RoomServiceError } from "../src/errors";

const validBody = {
  kind: "bug",
  message: "The orb pieces flicker when I rotate the board.",
  name: "Sam",
  contact: "sam@example.com",
  turnstileToken: "token-123",
  website: "",
  context: { mode: "online", viewport: "390x844", build: "2026-10-22" },
};

function feedbackRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://worker.test/api/feedback", {
    method: "POST",
    headers: {
      "CF-Connecting-IP": "192.0.2.7",
      Origin: "https://playaxial.dev",
      "User-Agent": "TestBrowser/1.0",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function siteverify(result: Record<string, unknown>) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result));
}

function feedbackEnv(overrides: Partial<Env> = {}) {
  const send = vi.fn().mockResolvedValue({ messageId: "m1" });
  const limit = vi.fn().mockResolvedValue({ success: true });
  const globalLimit = vi.fn().mockResolvedValue({ success: true });
  return {
    send,
    limit,
    globalLimit,
    env: {
      ...env,
      TURNSTILE_SECRET: "secret",
      FEEDBACK_RECIPIENT: "owner@example.com",
      FEEDBACK_EMAIL: { send } as unknown as SendEmail,
      FEEDBACK_LIMITER: { limit },
      FEEDBACK_GLOBAL_LIMITER: { limit: globalLimit },
      ...overrides,
    } as Env,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("feedback parsing", () => {
  it("accepts a well-formed report and trims it", () => {
    const parsed = parseFeedbackRequest({
      ...validBody,
      message: "  Line one\r\nLine two\u0007  ",
      name: "Sam\nInjected: header",
    });
    expect(parsed.message).toBe("Line one\nLine two");
    expect(parsed.name).toBe("Sam Injected: header");
    expect(parsed.kind).toBe("bug");
  });

  it.each([
    [{ kind: "spam" }, "Pick bug"],
    [{ message: "short" }, "at least"],
    [{ message: "x".repeat(2001) }, "under 2000"],
    [
      { message: "see http://a.io http://b.io http://c.io http://d.io now" },
      "Too many links",
    ],
    [{ contact: "not an email" }, "email address"],
    [{ contact: "a@b.com\nBcc: x@y.com" }, "email address"],
  ])("rejects %o", (patch, message) => {
    expect(() => parseFeedbackRequest({ ...validBody, ...patch })).toThrow(
      message,
    );
  });

  it("asks for the spam check when the token is missing", () => {
    expect(() =>
      parseFeedbackRequest({ ...validBody, turnstileToken: "" }),
    ).toThrow(RoomServiceError);
  });
});

describe("feedback email", () => {
  it("summarises the message in the subject and sets Reply-To", () => {
    const email = composeFeedbackEmail(parseFeedbackRequest(validBody), {
      userAgent: "TestBrowser/1.0",
      country: "US",
      receivedAt: new Date("2026-10-22T12:00:00Z"),
    });
    expect(email.subject).toBe(
      "[Axial Bug report] The orb pieces flicker when I rotate the board.",
    );
    expect(email.replyTo).toBe("sam@example.com");
    expect(email.text).toContain("Bug report from Sam");
    expect(email.text).toContain("Mode: online");
    expect(email.text).toContain("Browser: TestBrowser/1.0");
  });

  it("leaves Reply-To off for anonymous feedback", () => {
    const email = composeFeedbackEmail(
      parseFeedbackRequest({ ...validBody, name: "", contact: "" }),
      { userAgent: "", country: "", receivedAt: new Date() },
    );
    expect(email.replyTo).toBeUndefined();
    expect(email.text).toContain("from an anonymous player");
  });
});

describe("turnstile verification", () => {
  it("rejects a token minted for another action", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ success: true, action: "login" }));
    expect(
      await verifyTurnstile({
        secret: "s",
        token: "t",
        remoteIp: null,
        fetcher,
      }),
    ).toEqual({ ok: false, reason: "wrong-action:login" });
  });

  it("reports Cloudflare's error codes", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        success: false,
        "error-codes": ["timeout-or-duplicate"],
      }),
    );
    expect(
      await verifyTurnstile({
        secret: "s",
        token: "t",
        remoteIp: null,
        fetcher,
      }),
    ).toEqual({ ok: false, reason: "timeout-or-duplicate" });
  });
});

describe("POST /api/feedback", () => {
  it("verifies the token and emails the owner", async () => {
    const verify = siteverify({ success: true, action: "feedback" });
    const { env: testEnv, send, limit, globalLimit } = feedbackEnv();

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(202);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://playaxial.dev",
    );
    expect(limit).toHaveBeenCalledWith({ key: "axial:feedback:192.0.2.7" });
    expect(globalLimit).toHaveBeenCalledWith({ key: "axial:feedback:all" });
    const verifyBody = verify.mock.calls[0][1]?.body as FormData;
    expect(verifyBody.get("response")).toBe("token-123");
    expect(verifyBody.get("remoteip")).toBe("192.0.2.7");
    expect(send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        from: { email: "feedback@playaxial.dev", name: "Axial feedback" },
        to: "owner@example.com",
        replyTo: "sam@example.com",
      }),
    );
  });

  it("pretends to accept a filled honeypot without verifying or sending", async () => {
    const verify = siteverify({ success: true, action: "feedback" });
    const { env: testEnv, send, limit } = feedbackEnv();

    const response = await worker.fetch(
      feedbackRequest({ ...validBody, website: "https://spam.example" }),
      testEnv,
    );

    expect(response.status).toBe(202);
    expect(verify).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses when the spam check fails", async () => {
    siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    const { env: testEnv, send } = feedbackEnv();

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "auth-failed" },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("explains when Turnstile itself can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { env: testEnv, send } = feedbackEnv();

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { message: expect.stringContaining("spam check") },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rate limits per network before calling Turnstile", async () => {
    const verify = siteverify({ success: true, action: "feedback" });
    const { env: testEnv, send, limit } = feedbackEnv();
    limit.mockResolvedValue({ success: false });

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(verify).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("caps feedback across the whole site", async () => {
    siteverify({ success: true, action: "feedback" });
    const { env: testEnv, send, globalLimit } = feedbackEnv();
    globalLimit.mockResolvedValue({ success: false });

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });

  it("doesn't spend an attempt on a message the form rejects", async () => {
    const { env: testEnv, limit } = feedbackEnv();

    const response = await worker.fetch(
      feedbackRequest({ ...validBody, message: "hi" }),
      testEnv,
    );

    expect(response.status).toBe(400);
    expect(limit).not.toHaveBeenCalled();
  });

  it("reports a delivery failure instead of claiming success", async () => {
    siteverify({ success: true, action: "feedback" });
    const { env: testEnv, send } = feedbackEnv();
    send.mockRejectedValue(new Error("E_RECIPIENT_NOT_VERIFIED"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(503);
    const logged = errorLog.mock.calls
      .map((call) => String(call[0]))
      .join("\n");
    expect(logged).toContain("feedback email failed");
    expect(logged).toContain("The orb pieces flicker");
  });

  it("returns 503 when the server has no feedback secrets", async () => {
    const { env: testEnv } = feedbackEnv({ TURNSTILE_SECRET: "" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(feedbackRequest(validBody), testEnv);

    expect(response.status).toBe(503);
  });

  it("rejects other origins", async () => {
    const { env: testEnv, send } = feedbackEnv();

    const response = await worker.fetch(
      feedbackRequest(validBody, { Origin: "https://evil.example" }),
      testEnv,
    );

    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
});
