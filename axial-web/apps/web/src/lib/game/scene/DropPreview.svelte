<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, NormalBlending } from 'three';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import type { BoardDimensions, Move } from '@axial/core';
	import { CELL_SPACING, cellPosition, PIECE_SIZE } from './geometry';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceShape } from '../state/pieceAppearance';

	let {
		move,
		height,
		pieceShape,
		color,
		kind = 'piece',
		locked = false,
		dimensions
	}: {
		move: Move;
		height: number;
		pieceShape: PieceShape;
		color: string;
		kind?: PlacementMode;
		locked?: boolean;
		dimensions: BoardDimensions;
	} = $props();

	const target = $derived(cellPosition(height, move.row, move.col, dimensions));
	const previewShape = $derived(kind === 'blocker' ? 'cube' : pieceShape);
	let pulse = $state(1);
	let lockPulse = $state(0);
	let phase = 0;

	const fillOpacity = $derived((kind === 'blocker' ? 0.22 : 0.16) + (locked ? 0.08 : 0));
	const floorPlateOpacity = $derived(locked ? 0.24 + lockPulse * 0.2 : 0.1 + lockPulse * 0.06);
	const boardHeight = $derived(dimensions.height * CELL_SPACING);
	const floorOffsetY = $derived(-boardHeight / 2 - target[1]);
	const floorPlateOffsetY = $derived(floorOffsetY + CELL_SPACING * 0.012);
	const floorPlateScale = $derived(1 + lockPulse * (locked ? 0.1 : 0.045));
	const beamBottom = $derived(-boardHeight / 2 + CELL_SPACING * 0.18);
	const beamTop = $derived(boardHeight / 2 + CELL_SPACING * 22);
	const beamHeight = $derived(beamTop - beamBottom);
	const beamCenterY = $derived((beamBottom + beamTop) / 2 - target[1]);

	useTask((delta) => {
		phase += delta * 4.2;
		const pulseWave = Math.sin(phase);

		pulse = 1 + pulseWave * 0.08;
		lockPulse = 0.5 + pulseWave * 0.5;
	});
</script>

<T.Group position={target}>
	{#if locked}
		<T.Mesh position={[0, beamCenterY, 0]} renderOrder={1}>
			<T.CylinderGeometry args={[PIECE_SIZE * 0.045, PIECE_SIZE * 0.18, beamHeight, 32, 1, true]} />
			<T.MeshBasicMaterial
				{color}
				transparent
				opacity={0.06 + lockPulse * 0.065}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}

	<T.Mesh
		position={[0, floorPlateOffsetY, 0]}
		rotation.x={-Math.PI / 2}
		scale={floorPlateScale}
		renderOrder={8}
	>
		<T.PlaneGeometry args={[CELL_SPACING * 0.9, CELL_SPACING * 0.9]} />
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={floorPlateOpacity}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	<T.Mesh scale={pulse * 0.98} renderOrder={9}>
		{#if previewShape === 'cube'}
			<T is={RoundedBoxGeometry} args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 4, 0.07]} />
		{:else if previewShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 28, 18]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.78, 1]} />
		{/if}
		<T.MeshBasicMaterial
			color="#020807"
			transparent
			opacity={locked ? 0.24 : 0.18}
			depthWrite={false}
			blending={NormalBlending}
		/>
	</T.Mesh>
	<T.Mesh scale={pulse} renderOrder={10}>
		{#if previewShape === 'cube'}
			<T is={RoundedBoxGeometry} args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 4, 0.07]} />
		{:else if previewShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 28, 18]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.78, 1]} />
		{/if}
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={fillOpacity}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>
	<T.Mesh scale={pulse * 1.02} renderOrder={11}>
		{#if previewShape === 'cube'}
			<T is={RoundedBoxGeometry} args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 4, 0.07]} />
		{:else if previewShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.59, 28, 18]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.79, 1]} />
		{/if}
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={0.11}
			depthWrite={false}
			wireframe
			blending={AdditiveBlending}
		/>
	</T.Mesh>
</T.Group>
