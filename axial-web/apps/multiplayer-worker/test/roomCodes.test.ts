import { describe, expect, it } from "vitest";
import {
  formatRoomCode,
  generateRoomCode,
  normalizeRoomCode,
} from "../src/roomCodes";

describe("room codes", () => {
  it("generates voice-friendly 8 character room codes", () => {
    expect.assertions(4);

    const code = generateRoomCode();

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(formatRoomCode(code)).toMatch(
      /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(normalizeRoomCode(formatRoomCode(code))).toBe(code);
    expect(normalizeRoomCode("bad-code")).toBeNull();
  });
});
