import {
	AXIAL_BRIDGE_VERSION,
	AXIAL_HOST_SOURCE,
	BRIDGE_SETTING_KEYS,
	HOST_COMMAND_TYPES,
	type AxialBridgeErrorCode,
	type AxialBridgeErrorPayload,
	type AxialSettingsPatch,
	type HostToAxialMessage
} from './protocol';

type HostMessageParseResult =
	| { ok: true; message: HostToAxialMessage }
	| { ok: false; ignored: true }
	| { ok: false; ignored?: false; error: AxialBridgeErrorPayload };

const MAX_MESSAGE_ID_LENGTH = 128;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const SUPPORTED_COMMANDS = new Set<string>(HOST_COMMAND_TYPES);
const SUPPORTED_SETTINGS = new Set<string>(BRIDGE_SETTING_KEYS);

export function isBridgeQueryEnabled(url: URL): boolean {
	return url.searchParams.get('embed') === '1' && url.searchParams.get('bridge') === '1';
}

export function parseHostMessage(data: unknown): HostMessageParseResult {
	if (!isRecord(data)) return { ok: false, ignored: true };
	if (data.source !== AXIAL_HOST_SOURCE) return { ok: false, ignored: true };

	const requestId = readString(data.id) ?? undefined;
	const requestType = readString(data.type) ?? undefined;

	if (data.version !== AXIAL_BRIDGE_VERSION) {
		return {
			ok: false,
			error: bridgeError(
				'unsupported_version',
				`Unsupported Axial bridge version: ${String(data.version)}`,
				requestId,
				requestType
			)
		};
	}

	if (!requestId || requestId.length > MAX_MESSAGE_ID_LENGTH) {
		return {
			ok: false,
			error: bridgeError(
				'malformed_message',
				'Bridge messages need a non-empty string id under 128 characters.',
				requestId,
				requestType
			)
		};
	}

	if (!requestType) {
		return {
			ok: false,
			error: bridgeError('malformed_message', 'Bridge messages need a string type.', requestId)
		};
	}

	if (!SUPPORTED_COMMANDS.has(requestType)) {
		return {
			ok: false,
			error: bridgeError(
				'unsupported_command',
				`Unsupported Axial bridge command: ${requestType}`,
				requestId,
				requestType
			)
		};
	}

	if (requestType === 'axial:get-state') {
		if ('payload' in data) {
			return {
				ok: false,
				error: bridgeError(
					'invalid_payload',
					'axial:get-state does not accept a payload.',
					requestId,
					requestType
				)
			};
		}

		return {
			ok: true,
			message: {
				source: AXIAL_HOST_SOURCE,
				version: AXIAL_BRIDGE_VERSION,
				id: requestId,
				type: requestType
			}
		};
	}

	const settings = parseSettingsPatch(data.payload);
	if (!settings.ok) {
		return {
			ok: false,
			error: bridgeError('invalid_payload', settings.message, requestId, requestType)
		};
	}

	return {
		ok: true,
		message: {
			source: AXIAL_HOST_SOURCE,
			version: AXIAL_BRIDGE_VERSION,
			id: requestId,
			type: 'axial:set-settings',
			payload: settings.patch
		}
	};
}

export function parseAllowedBridgeOrigins(serialized: string | undefined): string[] {
	if (!serialized) return [];

	return serialized
		.split(',')
		.map((origin) => normalizeOrigin(origin.trim()))
		.filter((origin): origin is string => origin !== null);
}

export function normalizeOrigin(value: string): string | null {
	if (!value) return null;

	try {
		const origin = new URL(value).origin;
		return origin === 'null' ? null : origin;
	} catch {
		return null;
	}
}

export function originFromReferrer(referrer: string): string | null {
	return normalizeOrigin(referrer);
}

export function isAllowedBridgeOrigin(
	origin: string,
	allowedOrigins: ReadonlySet<string>
): boolean {
	return allowedOrigins.has(origin);
}

export function bridgeError(
	code: AxialBridgeErrorCode,
	message: string,
	requestId?: string,
	requestType?: string,
	details?: Record<string, string | number | boolean>
): AxialBridgeErrorPayload {
	return {
		code,
		message,
		...(requestId ? { requestId } : {}),
		...(requestType ? { requestType } : {}),
		...(details ? { details } : {})
	};
}

function parseSettingsPatch(
	value: unknown
): { ok: true; patch: AxialSettingsPatch } | { ok: false; message: string } {
	if (!isRecord(value)) {
		return { ok: false, message: 'axial:set-settings needs an object payload.' };
	}

	const keys = Object.keys(value);
	if (keys.length === 0) {
		return { ok: false, message: 'axial:set-settings needs at least one setting.' };
	}

	const unknownKey = keys.find((key) => !SUPPORTED_SETTINGS.has(key));
	if (unknownKey) {
		return { ok: false, message: `Unsupported setting: ${unknownKey}` };
	}

	const patch: AxialSettingsPatch = {};

	if ('theme' in value) {
		if (value.theme !== 'dark' && value.theme !== 'light') {
			return { ok: false, message: 'theme must be "dark" or "light".' };
		}
		patch.theme = value.theme;
	}

	if ('labelsVisible' in value) {
		if (typeof value.labelsVisible !== 'boolean') {
			return { ok: false, message: 'labelsVisible must be boolean.' };
		}
		patch.labelsVisible = value.labelsVisible;
	}

	if ('gridLayersVisible' in value) {
		if (typeof value.gridLayersVisible !== 'boolean') {
			return { ok: false, message: 'gridLayersVisible must be boolean.' };
		}
		patch.gridLayersVisible = value.gridLayersVisible;
	}

	if ('confirmDrop' in value) {
		if (typeof value.confirmDrop !== 'boolean') {
			return { ok: false, message: 'confirmDrop must be boolean.' };
		}
		patch.confirmDrop = value.confirmDrop;
	}

	if ('boardColor' in value) {
		if (typeof value.boardColor !== 'string' || !HEX_COLOR_PATTERN.test(value.boardColor)) {
			return { ok: false, message: 'boardColor must be a #RRGGBB color.' };
		}
		patch.boardColor = value.boardColor;
	}

	if ('opponentMode' in value) {
		if (value.opponentMode !== 'local' && value.opponentMode !== 'ai') {
			return { ok: false, message: 'opponentMode must be "local" or "ai".' };
		}
		patch.opponentMode = value.opponentMode;
	}

	if ('aiDifficulty' in value) {
		if (
			value.aiDifficulty !== 'easy' &&
			value.aiDifficulty !== 'medium' &&
			value.aiDifficulty !== 'hard' &&
			value.aiDifficulty !== 'max'
		) {
			return { ok: false, message: 'aiDifficulty must be easy, medium, hard, or max.' };
		}
		patch.aiDifficulty = value.aiDifficulty;
	}

	return { ok: true, patch };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}
