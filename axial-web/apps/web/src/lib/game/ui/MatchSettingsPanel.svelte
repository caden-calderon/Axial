<script lang="ts">
	import {
		MAX_BOARD_DIMENSIONS,
		MIN_BOARD_DIMENSIONS,
		type BoardDimensions,
		type MatchMode,
		type WinCondition
	} from '@axial/core';
	import { Bot, Boxes, CircleDot, Shield, Sparkles, Trophy, Users, Wifi } from '@lucide/svelte';
	import {
		AI_DIFFICULTY_OPTIONS,
		LINES_TO_WIN_OPTIONS,
		WIN_LINE_LENGTH_OPTIONS,
		type AiDifficulty,
		type BoardDimensionKey,
		type OpponentMode,
		type PlayMode
	} from '../state/gameController.svelte';

	let {
		playMode,
		aiDifficulty,
		matchMode,
		boardDimensions,
		winCondition,
		aiThinking,
		setupLocked,
		playModeLocked,
		onlineRulesLocked,
		onOpponentModeChange,
		onPlayModeChange,
		onAiDifficultyChange,
		onMatchModeChange,
		onBoardDimensionChange,
		onWinLineLengthChange,
		onLinesToWinChange
	}: {
		playMode: PlayMode;
		aiDifficulty: AiDifficulty;
		matchMode: MatchMode;
		boardDimensions: BoardDimensions;
		winCondition: WinCondition;
		aiThinking: boolean;
		setupLocked: boolean;
		playModeLocked: boolean;
		onlineRulesLocked: boolean;
		onOpponentModeChange: (mode: OpponentMode) => void;
		onPlayModeChange: (mode: PlayMode) => void;
		onAiDifficultyChange: (difficulty: AiDifficulty) => void;
		onMatchModeChange: (mode: MatchMode) => void;
		onBoardDimensionChange: (key: BoardDimensionKey, value: number) => void;
		onWinLineLengthChange: (lineLength: number) => void;
		onLinesToWinChange: (linesToWin: number) => void;
	} = $props();

	const dimensionControls: readonly {
		key: BoardDimensionKey;
		label: string;
		value: number;
	}[] = $derived([
		{ key: 'height', label: 'H', value: boardDimensions.height },
		{ key: 'rows', label: 'R', value: boardDimensions.rows },
		{ key: 'columns', label: 'C', value: boardDimensions.columns }
	]);

	function incrementDimension(key: BoardDimensionKey): void {
		const current = boardDimensions[key];
		const next = current >= MAX_BOARD_DIMENSIONS[key] ? MIN_BOARD_DIMENSIONS[key] : current + 1;
		onBoardDimensionChange(key, next);
	}

	function choosePlayMode(mode: PlayMode): void {
		onPlayModeChange(mode);
		if (mode === 'local' || mode === 'ai') onOpponentModeChange(mode);
	}
</script>

