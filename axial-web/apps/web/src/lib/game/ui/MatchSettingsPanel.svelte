<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		MAX_BOARD_DIMENSIONS,
		MIN_BOARD_DIMENSIONS,
		type BoardDimensions,
		type GameSnapshot,
		type MatchMode,
		type WinCondition
	} from '@axial/core';
	import { Bot, Boxes, CircleDot, Shield, Sparkles, Trophy, Users, Wifi } from '@lucide/svelte';
	import MatchLineProgress from './MatchLineProgress.svelte';
	import type { PieceColors } from '../state/pieceAppearance';
	import {
		AI_DIFFICULTY_OPTIONS,
		LINES_TO_WIN_OPTIONS,
		WIN_LINE_LENGTH_OPTIONS,
		type AiDifficulty,
		type BoardDimensionKey,
		type PlayMode
	} from '../state/gameController.svelte';

	let {
		game,
		pieceColors,
		playMode,
		aiDifficulty,
		matchMode,
		boardDimensions,
		winCondition,
		aiThinking,
		setupLocked,
		playModeLocked,
		onlineControls,
		onPlayModeChange,
		onAiDifficultyChange,
		onMatchModeChange,
		onBoardDimensionChange,
		onWinLineLengthChange,
		onLinesToWinChange
	}: {
		game: GameSnapshot;
		pieceColors: PieceColors;
		playMode: PlayMode;
		aiDifficulty: AiDifficulty;
		matchMode: MatchMode;
		boardDimensions: BoardDimensions;
		winCondition: WinCondition;
		aiThinking: boolean;
		setupLocked: boolean;
		playModeLocked: boolean;
		onlineControls: Snippet;
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
	}

	const playModeLockTitle = $derived(
		playMode === 'online'
			? 'Leave the room to change play mode'
			: 'Start a new match to change opponent mode'
	);
	const aiDifficultyLabel = $derived(
		AI_DIFFICULTY_OPTIONS.find((option) => option.value === aiDifficulty)?.label ?? aiDifficulty
	);
	const playModeLabel = $derived(
		playMode === 'local'
			? 'Local match'
			: playMode === 'ai'
				? matchMode === 'classic'
					? `AI · ${aiDifficultyLabel}`
					: 'AI · Tactical baseline'
				: 'Online room'
	);
	const rulesLabel = $derived(
		`${matchMode === 'tactical' ? 'Tactical' : 'Classic'} · ${boardDimensions.height} × ${boardDimensions.rows} × ${boardDimensions.columns}`
	);
	const winLabel = $derived(
		`Connect ${winCondition.lineLength} · ${winCondition.linesToWin} ${winCondition.linesToWin === 1 ? 'line' : 'lines'} to win`
	);
</script>

<section class="panel-section" data-tour-target="match-section">
	<div class="section-heading">
		<Users size={15} strokeWidth={2} />
		<span>Match</span>
	</div>

	{#if setupLocked}
		<div class="locked-match-summary" data-tour-target="rules">
			<div class="locked-match-icon"><Boxes size={16} strokeWidth={2} /></div>
			<div>
				<strong>{playModeLabel}</strong>
				<span>{rulesLabel}</span>
				<small>{winLabel}</small>
			</div>
			<span class="locked-match-badge">{game.status.state === 'playing' ? 'Live' : 'Final'}</span>
		</div>
		{#if playMode === 'online'}
			{@render onlineControls()}
		{/if}
	{:else}
		<div
			class="mode-switch play-mode-switch"
			role="group"
			aria-label="Opponent mode"
			data-tour-target="play-mode"
		>
			<button
				type="button"
				class:selected={playMode === 'local'}
				aria-pressed={playMode === 'local'}
				disabled={playModeLocked}
				data-tooltip={playModeLocked ? playModeLockTitle : 'Local mode'}
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
				data-tooltip={playModeLocked ? playModeLockTitle : 'AI mode'}
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
				data-tour-target="online-mode"
				data-tooltip={playModeLocked ? playModeLockTitle : 'Online room'}
				onclick={() => choosePlayMode('online')}
			>
				<Wifi size={14} strokeWidth={2} />
				<span>Online</span>
			</button>
		</div>

		{#if playMode === 'online'}
			{@render onlineControls()}
		{/if}

		<div class="mode-switch rules-switch" role="group" aria-label="Match rules">
			<button
				type="button"
				class:selected={matchMode === 'classic'}
				aria-pressed={matchMode === 'classic'}
				disabled={setupLocked}
				data-tooltip={setupLocked ? 'Start a new match to change rules' : 'Classic rules'}
				onclick={() => onMatchModeChange('classic')}
			>
				<Sparkles size={14} strokeWidth={2} />
				<span>Classic</span>
			</button>
			<button
				type="button"
				class="coming-soon-option"
				class:selected={matchMode === 'tactical'}
				aria-pressed={matchMode === 'tactical'}
				aria-label="Tactical mode — coming soon"
				disabled
				data-tooltip="Tactical mode is coming soon"
			>
				<Shield size={14} strokeWidth={2} />
				<span>Tactical</span>
				<small aria-hidden="true">Coming soon</small>
			</button>
		</div>

		<div class="setup-rules-cluster" data-tour-target="rules">
			<div class="board-size-editor" class:locked={setupLocked} data-tour-target="board-size">
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
							data-tooltip={setupLocked
								? 'Start a new match to change board size'
								: 'Click to increase'}
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
								data-tooltip={setupLocked ? 'Start a new match to change win rules' : option.label}
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
								data-tooltip={setupLocked ? 'Start a new match to change win rules' : option.label}
								onclick={() => onLinesToWinChange(option.value)}
							>
								<span>{option.shortLabel}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		{#if playMode === 'ai' && matchMode === 'classic'}
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
						data-tooltip={setupLocked ? 'Start a new match to change AI strength' : option.label}
						onclick={() => onAiDifficultyChange(option.value)}
					>
						<span>{option.shortLabel}</span>
					</button>
				{/each}
			</div>
		{:else if playMode === 'ai'}
			<p class="ai-baseline-note">
				Tactical is coming soon. Switch to Classic to use the active AI opponent.
			</p>
		{/if}
	{/if}
	<MatchLineProgress
		{game}
		{pieceColors}
		playerNames={playMode === 'ai' ? { 1: 'You', 2: 'AI' } : { 1: 'P1', 2: 'P2' }}
	/>
</section>
