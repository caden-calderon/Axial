<script lang="ts">
	import { onMount } from 'svelte';
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import {
		getDropHeight,
		isLegalDoubleAdjacentMove,
		type GameSnapshot,
		type Move,
		type PlacedMove
	} from '@axial/core';
	import GamePiece from './GamePiece.svelte';
	import DropPreview from './DropPreview.svelte';
	import BoardGrid from './BoardGrid.svelte';
	import BoardLabels from './BoardLabels.svelte';
	import ColumnPicker from './ColumnPicker.svelte';
	import { type Vec3 } from './geometry';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import { SCENE_THEMES, type SceneThemeName, type UiThemeName } from '../theming/sceneThemes';

	let {
		game,
		hoveredMove,
		labelsVisible,
		uiTheme,
		sceneTheme,
		pieceShape,
		pieceColors,
		placementMode,
		doubleAdjacentAnchor,
		onHover,
		onPlay
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		labelsVisible: boolean;
		uiTheme: UiThemeName;
		sceneTheme: SceneThemeName;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		placementMode: PlacementMode;
		doubleAdjacentAnchor: PlacedMove | null;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
	} = $props();

	const palette = $derived(SCENE_THEMES[sceneTheme][uiTheme]);
	const previewColor = $derived(
		placementMode === 'blocker'
			? '#60756f'
			: game.currentPlayer === 1
				? pieceColors.playerOne
				: pieceColors.playerTwo
	);
	const previewHeight = $derived(
		hoveredMove && isMovePlayable(hoveredMove) ? getDropHeight(game.board, hoveredMove) : -1
	);
	let isCompact = $state(false);
	const cameraPosition: Vec3 = $derived(isCompact ? [8.8, 8.4, 18] : [5.8, 5.7, 9.4]);
	const cameraFov = $derived(isCompact ? 46 : 42);
	const boardScale = $derived(isCompact ? 0.62 : 0.88);

	const boardRotation = -0.34;

	onMount(() => {
		const updateViewport = () => {
			isCompact = window.innerWidth < 720;
		};

		updateViewport();
		window.addEventListener('resize', updateViewport);

		return () => window.removeEventListener('resize', updateViewport);
	});

	function isMovePlayable(move: Move): boolean {
		return (
			placementMode !== 'double-adjacent' ||
			(doubleAdjacentAnchor !== null &&
				isLegalDoubleAdjacentMove(game.board, move, doubleAdjacentAnchor))
		);
	}
</script>

<T.Color attach="background" args={[palette.background]} />
<T.Fog attach="fog" args={[palette.fog, 10, 21]} />

<T.PerspectiveCamera makeDefault position={cameraPosition} fov={cameraFov}>
	<OrbitControls
		enableDamping
		dampingFactor={0.075}
		enablePan={false}
		rotateSpeed={0.52}
		zoomSpeed={0.58}
		minDistance={7.2}
		maxDistance={15.5}
		target={[0, 0, 0]}
		maxPolarAngle={Math.PI * 0.72}
	/>
</T.PerspectiveCamera>

<ColumnPicker {game} {boardRotation} {boardScale} {onHover} {onPlay} {isMovePlayable} />

<T.AmbientLight intensity={uiTheme === 'dark' ? 0.62 : 0.92} />
<T.HemisphereLight args={[palette.grid, palette.background, uiTheme === 'dark' ? 1.55 : 1.2]} />
<T.DirectionalLight position={[4, 7, 5]} intensity={uiTheme === 'dark' ? 2.6 : 1.9} />
<T.PointLight
	position={[-3.5, 3.4, -4.5]}
	intensity={uiTheme === 'dark' ? 28 : 11}
	color={palette.playerOneGlow}
/>
<T.PointLight
	position={[4.2, -0.6, 3.8]}
	intensity={uiTheme === 'dark' ? 22 : 8}
	color={palette.playerTwoGlow}
/>

<T.Group rotation.y={boardRotation} scale={boardScale}>
	<BoardGrid {palette} {uiTheme} />

	{#if labelsVisible}
		<BoardLabels {palette} {uiTheme} {boardRotation} />
	{/if}

	{#if hoveredMove && previewHeight >= 0 && game.status.state === 'playing'}
		<DropPreview
			move={hoveredMove}
			height={previewHeight}
			{pieceShape}
			color={previewColor}
			kind={placementMode}
		/>
	{/if}

	{#each game.moveHistory as move, index (`${index}-${move.row}-${move.col}-${move.height}`)}
		<GamePiece {move} moveIndex={index} {pieceShape} {pieceColors} />
	{/each}
</T.Group>
