<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending } from 'three';
	import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
	import type { BoardDimensions, PlacedMove } from '@axial/core';
	import { pieceDropDuration, samplePieceDrop } from '../animation';
	import { CELL_SPACING, cellPosition, dropStartY, PIECE_SIZE } from './geometry';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';

	let {
		move,
		animate = false,
		delay = 0,
		onLand,
		onSettle,
		pieceShape,
		pieceColors,
		highlighted = false,
		dimensions
	}: {
		move: PlacedMove;
		animate?: boolean;
		delay?: number;
		onLand?: (move: PlacedMove) => void;
		onSettle?: (move: PlacedMove) => void;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
		highlighted?: boolean;
		dimensions: BoardDimensions;
	} = $props();

	const target = $derived(cellPosition(move.height, move.row, move.col, dimensions));
	const dropStart = $derived(dropStartY(dimensions));
	const dropDuration = $derived(pieceDropDuration(dimensions, move.height));
	const isBlocker = $derived(move.kind === 'blocker');
	const freshPlacement = untrack(() => animate);
	let landingEmitted = !freshPlacement;
	let settleEmitted = !freshPlacement;
	const shouldAnimate = untrack(() => animate && !prefersReducedMotion.current);
	let y = $state(shouldAnimate ? dropStartY(untrack(() => dimensions)) : untrack(() => target[1]));
	let scale = $state<[number, number, number]>([1, 1, 1]);
	let impact = $state(0);
	let opacity = $state(shouldAnimate ? 0 : 1);
	let fallGlow = $state(shouldAnimate ? 1 : 0);
	let settled = $state(!shouldAnimate);
	let highlightPhase = $state(0);
	const startsAt = performance.now() / 1000 + untrack(() => delay);
	let elapsed = -untrack(() => delay);

	const color = $derived(
		isBlocker ? '#5f726b' : move.player === 1 ? pieceColors.playerOne : pieceColors.playerTwo
	);
	const glow = $derived(isBlocker ? '#8fb9ad' : color);
	const renderShape = $derived(isBlocker ? 'cube' : pieceShape);
	const materialOpacity = $derived(isBlocker ? (settled ? 0.68 : 0.58) : settled ? 0.86 : 0.76);
	const glowOpacity = $derived(isBlocker ? (settled ? 0.1 : 0.16) : settled ? 0.2 : 0.28);
	const piecePosition = $derived([target[0], y, target[2]] as [number, number, number]);
	const boardHeight = $derived(dimensions.height * CELL_SPACING);
	const floorMarkerOffsetY = $derived(-boardHeight / 2 - y + CELL_SPACING * 0.012);
	const highlightPulse = $derived(highlighted ? 0.68 + Math.sin(highlightPhase) * 0.24 : 0);
	const highlightScale = $derived(1.18 + highlightPulse * 0.16);
	const highlightOpacity = $derived(opacity * (highlighted ? 0.16 + highlightPulse * 0.22 : 0));
	const highlightLight = $derived(highlighted ? 0.58 + highlightPulse * 0.52 : 0);

	$effect(() => {
		if (!prefersReducedMotion.current) return;
		if (!landingEmitted) {
			landingEmitted = true;
			onLand?.(move);
		}
		y = target[1];
		scale = [1, 1, 1];
		opacity = 1;
		fallGlow = 0;
		impact = 0;
		highlightPhase = 0;
		settled = true;
		if (!settleEmitted) {
			settleEmitted = true;
			onSettle?.(move);
		}
	});

	useTask(
		(delta) => {
			if (highlighted) highlightPhase += Math.min(delta, 0.1) * 2.2;
			if (settled) return;

			elapsed = performance.now() / 1000 - startsAt;
			if (!landingEmitted && elapsed >= dropDuration) {
				landingEmitted = true;
				onLand?.(move);
			}
			const sample = samplePieceDrop(elapsed, dropDuration);
			y = target[1] + (dropStart - target[1]) * sample.remaining + sample.rebound * CELL_SPACING;
			scale = [1 + sample.compression / 2, 1 - sample.compression, 1 + sample.compression / 2];
			opacity = Math.max(0, Math.min(1, elapsed / 0.06));
			fallGlow = sample.remaining;
			impact = sample.impact;
			settled = sample.settled;
			if (settled && !settleEmitted) {
				settleEmitted = true;
				onSettle?.(move);
			}
		},
		{ running: () => !settled || (highlighted && !prefersReducedMotion.current) }
	);
