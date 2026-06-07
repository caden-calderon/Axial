<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending } from 'three';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import type { BoardDimensions, Move } from '@axial/core';
	import { cellPosition, PIECE_SIZE } from './geometry';
	import type { PlacementMode } from '../state/gameController.svelte';
	import type { PieceShape } from '../state/pieceAppearance';

	let {
		move,
		height,
		pieceShape,
		color,
		kind = 'piece',
		dimensions
	}: {
		move: Move;
		height: number;
		pieceShape: PieceShape;
		color: string;
		kind?: PlacementMode;
		dimensions: BoardDimensions;
	} = $props();

	const target = $derived(cellPosition(height, move.row, move.col, dimensions));
	const previewShape = $derived(kind === 'blocker' ? 'cube' : pieceShape);
	const fillOpacity = $derived(kind === 'blocker' ? 0.22 : 0.16);
	const ringOpacity = $derived(kind === 'blocker' ? 0.68 : 0.56);
	let pulse = $state(1);
	let phase = 0;

	useTask((delta) => {
		phase += delta * 4.2;
		pulse = 1 + Math.sin(phase) * 0.08;
	});
</script>

<T.Group position={target}>
	<T.Mesh scale={pulse}>
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
	<T.Mesh scale={pulse * 1.02}>
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
	<T.Mesh scale={[pulse * 1.22, 0.035, pulse * 1.22]}>
		<T.TorusGeometry args={[PIECE_SIZE * 0.52, 0.015, 10, 64]} />
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={ringOpacity}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>
</T.Group>
