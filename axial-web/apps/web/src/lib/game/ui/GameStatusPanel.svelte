<script lang="ts">
	import { onMount } from 'svelte';
	import { BOARD_COLUMNS, BOARD_HEIGHT, BOARD_ROWS, WIN_LENGTH, type Player } from '@axial/core';
	import {
		Bot,
		Box,
		Boxes,
		ChevronUp,
		Circle,
		CircleDot,
		Clock3,
		CopyPlus,
		Gem,
		Lock,
		Moon,
		Palette,
		Pipette,
		Redo2,
		RotateCcw,
		Shield,
		Sparkles,
		Sun,
		Trophy,
		Undo2,
		Users
	} from '@lucide/svelte';
	import type { MatchMode, TacticalSpecialId } from '@axial/core';
	import { PIECE_SHAPE_OPTIONS, type PieceColors, type PieceShape } from '../state/pieceAppearance';
	import type { OpponentMode, TacticalSpecialCounts } from '../state/gameController.svelte';
	import type { SessionRecord } from '../state/sessionRecord';
	import type { SceneThemeName, UiThemeName } from '../theming/sceneThemes';
	import SceneSelector from './SceneSelector.svelte';

	let {
		arenaLabel,
		statusTitle,
		moveCount,
		sceneTheme,
		uiTheme,
		labelsVisible,
		opponentMode,
		matchMode,
		aiThinking,
		pieceShape,
		pieceColors,
		setupLocked,
		appearanceLocked,
		activeSpecialCharges,
		activeSpecialCounts,
		specialLoadoutSlots,
		selectedSpecial,
		canUseBlockerCombo,
		canUseDoubleAdjacent,
		mustCompleteBlockerCombo,
		mustCompleteDoubleAdjacent,
		sessionRecord,
		moveError,
		canUndo,
		canRedo,
		onReset,
		onUndo,
		onRedo,
		onOpponentModeChange,
		onMatchModeChange,
		onToggleBlockerCombo,
		onToggleDoubleAdjacent,
		onPieceShapeChange,
		onPieceColorChange,
		onSceneThemeChange,
		onToggleLabels,
		onToggleTheme
	}: {
		arenaLabel: string;
		statusTitle: string;
		moveCount: number;
		sceneTheme: SceneThemeName;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		opponentMode: OpponentMode;
		matchMode: MatchMode;
		aiThinking: boolean;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		setupLocked: boolean;
		appearanceLocked: boolean;
		activeSpecialCharges: number;
		activeSpecialCounts: TacticalSpecialCounts;
		specialLoadoutSlots: number;
		selectedSpecial: TacticalSpecialId | null;
		canUseBlockerCombo: boolean;
		canUseDoubleAdjacent: boolean;
		mustCompleteBlockerCombo: boolean;
		mustCompleteDoubleAdjacent: boolean;
		sessionRecord: SessionRecord;
		moveError: string;
		canUndo: boolean;
		canRedo: boolean;
		onReset: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onOpponentModeChange: (mode: OpponentMode) => void;
		onMatchModeChange: (mode: MatchMode) => void;
		onToggleBlockerCombo: () => void;
		onToggleDoubleAdjacent: () => void;
		onPieceShapeChange: (shape: PieceShape) => void;
		onPieceColorChange: (player: Player, color: string) => void;
		onSceneThemeChange: (theme: SceneThemeName) => void;
		onToggleLabels: () => void;
		onToggleTheme: () => void;
	} = $props();

	let expanded = $state(true);
	let piecesMode = $state(false);
	const boardDimensions = `${BOARD_HEIGHT}x${BOARD_ROWS}x${BOARD_COLUMNS}`;
	const moveLabel = $derived(`${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`);
	const specialStatus = $derived(
		matchMode === 'tactical'
			? `${activeSpecialCharges}/${specialLoadoutSlots}`
			: `${specialLoadoutSlots}`
	);

	onMount(() => {
		expanded = window.innerWidth >= 720;
	});

	function colorValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement).value;
	}

	function togglePiecesMode(): void {
		if (matchMode !== 'tactical') return;
		piecesMode = !piecesMode;
	}
