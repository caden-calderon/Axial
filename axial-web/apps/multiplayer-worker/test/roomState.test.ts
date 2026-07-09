import { describe, expect, it } from "vitest";
import {
  createInitialRoomState,
  expireStalePresence,
  HTTP_FALLBACK_LEASE_MS,
  markConnected,
  markDisconnected,
  markHttpFallbackSeen,
  nextRoomAlarmAt,
} from "../src/roomState";

describe("room transport presence", () => {
  it("keeps socket ownership while HTTP fallback refreshes presence", () => {
    const startedAt = 1_000;
    const initial = createInitialRoomState({
      roomCode: "ABCDEFGH",
      hostPlayerId: "host",
      hostDisplayName: "Host",
      hostTokenHash: "hash",
      now: startedAt,
    });
    const socketState = markConnected(
      initial,
      "host",
      "socket-1",
      startedAt + 1,
    ).state;
    const fallbackState = markHttpFallbackSeen(
      socketState,
      "host",
      startedAt + 2,
    ).state;
    const player = fallbackState.players[0];

    expect(player?.activeConnectionId).toBe("socket-1");
    expect(player?.httpFallbackLeaseUntil).toBe(
      startedAt + 2 + HTTP_FALLBACK_LEASE_MS,
    );
  });

  it("keeps fallback presence after socket close, then expires its lease", () => {
    const startedAt = 2_000;
    const initial = createInitialRoomState({
      roomCode: "ABCDEFGH",
      hostPlayerId: "host",
      hostDisplayName: "Host",
      hostTokenHash: "hash",
      now: startedAt,
    });
    const socketState = markConnected(
      initial,
      "host",
      "socket-1",
      startedAt + 1,
    ).state;
    const fallbackState = markHttpFallbackSeen(
      socketState,
      "host",
      startedAt + 2,
    ).state;
    const leaseUntil = startedAt + 2 + HTTP_FALLBACK_LEASE_MS;
    const socketClosed = markDisconnected(
      fallbackState,
      "host",
      "socket-1",
      startedAt + 3,
    );

    expect(socketClosed.events).toHaveLength(0);
    expect(socketClosed.state.players[0]?.connected).toBe(true);
    expect(nextRoomAlarmAt(socketClosed.state)).toBe(leaseUntil);

    const leaseExpired = expireStalePresence(socketClosed.state, leaseUntil);

    expect(leaseExpired.state.players[0]?.connected).toBe(false);
    expect(leaseExpired.state.players[0]?.httpFallbackLeaseUntil).toBeNull();
    expect(leaseExpired.events).toHaveLength(1);
    expect(leaseExpired.events[0]?.event.type).toBe("room:player-disconnected");
    expect(nextRoomAlarmAt(leaseExpired.state)).toBe(
      leaseExpired.state.expiresAt,
    );
  });
});
