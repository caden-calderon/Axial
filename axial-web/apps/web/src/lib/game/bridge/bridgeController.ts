import { env } from '$env/dynamic/public';
import type { AiDifficulty, GameController } from '../state/gameController.svelte';
import {
	AXIAL_BRIDGE_SOURCE,
	AXIAL_BRIDGE_VERSION,
	BRIDGE_SETTING_KEYS,
	HOST_COMMAND_TYPES,
	type AxialBridgeErrorPayload,
	type AxialSettingsPatch,
	type AxialToHostMessage,
	type HostToAxialMessage
} from './protocol';
import { createAxialStateSnapshot } from './stateSnapshot';
import {
	bridgeError,
	isAllowedBridgeOrigin,
	isBridgeQueryEnabled,
	originFromReferrer,
	parseAllowedBridgeOrigins,
	parseHostMessage
} from './validation';

type BridgeWindow = Window & typeof globalThis;

type BridgeRuntime = {
	hostWindow: Window;
	window: BridgeWindow;
};

type SettingsApplyResult =
	| { ok: true; applied: AxialSettingsPatch }
	| { ok: false; error: AxialBridgeErrorPayload };

let nextMessageId = 0;

export function createAxialBridgeController(controller: GameController) {
	let active = false;
	let runtime: BridgeRuntime | null = null;
	let allowedOrigins = new Set<string>();
	let targetOrigin: string | null = null;
	let lastPublishedSnapshot = '';

	function start(windowRef: BridgeWindow = window): boolean {
		const url = new URL(windowRef.location.href);
		if (!isBridgeQueryEnabled(url) || windowRef.parent === windowRef) return false;

		stop();

		const configuredOrigins = parseAllowedBridgeOrigins(env.PUBLIC_AXIAL_BRIDGE_ORIGINS);
		allowedOrigins = buildAllowedBridgeOrigins(windowRef.location.origin, configuredOrigins);
		const referrerOrigin = originFromReferrer(windowRef.document.referrer);

		targetOrigin =
			referrerOrigin && isAllowedBridgeOrigin(referrerOrigin, allowedOrigins)
				? referrerOrigin
				: null;
		runtime = {
			hostWindow: windowRef.parent,
			window: windowRef
		};
		active = true;
		lastPublishedSnapshot = '';

		windowRef.addEventListener('message', handleMessage);
		postReady();

		return true;
	}

	function stop(): void {
		if (runtime) runtime.window.removeEventListener('message', handleMessage);

		active = false;
		runtime = null;
		allowedOrigins = new Set();
		targetOrigin = null;
		lastPublishedSnapshot = '';
	}

	function publishState(id = createBridgeMessageId('state')): void {
		if (!active || !runtime || !targetOrigin) return;

		const snapshot = createAxialStateSnapshot(controller);
		const serialized = JSON.stringify(snapshot);
		if (serialized === lastPublishedSnapshot) return;

		lastPublishedSnapshot = serialized;
		post({
			source: AXIAL_BRIDGE_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id,
			type: 'axial:state',
			payload: snapshot
		});
	}

	function handleMessage(event: MessageEvent): void {
		if (!active || !runtime) return;
		if (event.source !== runtime.hostWindow) return;
		if (!isAllowedBridgeOrigin(event.origin, allowedOrigins)) return;
		if (targetOrigin && event.origin !== targetOrigin) return;

		targetOrigin ??= event.origin;

		const parsed = parseHostMessage(event.data);
		if (!parsed.ok) {
			if (!parsed.ignored) postError(parsed.error);
			return;
		}

		handleHostMessage(parsed.message);
	}

	function handleHostMessage(message: HostToAxialMessage): void {
		switch (message.type) {
			case 'axial:get-state':
				postState(message.id);
				return;
			case 'axial:set-settings':
				handleSetSettings(message);
				return;
		}
	}

	function handleSetSettings(message: Extract<HostToAxialMessage, { type: 'axial:set-settings' }>) {
		const result = applySettingsPatch(controller, message.payload);
		if (!result.ok) {
			postError({
				...result.error,
				requestId: message.id,
				requestType: message.type
			});
			return;
		}

		const snapshot = createAxialStateSnapshot(controller);
		lastPublishedSnapshot = JSON.stringify(snapshot);
		post({
			source: AXIAL_BRIDGE_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: message.id,
			type: 'axial:ack',
			payload: {
				requestType: message.type,
				applied: result.applied,
				snapshot
			}
		});
		postState(createBridgeMessageId('state'));
	}

	function postReady(): void {
		if (!targetOrigin) return;

		const snapshot = createAxialStateSnapshot(controller);
		lastPublishedSnapshot = JSON.stringify(snapshot);
		post({
			source: AXIAL_BRIDGE_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: createBridgeMessageId('ready'),
			type: 'axial:ready',
			payload: {
				bridge: {
					name: 'axial-iframe-bridge',
					version: AXIAL_BRIDGE_VERSION
				},
				capabilities: {
					commands: HOST_COMMAND_TYPES,
					settings: BRIDGE_SETTING_KEYS
				},
				snapshot
			}
		});
	}

	function postState(id: string): void {
		if (!runtime || !targetOrigin) return;

		const snapshot = createAxialStateSnapshot(controller);
		lastPublishedSnapshot = JSON.stringify(snapshot);
		post({
			source: AXIAL_BRIDGE_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id,
			type: 'axial:state',
			payload: snapshot
		});
	}

	function postError(payload: AxialBridgeErrorPayload): void {
		post({
			source: AXIAL_BRIDGE_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: createBridgeMessageId('error'),
			type: 'axial:error',
			payload
		});
	}

	function post(message: AxialToHostMessage): void {
		if (!runtime || !targetOrigin) return;
		runtime.hostWindow.postMessage(message, targetOrigin);
	}

	return {
		get active() {
			return active;
		},
		publishState,
		start,
		stop
	};
}

