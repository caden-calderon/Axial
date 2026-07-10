<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import { Color, Fog } from 'three';
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
	import CompletedLineMarker from './CompletedLineMarker.svelte';
	import OrbitCameraControls from './OrbitCameraControls.svelte';
	import { type Vec3 } from './geometry';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';
	import { resolveScenePalette, type UiThemeName } from '../theming/sceneThemes';
	import { resolveCameraFit } from './cameraFit';

	let {
		game,
		hoveredMove,
		previewLocked,
		labelsVisible,
		gridLayersVisible,
		uiTheme,
		boardColor,
		pieceShape,
		pieceColors,
		placementMode,
		doubleAdjacentAnchor,
		controlsExpanded,
		viewResetKey,
		onHover,
		onPlay
	}: {
		game: GameSnapshot;
		hoveredMove: Move | null;
		previewLocked: boolean;
		labelsVisible: boolean;
		gridLayersVisible: boolean;
		uiTheme: UiThemeName;
		boardColor: string;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		placementMode: PlacementMode;
		doubleAdjacentAnchor: PlacedMove | null;
		controlsExpanded: boolean;
		viewResetKey: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
	} = $props();

	const palette = $derived(resolveScenePalette(uiTheme, boardColor));
	const dimensions = $derived(game.dimensions);
	const dimensionKey = $derived(`${dimensions.height}:${dimensions.rows}:${dimensions.columns}`);
	const gridKey = $derived(`${dimensionKey}:${gridLayersVisible ? 'full' : 'floor'}`);
	const previewColor = $derived(
		placementMode === 'blocker'
			? '#60756f'
			: game.currentPlayer === 1
				? pieceColors.playerOne
				: pieceColors.playerTwo
	);
	const previewHeight = $derived(
		hoveredMove && isMovePlayable(hoveredMove)
			? getDropHeight(game.board, hoveredMove, dimensions)
			: -1
	);
	let viewportWidth = $state(1280);
	let viewportHeight = $state(800);
	let coarsePointer = $state(false);
	const cameraFit = $derived(
		resolveCameraFit(
			{ width: viewportWidth, height: viewportHeight, coarsePointer, controlsExpanded },
			dimensions
		)
	);
	const isCompact = $derived(cameraFit.compact);
	const cameraPosition: Vec3 = $derived(cameraFit.position);
	const cameraFov = $derived(cameraFit.fov);
	const boardScale = $derived(cameraFit.boardScale);
	const lastMoveIndex = $derived(game.moveHistory.length - 1);

	const boardRotation = -0.34;
	const { scene } = useThrelte();
	const sceneBackground = new Color();
	const sceneFog = new Fog('#000000', 10, 21);

	$effect(() => {
		sceneBackground.set(palette.background);
		sceneFog.color.set(palette.fog);
		scene.background = sceneBackground;
		scene.fog = sceneFog;
	});

	onMount(() => {
		const updateViewport = () => {
			viewportWidth = window.innerWidth;
			viewportHeight = window.innerHeight;
			coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
		};

		updateViewport();
		window.addEventListener('resize', updateViewport);

		return () => window.removeEventListener('resize', updateViewport);
	});

	onDestroy(() => {
		if (scene.background === sceneBackground) scene.background = null;
		if (scene.fog === sceneFog) scene.fog = null;
	});

	function isMovePlayable(move: Move): boolean {
		return (
			placementMode !== 'double-adjacent' ||
			(doubleAdjacentAnchor !== null &&
				isLegalDoubleAdjacentMove(game.board, move, doubleAdjacentAnchor, dimensions))
		);
	}
</script>

{#key viewResetKey}
	<T.PerspectiveCamera makeDefault position={cameraPosition} fov={cameraFov}>
		<OrbitCameraControls
			enableDamping
			dampingFactor={0.075}
			enablePan={false}
			rotateSpeed={0.52}
			zoomSpeed={0.58}
			minDistance={cameraFit.minDistance}
			maxDistance={cameraFit.maxDistance}
			target={cameraFit.target}
			maxPolarAngle={Math.PI * 0.72}
		/>
	</T.PerspectiveCamera>
{/key}

<ColumnPicker {game} {boardRotation} {boardScale} {onHover} {onPlay} {isMovePlayable} />

<T.AmbientLight intensity={uiTheme === 'dark' ? 0.62 : 0.92} />
<T.HemisphereLight
	color={palette.grid}
	groundColor={palette.background}
	intensity={uiTheme === 'dark' ? 1.55 : 1.2}
/>
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
	{#key gridKey}
		<BoardGrid {palette} {uiTheme} {dimensions} layersVisible={gridLayersVisible} />
	{/key}

	{#key dimensionKey}
		<BoardLabels
			visible={labelsVisible}
			{palette}
			{uiTheme}
			{boardRotation}
			{dimensions}
			compact={isCompact}
		/>
	{/key}

	{#if hoveredMove && previewHeight >= 0 && game.status.state === 'playing'}
		<DropPreview
			move={hoveredMove}
			height={previewHeight}
			{pieceShape}
			color={previewColor}
			kind={placementMode}
			locked={previewLocked}
			{dimensions}
		/>
	{/if}

	{#each game.moveHistory as move, index (`${index}-${move.row}-${move.col}-${move.height}`)}
		<GamePiece
			{move}
			moveIndex={index}
			{pieceShape}
			{pieceColors}
			highlighted={index === lastMoveIndex}
			{dimensions}
		/>
	{/each}

	{#each game.completedLines as line (line.id)}
		<CompletedLineMarker {line} {pieceColors} {dimensions} />
	{/each}
</T.Group>