</script>

<section class="control-panel" class:collapsed={!expanded}>
	<div class="panel-toolbar" class:pieces-mode={piecesMode && matchMode === 'tactical'}>
		<button
			class="icon-button pieces-toggle"
			class:active={piecesMode && matchMode === 'tactical'}
			type="button"
			aria-label={piecesMode ? 'Show match controls' : 'Show pieces'}
			aria-pressed={piecesMode && matchMode === 'tactical'}
			title={matchMode === 'tactical' ? 'Pieces' : 'Switch to Tactical to use pieces'}
			disabled={matchMode !== 'tactical'}
			onclick={togglePiecesMode}
		>
			<Boxes size={18} strokeWidth={1.9} />
		</button>
		{#if piecesMode && matchMode === 'tactical'}
			<button
				class="toolbar-piece-button"
				class:armed={selectedSpecial === 'blocker-combo' || mustCompleteBlockerCombo}
				type="button"
				disabled={!canUseBlockerCombo && selectedSpecial !== 'blocker-combo'}
				aria-label="Use blocker"
				title={selectedSpecial === 'blocker-combo'
					? 'Cancel blocker placement'
					: mustCompleteBlockerCombo
						? 'Place your regular piece to finish the combo'
						: 'Place a blocker, then your regular piece'}
				onclick={onToggleBlockerCombo}
			>
				<Shield size={15} strokeWidth={2.1} />
				<span>Blocker</span>
				<small>{mustCompleteBlockerCombo ? '!' : activeSpecialCounts['blocker-combo']}</small>
			</button>
			<button
				class="toolbar-piece-button"
				class:armed={selectedSpecial === 'double-adjacent' || mustCompleteDoubleAdjacent}
				type="button"
				disabled={!canUseDoubleAdjacent && selectedSpecial !== 'double-adjacent'}
				aria-label="Use double adjacent"
				title={selectedSpecial === 'double-adjacent'
					? 'Cancel double placement'
					: mustCompleteDoubleAdjacent
						? 'Place the second piece next to the first'
						: 'Place two adjacent pieces in one turn'}
				onclick={onToggleDoubleAdjacent}
			>
				<CopyPlus size={15} strokeWidth={2.1} />
				<span>Double</span>
				<small>{mustCompleteDoubleAdjacent ? '!' : activeSpecialCounts['double-adjacent']}</small>
			</button>
		{:else}
			<button
				class="icon-button"
				type="button"
				aria-label="Undo move"
				title="Undo move"
				disabled={!canUndo}
				onclick={onUndo}
			>
				<Undo2 size={18} strokeWidth={1.9} />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label="Redo move"
				title="Redo move"
				disabled={!canRedo}
				onclick={onRedo}
			>
				<Redo2 size={18} strokeWidth={1.9} />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label="Reset game"
				title="Reset game"
				onclick={onReset}
			>
				<RotateCcw size={18} strokeWidth={1.9} />
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label={uiTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				title={uiTheme === 'dark' ? 'Light mode' : 'Dark mode'}
				onclick={onToggleTheme}
			>
				{#if uiTheme === 'dark'}
					<Sun size={18} strokeWidth={1.9} />
				{:else}
					<Moon size={18} strokeWidth={1.9} />
				{/if}
			</button>
		{/if}
		<button
			class="icon-button collapse-button"
			type="button"
			aria-label={expanded
				? 'Collapse settings'
				: piecesMode
					? 'Expand piece details'
					: 'Expand settings'}
			aria-expanded={expanded}
			title={expanded ? 'Collapse' : piecesMode ? 'Piece details' : 'Expand'}
			onclick={() => (expanded = !expanded)}
		>
			<ChevronUp size={18} strokeWidth={1.9} />
		</button>
	</div>

	<div class="panel-body-shell" aria-hidden={!expanded} inert={!expanded}>
		<div class="panel-body-clip">
			<div class="panel-body">
				{#if piecesMode && matchMode === 'tactical'}
					<div class="live-strip" aria-live="polite">
						<div>
							<span>Pieces</span>
							<strong>{statusTitle}</strong>
						</div>
						<small>{specialStatus}</small>
					</div>

					<section class="panel-section piece-info-section">
						<div class="section-heading">
							<Boxes size={15} strokeWidth={2} />
							<span>Loadout</span>
						</div>

						<div class="piece-info-list">
							<button
								type="button"
								class:armed={selectedSpecial === 'blocker-combo' || mustCompleteBlockerCombo}
								disabled={!canUseBlockerCombo && selectedSpecial !== 'blocker-combo'}
								onclick={onToggleBlockerCombo}
							>
								<span class="piece-info-icon"><Shield size={16} strokeWidth={2.1} /></span>
								<span>
									<strong>Blocker</strong>
									<small>Place a neutral blocker, then your regular piece.</small>
								</span>
								<em>{mustCompleteBlockerCombo ? '!' : activeSpecialCounts['blocker-combo']}</em>
							</button>
							<button
								type="button"
								class:armed={selectedSpecial === 'double-adjacent' || mustCompleteDoubleAdjacent}
								disabled={!canUseDoubleAdjacent && selectedSpecial !== 'double-adjacent'}
								onclick={onToggleDoubleAdjacent}
							>
								<span class="piece-info-icon"><CopyPlus size={16} strokeWidth={2.1} /></span>
								<span>
									<strong>Double Adjacent</strong>
									<small>Place a second owned piece next to the first.</small>
								</span>
								<em>{mustCompleteDoubleAdjacent ? '!' : activeSpecialCounts['double-adjacent']}</em>
							</button>
						</div>
					</section>
				{:else}
					<div class="live-strip" aria-live="polite">
						<div>
							<span>Now</span>
							<strong>{statusTitle}</strong>
						</div>
						<small>{moveLabel}</small>
					</div>

					<section class="panel-section">
						<div class="section-heading">
							<Users size={15} strokeWidth={2} />
							<span>Match</span>
						</div>

						<div class="mode-switch" role="group" aria-label="Opponent mode">
							<button
								type="button"
								class:selected={opponentMode === 'local'}
								aria-pressed={opponentMode === 'local'}
								disabled={setupLocked}
								title={setupLocked ? 'Start a new match to change opponent mode' : 'Local mode'}
								onclick={() => onOpponentModeChange('local')}
							>
								<Users size={14} strokeWidth={2} />
								<span>Local</span>
							</button>
							<button
								type="button"
								class:selected={opponentMode === 'ai'}
								class:thinking={aiThinking}
								aria-pressed={opponentMode === 'ai'}
								disabled={setupLocked}
								title={setupLocked ? 'Start a new match to change opponent mode' : 'AI mode'}
								onclick={() => onOpponentModeChange('ai')}
							>
								<Bot size={14} strokeWidth={2} />
								<span>AI</span>
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
								disabled={setupLocked}
								title={setupLocked ? 'Start a new match to change rules' : 'Tactical rules'}
								onclick={() => onMatchModeChange('tactical')}
							>
								<Shield size={14} strokeWidth={2} />
								<span>Tactical</span>
							</button>
						</div>

						<div class="setup-grid">
							<div class="setup-stat">
								<Boxes size={14} strokeWidth={2} />
								<span>{boardDimensions}</span>
								<small>Board</small>
							</div>
							<div class="setup-stat">
								<CircleDot size={14} strokeWidth={2} />
								<span>{WIN_LENGTH}</span>
								<small>Connect</small>
							</div>
							<div class="setup-stat">
								<Clock3 size={14} strokeWidth={2} />
								<span>Off</span>
								<small>Clock</small>
							</div>
							<div class="setup-stat">
								<Shield size={14} strokeWidth={2} />
								<span>{specialStatus}</span>
								<small>Special</small>
							</div>
						</div>
					</section>

					<section class="panel-section">
						<div class="section-heading">
							<Palette size={15} strokeWidth={2} />
							<span>Appearance</span>
							{#if appearanceLocked}
								<span
									class="lock-indicator"
									aria-label="Piece appearance locked until a new match"
									title="Start a new match to edit pieces"
								>
									<Lock size={12} strokeWidth={2.2} />
								</span>
							{/if}
						</div>

						<SceneSelector value={sceneTheme} onChange={onSceneThemeChange} />

						<div class="piece-customizer" class:locked={appearanceLocked}>
							<div class="shape-switch" role="group" aria-label="Piece shape">
								{#each PIECE_SHAPE_OPTIONS as option (option.value)}
									<button
										type="button"
										class:selected={pieceShape === option.value}
										aria-pressed={pieceShape === option.value}
										disabled={appearanceLocked}
										title={appearanceLocked
											? 'Start a new match to edit pieces'
											: `${option.label} pieces`}
										onclick={() => onPieceShapeChange(option.value)}
									>
										{#if option.value === 'cube'}
											<Box size={14} strokeWidth={2} />
										{:else if option.value === 'orb'}
											<Circle size={14} strokeWidth={2} />
										{:else}
											<Gem size={14} strokeWidth={2} />
										{/if}
										<span>{option.label}</span>
									</button>
								{/each}
							</div>

							<div class="piece-color-grid">
								<label
									class="piece-color"
									class:locked={appearanceLocked}
									style={`--piece-color: ${pieceColors.playerOne}`}
									title={appearanceLocked
										? 'Start a new match to edit pieces'
										: 'Player 1 piece color'}
								>
									<span class="color-dot"></span>
									<span>P1</span>
									<Pipette size={12} strokeWidth={2.1} />
									<input
										type="color"
										value={pieceColors.playerOne}
										aria-label="Player 1 piece color"
										disabled={appearanceLocked}
										oninput={(event) => onPieceColorChange(1, colorValue(event))}
									/>
								</label>
								<label
									class="piece-color"
									class:locked={appearanceLocked}
									style={`--piece-color: ${pieceColors.playerTwo}`}
									title={appearanceLocked
										? 'Start a new match to edit pieces'
										: 'Player 2 piece color'}
								>
									<span class="color-dot"></span>
									<span>P2</span>
									<Pipette size={12} strokeWidth={2.1} />
									<input
										type="color"
										value={pieceColors.playerTwo}
										aria-label="Player 2 piece color"
										disabled={appearanceLocked}
										oninput={(event) => onPieceColorChange(2, colorValue(event))}
									/>
								</label>
							</div>
						</div>

						<div class="mode-switch two-tone" role="group" aria-label="Interface theme">
							<button
								type="button"
								class:selected={uiTheme === 'dark'}
								aria-pressed={uiTheme === 'dark'}
								onclick={() => uiTheme !== 'dark' && onToggleTheme()}
							>
								<Moon size={14} strokeWidth={2} />
								<span>Dark</span>
							</button>
							<button
								type="button"
								class:selected={uiTheme === 'light'}
								aria-pressed={uiTheme === 'light'}
								onclick={() => uiTheme !== 'light' && onToggleTheme()}
							>
								<Sun size={14} strokeWidth={2} />
								<span>Light</span>
							</button>
						</div>

						<label class="toggle-row">
							<span>Axis numbers</span>
							<input
								type="checkbox"
								checked={labelsVisible}
								aria-label="Toggle axis numbers"
								onchange={() => onToggleLabels()}
							/>
						</label>
					</section>

					<section class="panel-section session-section">
						<div class="section-heading">
							<Trophy size={15} strokeWidth={2} />
							<span>Session</span>
						</div>

						<div class="record-grid">
							<div>
								<strong>{sessionRecord.playerOneWins}</strong>
								<span>{opponentMode === 'ai' ? 'You' : 'P1'}</span>
							</div>
							<div>
								<strong>{sessionRecord.playerTwoWins}</strong>
								<span>{opponentMode === 'ai' ? 'AI' : 'P2'}</span>
							</div>
							<div>
								<strong>{sessionRecord.draws}</strong>
								<span>Draw</span>
							</div>
						</div>

						<div class="session-foot">
							<span>{arenaLabel}</span>
							<span>{sceneTheme}</span>
						</div>
					</section>
				{/if}

				{#if moveError}
					<p class="move-error">{moveError}</p>
				{/if}
			</div>
		</div>
	</div>
</section>