export function buildAllowedBridgeOrigins(
	currentOrigin: string,
	configuredOrigins: readonly string[]
): Set<string> {
	return new Set([currentOrigin, ...configuredOrigins]);
}

export function applySettingsPatch(
	controller: GameController,
	patch: AxialSettingsPatch
): SettingsApplyResult {
	const lockedSetting = firstLockedSetting(controller, patch);
	if (lockedSetting) {
		return {
			ok: false,
			error: bridgeError(
				'locked_setting',
				`Start a new match before changing ${lockedSetting}.`,
				undefined,
				'axial:set-settings',
				{ setting: lockedSetting }
			)
		};
	}

	if (patch.theme && controller.uiTheme !== patch.theme) controller.toggleTheme();
	if (
		typeof patch.labelsVisible === 'boolean' &&
		controller.labelsVisible !== patch.labelsVisible
	) {
		controller.toggleLabels();
	}
	if (
		typeof patch.gridLayersVisible === 'boolean' &&
		controller.gridLayersVisible !== patch.gridLayersVisible
	) {
		controller.toggleGridLayers();
	}
	if (
		typeof patch.confirmDrop === 'boolean' &&
		controller.confirmDropEnabled !== patch.confirmDrop
	) {
		controller.toggleConfirmDrop();
	}
	if (patch.boardColor) controller.setBoardColor(patch.boardColor);
	if (patch.opponentMode && controller.opponentMode !== patch.opponentMode) {
		controller.setOpponentMode(patch.opponentMode);
	}
	if (patch.aiDifficulty) {
		const difficulty = toInternalAiDifficulty(patch.aiDifficulty);
		if (controller.aiDifficulty !== difficulty) controller.setAiDifficulty(difficulty);
	}

	return { ok: true, applied: patch };
}

export function toInternalAiDifficulty(
	difficulty: NonNullable<AxialSettingsPatch['aiDifficulty']>
): AiDifficulty {
	return difficulty === 'max' ? 'nightmare' : difficulty;
}

export function createBridgeMessageId(prefix: string): string {
	nextMessageId += 1;
	return `axial-${prefix}-${Date.now().toString(36)}-${nextMessageId}`;
}

function firstLockedSetting(controller: GameController, patch: AxialSettingsPatch): string | null {
	if (
		patch.opponentMode &&
		patch.opponentMode !== controller.opponentMode &&
		controller.setupLocked
	) {
		return 'opponentMode';
	}

	if (
		patch.aiDifficulty &&
		toInternalAiDifficulty(patch.aiDifficulty) !== controller.aiDifficulty &&
		controller.setupLocked
	) {
		return 'aiDifficulty';
	}

	return null;
}
