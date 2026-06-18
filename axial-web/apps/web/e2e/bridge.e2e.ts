import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';

type BridgeMessage = {
	id: string;
	type: string;
	payload?: {
		code?: string;
		settings?: Record<string, unknown>;
		snapshot?: Record<string, unknown>;
		[key: string]: unknown;
	};
};

test('same-origin iframe bridge sends ready, state, settings ack, and payload errors', async ({
	page
}) => {
	await page.goto('/embed-bridge-smoke.html');

	const frame = page.frameLocator('iframe[title="Axial"]');
	await expect(frame.locator('.game-shell')).toHaveAttribute('data-embed', 'true');
	await waitForBridgeMessage(page, 'axial:ready');

	const ready = await firstBridgeMessage(page, 'axial:ready');
	expect(ready.payload?.snapshot).toMatchObject({
		status: 'playing',
		moveCount: 0,
		boardDimensions: { height: 6, rows: 6, columns: 7 }
	});

	await sendBridgeMessage(page, {
		id: 'state-1',
		type: 'axial:get-state'
	});
	await waitForBridgeMessage(page, 'axial:state', 'state-1');

	const state = await firstBridgeMessage(page, 'axial:state', 'state-1');
	expect(state.payload).toMatchObject({
		status: 'playing',
		currentPlayer: 1,
		settings: {
			theme: 'dark',
			labelsVisible: true,
			gridLayersVisible: true,
			confirmDrop: false
		}
	});

	await sendBridgeMessage(page, {
		id: 'settings-1',
		type: 'axial:set-settings',
		payload: {
			theme: 'light',
			labelsVisible: false,
			gridLayersVisible: false,
			confirmDrop: true,
			boardColor: '#33AAFF',
			opponentMode: 'ai',
			aiDifficulty: 'max'
		}
	});
	await waitForBridgeMessage(page, 'axial:ack', 'settings-1');

	const ack = await firstBridgeMessage(page, 'axial:ack', 'settings-1');
	expect(ack.payload?.snapshot).toMatchObject({
		opponentMode: 'ai',
		aiDifficulty: 'max',
		settings: {
			theme: 'light',
			labelsVisible: false,
			gridLayersVisible: false,
			confirmDrop: true,
			boardColor: '#33aaff'
		}
	});
	await expect(frame.locator('.game-shell')).toHaveAttribute('data-theme', 'light');

	await sendBridgeMessage(page, {
		id: 'bad-settings-1',
		type: 'axial:set-settings',
		payload: {
			boardColor: 'blue'
		}
	});
	await waitForBridgeError(page, 'bad-settings-1', 'invalid_payload');
});

test('untrusted iframe parent origin receives no bridge response', async ({ page, baseURL }) => {
	const appUrl = baseURL ?? 'http://127.0.0.1:4173';
	const host = await startUntrustedHost(appUrl);

	try {
		await page.goto(host.url);
		await page.waitForFunction(() => window.untrustedBridgeDone === true);

		const messages = await page.evaluate(() => window.untrustedBridgeMessages);
		expect(messages).toEqual([]);
	} finally {
		await host.close();
	}
});

async function sendBridgeMessage(page: Page, message: object) {
	await page.evaluate((payload) => window.axialBridgeSend(payload), message);
}

async function waitForBridgeMessage(page: Page, type: string, id?: string): Promise<void> {
	await page.waitForFunction(
		({ expectedType, expectedId }) =>
			window.axialBridgeMessages.some(
				(message) =>
					message.type === expectedType && (expectedId === undefined || message.id === expectedId)
			),
		{ expectedType: type, expectedId: id }
	);
}

async function waitForBridgeError(page: Page, requestId: string, code: string): Promise<void> {
	await page.waitForFunction(
		({ expectedRequestId, expectedCode }) =>
			window.axialBridgeMessages.some(
				(message) =>
					message.type === 'axial:error' &&
					message.payload?.requestId === expectedRequestId &&
					message.payload?.code === expectedCode
			),
		{ expectedRequestId: requestId, expectedCode: code }
	);
}

async function firstBridgeMessage(page: Page, type: string, id?: string): Promise<BridgeMessage> {
	return page.evaluate(
		({ expectedType, expectedId }) =>
			window.axialBridgeMessages.find(
				(message) =>
					message.type === expectedType && (expectedId === undefined || message.id === expectedId)
			) as BridgeMessage,
		{ expectedType: type, expectedId: id }
	);
}

async function startUntrustedHost(appUrl: string): Promise<{
	url: string;
	close: () => Promise<void>;
}> {
	const appOrigin = new URL(appUrl).origin;
	const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Untrusted Axial Host</title>
	</head>
	<body>
		<iframe id="axial-frame" title="Axial" src="${appOrigin}/?embed=1&amp;bridge=1"></iframe>
		<script>
			const frame = document.querySelector('#axial-frame');
			window.untrustedBridgeMessages = [];
			window.untrustedBridgeDone = false;
			window.addEventListener('message', (event) => {
				if (event.source !== frame.contentWindow) return;
				window.untrustedBridgeMessages.push(event.data);
			});
			frame.addEventListener('load', () => {
				window.setTimeout(() => {
					frame.contentWindow.postMessage(
						{
							source: 'axial-host',
							version: 1,
							id: 'untrusted-state-1',
							type: 'axial:get-state'
						},
						'${appOrigin}'
					);
				}, 100);
				window.setTimeout(() => {
					window.untrustedBridgeDone = true;
				}, 700);
			});
		</script>
	</body>
</html>`;
	const server = await listen(createServer((_request, response) => response.end(html)));
	const address = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${address.port}`,
		close: () =>
			new Promise((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			})
	};
}

function listen(server: Server): Promise<Server> {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve(server);
		});
	});
}

declare global {
	interface Window {
		axialBridgeMessages: BridgeMessage[];
		axialBridgeSend: (message: object) => void;
		untrustedBridgeDone: boolean;
		untrustedBridgeMessages: BridgeMessage[];
	}
}
