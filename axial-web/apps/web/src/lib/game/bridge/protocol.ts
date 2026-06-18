import type {
	MatchMode,
	PlacedMoveKind,
	Player,
	SpecialMoveStep,
	TacticalSpecialId
} from '@axial/core';

export const AXIAL_BRIDGE_VERSION = 1;
export const AXIAL_BRIDGE_SOURCE = 'axial';
export const AXIAL_HOST_SOURCE = 'axial-host';

export type AxialBridgeVersion = typeof AXIAL_BRIDGE_VERSION;
export type AxialBridgeAiDifficulty = 'easy' | 'medium' | 'hard' | 'max';
export type AxialBridgeStatus = 'playing' | 'won' | 'draw';
export type AxialBridgeTheme = 'dark' | 'light';
export type AxialBridgeOpponentMode = 'local' | 'ai';

export type AxialBridgeMove = {
	row: number;
	column: number;
	layer: number;
	player: Player;
	kind: PlacedMoveKind;
	special?: {
		action: TacticalSpecialId;
		step: SpecialMoveStep;
	};
};

export type AxialStateSnapshot = {
	mode: MatchMode;
	status: AxialBridgeStatus;
	opponentMode: AxialBridgeOpponentMode;
	aiDifficulty: AxialBridgeAiDifficulty;
	currentPlayer: Player | null;
	winner: Player | null;
	moveCount: number;
	boardDimensions: {
		height: number;
		rows: number;
		columns: number;
	};
	winCondition: {
		lineLength: number;
		linesToWin: number;
	};
	lastMove: AxialBridgeMove | null;
	moveHistory: AxialBridgeMove[];
	settings: {
		theme: AxialBridgeTheme;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		confirmDrop: boolean;
		boardColor: string;
	};
	locks: {
		setupLocked: boolean;
		appearanceLocked: boolean;
	};
	aiThinking: boolean;
	threatSummary?: {
		currentPlayerWinningMoves: AxialBridgeMove[];
		opponentWinningMoves: AxialBridgeMove[];
		currentPlayerCompletedLines: number;
		opponentCompletedLines: number;
	};
};

export type AxialSettingsPatch = {
	theme?: AxialBridgeTheme;
	labelsVisible?: boolean;
	gridLayersVisible?: boolean;
	confirmDrop?: boolean;
	boardColor?: string;
	opponentMode?: AxialBridgeOpponentMode;
	aiDifficulty?: AxialBridgeAiDifficulty;
};

export type AxialReadyPayload = {
	bridge: {
		name: 'axial-iframe-bridge';
		version: AxialBridgeVersion;
	};
	capabilities: {
		commands: readonly HostToAxialMessage['type'][];
		settings: readonly (keyof AxialSettingsPatch)[];
	};
	snapshot: AxialStateSnapshot;
};

export type AxialAckPayload = {
	requestType: HostToAxialMessage['type'];
	applied?: AxialSettingsPatch;
	snapshot?: AxialStateSnapshot;
};

export type AxialBridgeErrorCode =
	| 'malformed_message'
	| 'unsupported_version'
	| 'unsupported_command'
	| 'invalid_payload'
	| 'locked_setting'
	| 'internal_error';

export type AxialBridgeErrorPayload = {
	code: AxialBridgeErrorCode;
	message: string;
	requestId?: string;
	requestType?: string;
	details?: Record<string, string | number | boolean>;
};

type AxialToHostEnvelope<Type extends string, Payload> = {
	source: typeof AXIAL_BRIDGE_SOURCE;
	version: AxialBridgeVersion;
	id: string;
	type: Type;
	payload: Payload;
};

type HostToAxialEnvelope<Type extends string, Payload = undefined> = {
	source: typeof AXIAL_HOST_SOURCE;
	version: AxialBridgeVersion;
	id: string;
	type: Type;
} & (Payload extends undefined ? { payload?: never } : { payload: Payload });

export type AxialToHostMessage =
	| AxialToHostEnvelope<'axial:ready', AxialReadyPayload>
	| AxialToHostEnvelope<'axial:state', AxialStateSnapshot>
	| AxialToHostEnvelope<'axial:ack', AxialAckPayload>
	| AxialToHostEnvelope<'axial:error', AxialBridgeErrorPayload>;

export type HostToAxialMessage =
	| HostToAxialEnvelope<'axial:get-state'>
	| HostToAxialEnvelope<'axial:set-settings', AxialSettingsPatch>;

export const HOST_COMMAND_TYPES = ['axial:get-state', 'axial:set-settings'] as const;

export const BRIDGE_SETTING_KEYS = [
	'theme',
	'labelsVisible',
	'gridLayersVisible',
	'confirmDrop',
	'boardColor',
	'opponentMode',
	'aiDifficulty'
] as const satisfies readonly (keyof AxialSettingsPatch)[];
