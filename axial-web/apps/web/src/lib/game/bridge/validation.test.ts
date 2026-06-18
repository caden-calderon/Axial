import { describe, expect, it } from 'vitest';
import { AXIAL_BRIDGE_VERSION, AXIAL_HOST_SOURCE } from './protocol';
import {
	isBridgeQueryEnabled,
	normalizeOrigin,
	parseAllowedBridgeOrigins,
	parseHostMessage
} from './validation';

describe('bridge validation', () => {
	it('detects explicit embed bridge query params', () => {
		expect(isBridgeQueryEnabled(new URL('https://playaxial.dev/?embed=1&bridge=1'))).toBe(true);
		expect(isBridgeQueryEnabled(new URL('https://playaxial.dev/?embed=1'))).toBe(false);
		expect(isBridgeQueryEnabled(new URL('https://playaxial.dev/'))).toBe(false);
	});

	it('ignores unrelated postMessage payloads', () => {
		expect(parseHostMessage({ hello: 'world' })).toEqual({ ok: false, ignored: true });
		expect(parseHostMessage('noise')).toEqual({ ok: false, ignored: true });
	});

	it('parses supported host commands', () => {
		const stateRequest = parseHostMessage({
			source: AXIAL_HOST_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: 'state-1',
			type: 'axial:get-state'
		});
		const settingsRequest = parseHostMessage({
			source: AXIAL_HOST_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: 'settings-1',
			type: 'axial:set-settings',
			payload: {
				theme: 'light',
				labelsVisible: false,
				gridLayersVisible: false,
				confirmDrop: true,
				boardColor: '#AABBCC',
				opponentMode: 'ai',
				aiDifficulty: 'max'
			}
		});

		expect(stateRequest).toEqual({
			ok: true,
			message: {
				source: AXIAL_HOST_SOURCE,
				version: AXIAL_BRIDGE_VERSION,
				id: 'state-1',
				type: 'axial:get-state'
			}
		});
		expect(settingsRequest).toEqual({
			ok: true,
			message: {
				source: AXIAL_HOST_SOURCE,
				version: AXIAL_BRIDGE_VERSION,
				id: 'settings-1',
				type: 'axial:set-settings',
				payload: {
					theme: 'light',
					labelsVisible: false,
					gridLayersVisible: false,
					confirmDrop: true,
					boardColor: '#AABBCC',
					opponentMode: 'ai',
					aiDifficulty: 'max'
				}
			}
		});
	});

	it('rejects unsupported commands and malformed settings payloads', () => {
		const unsupported = parseHostMessage({
			source: AXIAL_HOST_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: 'move-1',
			type: 'axial:play-move',
			payload: { row: 1, column: 1 }
		});
		const invalidSettings = parseHostMessage({
			source: AXIAL_HOST_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: 'settings-2',
			type: 'axial:set-settings',
			payload: { aiDifficulty: 'impossible' }
		});

		expect(unsupported).toMatchObject({
			ok: false,
			error: {
				code: 'unsupported_command',
				requestId: 'move-1',
				requestType: 'axial:play-move'
			}
		});
		expect(invalidSettings).toMatchObject({
			ok: false,
			error: {
				code: 'invalid_payload',
				requestId: 'settings-2',
				requestType: 'axial:set-settings'
			}
		});
	});

	it('normalizes configured allowed origins', () => {
		expect(normalizeOrigin('https://cadenchau.com/some/path')).toBe('https://cadenchau.com');
		expect(
			parseAllowedBridgeOrigins('https://cadenchau.com/a, nope, http://localhost:5173')
		).toEqual(['https://cadenchau.com', 'http://localhost:5173']);
	});
});