</script>

<T.Group name={`piece-${move.row}-${move.col}-${move.height}`} position={piecePosition} {scale}>
	{#if highlighted}
		<T.PointLight color={glow} intensity={highlightLight} distance={2.3} decay={2} />
	{/if}

	{#if !settled}
		<T.Mesh position={[0, PIECE_SIZE * 1.25, 0]}>
			<T.CylinderGeometry args={[PIECE_SIZE * 0.12, PIECE_SIZE * 0.2, PIECE_SIZE * 1.9, 18]} />
			<T.MeshBasicMaterial
				color={glow}
				transparent
				opacity={opacity * fallGlow * 0.18}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}
	{#if impact > 0.001}
		<T.Mesh
			position={[0, -PIECE_SIZE * 0.51, 0]}
			rotation.x={-Math.PI / 2}
			scale={1 + (1 - impact) * 0.8}
		>
			<T.RingGeometry args={[PIECE_SIZE * 0.48, PIECE_SIZE * 0.57, 32]} />
			<T.MeshBasicMaterial
				color={glow}
				transparent
				opacity={impact * 0.42}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}

	{#if highlighted}
		<T.Mesh scale={highlightScale}>
			{#if renderShape === 'cube'}
				<T
					is={RoundedBoxGeometry}
					args={[PIECE_SIZE * 1.02, PIECE_SIZE * 1.02, PIECE_SIZE * 1.02, 4, 0.085]}
				/>
			{:else}
				<T.SphereGeometry args={[PIECE_SIZE * 0.61, 32, 18]} />
			{/if}
			<T.MeshBasicMaterial
				color={glow}
				transparent
				opacity={highlightOpacity}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}

	<T.Mesh>
		{#if renderShape === 'cube'}
			<T is={RoundedBoxGeometry} args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 4, 0.07]} />
		{:else}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 36, 22]} />
		{/if}
		<T.MeshPhysicalMaterial
			{color}
			emissive={glow}
			emissiveIntensity={isBlocker ? (settled ? 0.08 : 0.2) : settled ? 0.18 : 0.4}
			roughness={isBlocker ? 0.24 : 0.08}
			metalness={isBlocker ? 0.12 : 0.06}
			clearcoat={isBlocker ? 0.72 : 1}
			clearcoatRoughness={isBlocker ? 0.18 : 0.035}
			ior={isBlocker ? 1.42 : 1.55}
			transmission={isBlocker ? 0.08 : 0.18}
			thickness={isBlocker ? 0.18 : 0.32}
			specularIntensity={1}
			transparent
			opacity={opacity * materialOpacity}
		/>
	</T.Mesh>

	<T.Mesh scale={0.58}>
		{#if renderShape === 'cube'}
			<T is={RoundedBoxGeometry} args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 2, 0.04]} />
		{:else}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 24, 16]} />
		{/if}
		<T.MeshBasicMaterial
			color={glow}
			transparent
			opacity={opacity * glowOpacity}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	<T.Mesh
		position={[-PIECE_SIZE * 0.13, PIECE_SIZE * 0.29, PIECE_SIZE * 0.24]}
		rotation={[-0.82, 0.12, -0.4]}
	>
		<T.PlaneGeometry args={[PIECE_SIZE * 0.46, PIECE_SIZE * 0.18]} />
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={opacity * 0.22}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	<T.Mesh position={[0, -PIECE_SIZE * 0.54, 0]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[PIECE_SIZE * 0.78, PIECE_SIZE * 0.78]} />
		<T.MeshBasicMaterial
			color={glow}
			transparent
			opacity={settled ? opacity * 0.1 : opacity * 0.035}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	{#if highlighted}
		<T.Mesh
			position={[0, floorMarkerOffsetY, 0]}
			rotation.x={-Math.PI / 2}
			scale={highlightScale}
			renderOrder={8}
		>
			<T.PlaneGeometry args={[CELL_SPACING * 0.88, CELL_SPACING * 0.88]} />
			<T.MeshBasicMaterial
				color={glow}
				transparent
				opacity={highlightOpacity * 0.62}
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}
</T.Group>
