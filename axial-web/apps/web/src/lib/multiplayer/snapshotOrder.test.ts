import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '@axial/multiplayer-protocol';
import { shouldAcceptRoomSnapshot } from './snapshotOrder';

const current = { roomCode: 'ABCD1234', revision: 8 } as RoomSnapshot;

describe('online snapshot ordering', () => {
	it('rejects older snapshots for the active room', () => {
		expect(
			shouldAcceptRoomSnapshot(current, {
				...current,
				revision: 7
			})
		).toBe(false);
	});

	it('accepts equal revisions and newer snapshots', () => {
		expect(shouldAcceptRoomSnapshot(current, current)).toBe(true);
		expect(
			shouldAcceptRoomSnapshot(current, {
				...current,
				revision: 9
			})
		).toBe(true);
	});

	it('rejects snapshots from an abandoned room session', () => {
		expect(shouldAcceptRoomSnapshot(null, { ...current, roomCode: 'WXYZ5678' }, 'ABCD1234')).toBe(
			false
		);
	});
});