<section class="panel-section">
	<div class="section-heading">
		<Users size={15} strokeWidth={2} />
		<span>Match</span>
	</div>

	<div class="mode-switch play-mode-switch" role="group" aria-label="Opponent mode">
		<button
			type="button"
			class:selected={playMode === 'local'}
			aria-pressed={playMode === 'local'}
			disabled={playModeLocked}
			title={playModeLocked ? 'Start a new match to change opponent mode' : 'Local mode'}
			onclick={() => choosePlayMode('local')}
		>
			<Users size={14} strokeWidth={2} />
			<span>Local</span>
		</button>
		<button
			type="button"
			class:selected={playMode === 'ai'}
			class:thinking={aiThinking}
			aria-pressed={playMode === 'ai'}
			disabled={playModeLocked}
			title={playModeLocked ? 'Start a new match to change opponent mode' : 'AI mode'}
			onclick={() => choosePlayMode('ai')}
		>
			<Bot size={14} strokeWidth={2} />
			<span>AI</span>
		</button>
		<button
			type="button"
			class:selected={playMode === 'online'}
			aria-pressed={playMode === 'online'}
			disabled={playModeLocked}
			title={playModeLocked ? 'Start a new match to change opponent mode' : 'Online room'}
			onclick={() => choosePlayMode('online')}
		>
			<Wifi size={14} strokeWidth={2} />
			<span>Online</span>
		</button>
	</div>

	<div class="mode-switch rules-switch" role="group" aria-label="Match rules">
		<button
			type="button"
			class:selected={matchMode === 'classic'}
			aria-pressed={matchMode === 'classic'}
			disabled={setupLocked}
			title={setupLocked ? 'Start a new match to change rules' : 'Classic rules'}
			onclick={() => onMatchModeChange('classic')}
		>
			<Sparkles size={14} strokeWidth={2} />
			<span>Classic</span>
		</button>
		<button
			type="button"
			class:selected={matchMode === 'tactical'}
			aria-pressed={matchMode === 'tactical'}
			disabled={setupLocked || onlineRulesLocked}
			title={onlineRulesLocked
				? 'Online v1 uses Classic rules'
				: setupLocked
					? 'Start a new match to change rules'
					: 'Tactical rules'}
			onclick={() => onMatchModeChange('tactical')}
		>
			<Shield size={14} strokeWidth={2} />
			<span>Tactical</span>
		</button>
	</div>

	<div class="board-size-editor" class:locked={setupLocked}>
		<div class="board-size-label">
			<Boxes size={14} strokeWidth={2} />
			<span>Board</span>
		</div>
		<div class="dimension-buttons" role="group" aria-label="Board dimensions">
			{#each dimensionControls as dimension (dimension.key)}
				<button
					type="button"
					disabled={setupLocked}
					aria-label={`Increase board ${dimension.label} dimension`}
					title={setupLocked ? 'Start a new match to change board size' : 'Click to increase'}
					onclick={() => incrementDimension(dimension.key)}
				>
					<strong>{dimension.value}</strong>
					<small>{dimension.label}</small>
				</button>
				{#if dimension.key !== 'columns'}
					<span class="dimension-separator">x</span>
				{/if}
			{/each}
		</div>
	</div>

	<div class="rule-customizer" class:locked={setupLocked}>
		<div class="rule-control">
			<span>
				<CircleDot size={13} strokeWidth={2} />
				Connect
			</span>
			<div class="mode-switch connect-switch" role="group" aria-label="Connect length">
				{#each WIN_LINE_LENGTH_OPTIONS as option (option.value)}
					<button
						type="button"
						class:selected={winCondition.lineLength === option.value}
						aria-pressed={winCondition.lineLength === option.value}
						disabled={setupLocked}
						title={setupLocked ? 'Start a new match to change win rules' : option.label}
						onclick={() => onWinLineLengthChange(option.value)}
					>
						<span>{option.shortLabel}</span>
					</button>
				{/each}
			</div>
		</div>
		<div class="rule-control">
			<span>
				<Trophy size={13} strokeWidth={2} />
				Lines
			</span>
			<div class="mode-switch line-count-switch" role="group" aria-label="Lines to win">
				{#each LINES_TO_WIN_OPTIONS as option (option.value)}
					<button
						type="button"
						class:selected={winCondition.linesToWin === option.value}
						aria-pressed={winCondition.linesToWin === option.value}
						disabled={setupLocked}
						title={setupLocked ? 'Start a new match to change win rules' : option.label}
						onclick={() => onLinesToWinChange(option.value)}
					>
						<span>{option.shortLabel}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if playMode === 'ai'}
		<div class="control-label">
			<Bot size={13} strokeWidth={2} />
			<span>AI difficulty</span>
		</div>
		<div class="mode-switch difficulty-switch" role="group" aria-label="AI strength">
			{#each AI_DIFFICULTY_OPTIONS as option (option.value)}
				<button
					type="button"
					class:selected={aiDifficulty === option.value}
					aria-pressed={aiDifficulty === option.value}
					disabled={setupLocked}
					title={setupLocked ? 'Start a new match to change AI strength' : option.label}
					onclick={() => onAiDifficultyChange(option.value)}
				>
					<span>{option.shortLabel}</span>
				</button>
			{/each}
		</div>
	{/if}
</section>
