import { expect, test, type Page } from '@playwright/test';

const LOCAL_BASE_URL = 'http://127.0.0.1:4173';

test('two players can start, enforce countdown, reconnect, and leave cleanly', async ({
	browser,
	page: hostPage
}) => {
	test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local Worker integration test');

	const guestContext = await browser.newContext({ baseURL: LOCAL_BASE_URL });
	const guestPage = await guestContext.newPage();

	try {
		await openOnlineSetup(hostPage);
		await hostPage.getByLabel('Your name').fill('Host');
		await hostPage.getByRole('button', { name: 'Create room', exact: true }).click();
		await expect(hostPage).toHaveURL(/\?[^#]*room=[A-HJ-NP-Z2-9]{8}/);
		const roomCode = new URL(hostPage.url()).searchParams.get('room');
		expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
		if (!roomCode) throw new Error('Created room URL did not include a room code');

		await openOnlineSetup(guestPage);
		await guestPage.getByLabel('Your name').fill('Friend');
		await guestPage.getByLabel('Join code').fill(roomCode);
		await guestPage.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(guestPage).toHaveURL(new RegExp(`room=${roomCode}`));
		await expect(hostPage.getByText('Friend', { exact: true })).toBeVisible();

		const hostModes = hostPage.getByRole('group', { name: 'Opponent mode' });
		await expect(hostModes.getByRole('button', { name: 'Local', exact: true })).toBeDisabled();
		await expect(hostModes.getByRole('button', { name: 'AI', exact: true })).toBeDisabled();

		await guestPage.getByRole('button', { name: 'Ready', exact: true }).click();
		await hostPage.getByRole('button', { name: 'Ready', exact: true }).click();
		await hostPage.getByRole('button', { name: 'Start game', exact: true }).click();

		await expect
			.poll(() => storedSnapshot(hostPage, roomCode))
			.toMatchObject({ phase: 'playing', game: { moveHistory: [] } });
		const started = await storedSnapshot(hostPage, roomCode);
		expect(started).not.toBeNull();
		if (!started) throw new Error('Host did not store the started room snapshot');

		const earlyMove = await submitStoredMove(hostPage, roomCode, 0, 0);
		expect(earlyMove.status).toBe(409);
		expect(earlyMove.payload).toMatchObject({
			error: { code: 'match-not-playable' }
		});

		const afterEarlySync = await syncStoredRoom(hostPage, roomCode);
		expect(afterEarlySync.snapshot.revision).toBe(started.revision);
		expect(afterEarlySync.snapshot.game.moveHistory).toHaveLength(0);

		const waitMs = Math.max(0, (started.match.playableAt ?? 0) - Date.now() + 80);
		if (waitMs > 0) await hostPage.waitForTimeout(waitMs);

		const acceptedMove = await submitStoredMove(hostPage, roomCode, 0, 0);
		expect(acceptedMove.status).toBe(200);
		expect(acceptedMove.payload).toMatchObject({
			snapshot: { game: { moveHistory: [{ row: 0, col: 0, player: 1 }] } }
		});

		await expect
			.poll(async () => (await storedSnapshot(guestPage, roomCode))?.game.moveHistory.length)
			.toBe(1);

		await guestPage.reload();
		await expect(guestPage).toHaveURL(new RegExp(`room=${roomCode}`));
		await expect
			.poll(async () => (await storedSnapshot(guestPage, roomCode))?.game.moveHistory.length)
			.toBe(1);
		await expect(guestPage.getByText('Room', { exact: true })).toBeVisible();

		await guestPage.getByRole('button', { name: 'Leave', exact: true }).click();
		await expect(guestPage).not.toHaveURL(/[?&]room=/);
		await expect
			.poll(async () => (await storedSnapshot(hostPage, roomCode))?.phase)
			.toBe('expired');
		await expect(hostPage.getByText('Expired', { exact: true }).first()).toBeVisible();

		await hostPage.getByRole('button', { name: 'Leave', exact: true }).click();
		await expect(hostPage).not.toHaveURL(/[?&]room=/);
	} finally {
		await guestContext.close();
	}
});

async function openOnlineSetup(page: Page): Promise<void> {
	await page.goto('/?tour=0');
	await page
		.getByRole('group', { name: 'Opponent mode' })
		.getByRole('button', { name: 'Online', exact: true })
		.click();
	await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeVisible();
}

async function storedSnapshot(page: Page, roomCode: string): Promise<StoredSnapshot | null> {
	return page.evaluate((code) => {
		const raw = sessionStorage.getItem(`axial-room-snapshot:${code}`);
		return raw ? (JSON.parse(raw) as StoredSnapshot) : null;
	}, roomCode);
}

async function submitStoredMove(
	page: Page,
	roomCode: string,
	row: number,
	col: number
): Promise<{ status: number; payload: unknown }> {
	return page.evaluate(
		async ({ code, move }) => {
			const credentialsRaw = localStorage.getItem(`axial-room-credentials:${code}`);
			const snapshotRaw = sessionStorage.getItem(`axial-room-snapshot:${code}`);
			if (!credentialsRaw || !snapshotRaw) throw new Error('Missing stored room session');
			const credentials = JSON.parse(credentialsRaw) as StoredCredentials;
			const snapshot = JSON.parse(snapshotRaw) as StoredSnapshot;
			const response = await fetch(`http://127.0.0.1:8787/api/rooms/${code}/commands`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playerId: credentials.playerId,
					reconnectToken: credentials.reconnectToken,
					command: {
						source: 'axial-client',
						version: 1,
						id: crypto.randomUUID(),
						type: 'game:play-move',
						payload: { move, expectedRevision: snapshot.revision }
					}
				})
			});
			return { status: response.status, payload: (await response.json()) as unknown };
		},
		{ code: roomCode, move: { row, col } }
	);
}

async function syncStoredRoom(page: Page, roomCode: string): Promise<{ snapshot: StoredSnapshot }> {
	return page.evaluate(async (code) => {
		const credentialsRaw = localStorage.getItem(`axial-room-credentials:${code}`);
		if (!credentialsRaw) throw new Error('Missing stored room credentials');
		const credentials = JSON.parse(credentialsRaw) as StoredCredentials;
		const response = await fetch(`http://127.0.0.1:8787/api/rooms/${code}/sync`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				playerId: credentials.playerId,
				reconnectToken: credentials.reconnectToken
			})
		});
		if (!response.ok) throw new Error(`Room sync failed with ${response.status}`);
		return (await response.json()) as { snapshot: StoredSnapshot };
	}, roomCode);
}

type StoredCredentials = {
	playerId: string;
	reconnectToken: string;
};

type StoredSnapshot = {
	phase: string;
	revision: number;
	match: { playableAt: number | null };
	game: {
		moveHistory: Array<{ row: number; col: number; player: number }>;
	};
};
