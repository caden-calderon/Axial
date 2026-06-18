import { describe, expect, it } from 'vitest';
import { createGameController } from '../state/gameController.svelte';
import {
	applySettingsPatch,
	buildAllowedBridgeOrigins,
	toInternalAiDifficulty
} from './bridgeController';

describe('bridge controller settings adapter', () => {
	it('maps bridge difficulty names onto the internal controller presets', () => {
		expect(toInternalAiDifficulty('easy')).toBe('easy');
		expect(toInternalAiDifficulty('medium')).toBe('medium');
		expect(toInternalAiDifficulty('hard')).toBe('hard');
		expect(toInternalAiDifficulty('max')).toBe('nightmare');
	});

	it('applies safe settings through controller methods', () => {
		const controller = createGameController();
		const result = applySettingsPatch(controller, {
			theme: 'light',
			labelsVisible: false,
			gridLayersVisible: false,
			confirmDrop: true,
			boardColor: '#AABBCC',
			opponentMode: 'ai',
			aiDifficulty: 'max'
		});

		expect(result).toEqual({
			ok: true,
			applied: {
				theme: 'light',
				labelsVisible: false,
				gridLayersVisible: false,
				confirmDrop: true,
				boardColor: '#AABBCC',
				opponentMode: 'ai',
				aiDifficulty: 'max'
			}
		});
		expect(controller.uiTheme).toBe('light');
		expect(controller.labelsVisible).toBe(false);
		expect(controller.gridLayersVisible).toBe(false);
		expect(controller.confirmDropEnabled).toBe(true);
		expect(controller.boardColor).toBe('#aabbcc');
		expect(controller.opponentMode).toBe('ai');
		expect(controller.aiDifficulty).toBe('nightmare');
	});

	it('rejects setup-locked settings without partial mutation', () => {
		const controller = createGameController();

		controller.setOpponentMode('ai');
		controller.playMove({ row: 0, col: 0 });
		const result = applySettingsPatch(controller, {
			theme: 'light',
			aiDifficulty: 'easy'
		});

		expect(result).toMatchObject({
			ok: false,
			error: {
				code: 'locked_setting',
				requestType: 'axial:set-settings',
				details: { setting: 'aiDifficulty' }
			}
		});
		expect(controller.uiTheme).toBe('dark');
		expect(controller.aiDifficulty).toBe('hard');
	});

	it('builds a same-origin plus configured-origin allow-list', () => {
		expect([
			...buildAllowedBridgeOrigins('https://playaxial.dev', ['https://cadenchau.com'])
		]).toEqual(['https://playaxial.dev', 'https://cadenchau.com']);
	});
});
