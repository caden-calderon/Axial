import { describe, expect, it, vi } from "vitest";
import { parseClientMessage, readJsonRequest } from "../src/validation";

function requestWithChunks(chunks: Uint8Array[]) {
  let reads = 0;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[reads++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  return {
    request: new Request("https://worker.test/api/rooms", {
      method: "POST",
      body,
    }),
    cancel,
    reads: () => reads,
  };
}

describe("bounded multiplayer JSON", () => {
  it("cancels a chunked request as soon as it crosses the byte cap", async () => {
    const input = requestWithChunks(
      Array.from({ length: 1024 }, () => new Uint8Array(1024).fill(32)),
    );
    await expect(readJsonRequest(input.request)).rejects.toMatchObject({
      status: 413,
    });
    expect(input.reads()).toBe(5);
    expect(input.cancel).toHaveBeenCalledOnce();
  });

  it("measures multibyte input in bytes instead of characters", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ text: "é".repeat(2100) }),
    );
    const input = requestWithChunks([bytes]);
    await expect(readJsonRequest(input.request)).rejects.toMatchObject({
      status: 413,
    });
    expect(input.cancel).toHaveBeenCalledOnce();
  });

  it("accepts exactly the byte cap and decodes a split UTF-8 character", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ text: "é" }) + " ".repeat(4083),
    );
    expect(bytes.byteLength).toBe(4096);
    const split = bytes.indexOf(0xc3) + 1;
    const input = requestWithChunks([
      bytes.slice(0, split),
      bytes.slice(split),
    ]);
    await expect(readJsonRequest(input.request)).resolves.toEqual({
      text: "é",
    });
    expect(input.cancel).not.toHaveBeenCalled();
  });

  it("rejects an advertised oversized request before pulling its body", async () => {
    const input = requestWithChunks([new Uint8Array(1)]);
    input.request.headers.set("content-length", "4097");
    await expect(readJsonRequest(input.request)).rejects.toMatchObject({
      status: 413,
    });
    expect(input.reads()).toBe(0);
  });

  it("retains empty-body and invalid-JSON behavior", async () => {
    await expect(
      readJsonRequest(new Request("https://worker.test", { method: "POST" })),
    ).resolves.toEqual({});
    await expect(
      readJsonRequest(
        new Request("https://worker.test", { method: "POST", body: "{" }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each(["x".repeat(4097), JSON.stringify({ text: "é".repeat(2100) })])(
    "rejects oversized socket data before command parsing",
    (message) => {
      expect(() => parseClientMessage(message)).toThrow(
        "Client message is too large.",
      );
    },
  );
});
