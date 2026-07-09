import type { RoomSnapshot } from '@axial/multiplayer-protocol';

export function shouldAcceptRoomSnapshot(
	current: RoomSnapshot | null,
	incoming: RoomSnapshot,
	expectedRoomCode?: string
): boolean {
	const incomingRoomCode = normalizeRoomCode(incoming.roomCode);
	if (expectedRoomCode && incomingRoomCode !== normalizeRoomCode(expectedRoomCode)) return false;

	return !(
		current &&
		normalizeRoomCode(current.roomCode) === incomingRoomCode &&
		incoming.revision < current.revision
	);
}

function normalizeRoomCode(roomCode: string): string {
	return roomCode.toUpperCase().replace(/[\s-]/g, '');
}
