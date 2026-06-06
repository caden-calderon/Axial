<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RoundedBoxGeometry } from '@threlte/extras';
	import { AdditiveBlending } from 'three';
	import type { PlacedMove } from '@axial/core';
	import { cellPosition, DROP_START_Y, PIECE_SIZE } from './geometry';
	import type { PieceColors, PieceShape } from '../state/pieceAppearance';

	let {
		move,
		moveIndex,
		pieceShape,
		pieceColors
	}: {
		move: PlacedMove;
		moveIndex: number;
		pieceShape: PieceShape;
		pieceColors: PieceColors;
	} = $props();

	const target = $derived(cellPosition(move.height, move.row, move.col));
	const dropDuration = $derived(createDropDuration(move, moveIndex));
	const isBlocker = $derived(move.kind === 'blocker');
	let y = $state(DROP_START_Y);
	let scale = $state(0.94);
	let opacity = $state(0);
	let fallGlow = $state(1);
	let settled = $state(false);
	let elapsed = 0;

	const color = $derived(
		isBlocker ? '#5f726b' : move.player === 1 ? pieceColors.playerOne : pieceColors.playerTwo
	);
	const glow = $derived(isBlocker ? '#8fb9ad' : color);
	const renderShape = $derived(isBlocker ? 'cube' : pieceShape);
	const materialOpacity = $derived(isBlocker ? (settled ? 0.68 : 0.58) : settled ? 0.86 : 0.76);
	const glowOpacity = $derived(isBlocker ? (settled ? 0.1 : 0.16) : settled ? 0.2 : 0.28);
	const piecePosition = $derived([target[0], y, target[2]] as [number, number, number]);

	useTask((delta) => {
		if (settled) return;

		elapsed += Math.min(delta, 0.04);
		const progress = Math.min(elapsed / dropDuration, 1);
		const eased = easeOutQuint(progress);

		y = target[1] + (DROP_START_Y - target[1]) * (1 - eased);
		scale = 0.94 + easeOutCubic(Math.min(progress * 3.8, 1)) * 0.06;
		opacity = easeOutCubic(clamp((progress - 0.04) / 0.18, 0, 1));
		fallGlow = Math.pow(1 - progress, 1.35);

		if (progress >= 1) {
			y = target[1];
			scale = 1;
			opacity = 1;
			fallGlow = 0;
			settled = true;
		}
	});

	function createDropDuration(move: PlacedMove, index: number): number {
		const seed = (index + 1) * 37 + move.row * 101 + move.col * 211 + move.height * 17;
		return randomRange(seed, 2, 0.58, 0.74);
	}

	function randomRange(seed: number, salt: number, min: number, max: number): number {
		return min + hash01(seed + salt * 97.13) * (max - min);
	}

	function hash01(value: number): number {
		return fract(Math.sin(value * 12.9898) * 43758.5453);
	}

	function fract(value: number): number {
		return value - Math.floor(value);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function easeOutCubic(value: number): number {
		return 1 - Math.pow(1 - value, 3);
	}

	function easeOutQuint(value: number): number {
		return 1 - Math.pow(1 - value, 5);
	}
</script>

<T.Group position={piecePosition} {scale}>
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

	<T.Mesh>
		{#if renderShape === 'cube'}
			<RoundedBoxGeometry
				args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE]}
				radius={0.07}
				smoothness={4}
			/>
		{:else if renderShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 36, 22]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.78, 1]} />
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
			<RoundedBoxGeometry
				args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE]}
				radius={0.04}
				smoothness={2}
			/>
		{:else if renderShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.58, 24, 16]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.8, 0]} />
		{/if}
		<T.MeshBasicMaterial
			color={glow}
			transparent
			opacity={opacity * glowOpacity}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	<T.Mesh>
		{#if renderShape === 'cube'}
			<RoundedBoxGeometry
				args={[PIECE_SIZE * 1.012, PIECE_SIZE * 1.012, PIECE_SIZE * 1.012]}
				radius={0.075}
				smoothness={4}
			/>
		{:else if renderShape === 'orb'}
			<T.SphereGeometry args={[PIECE_SIZE * 0.59, 28, 16]} />
		{:else}
			<T.OctahedronGeometry args={[PIECE_SIZE * 0.79, 1]} />
		{/if}
		<T.MeshBasicMaterial
			color="#ffffff"
			transparent
			opacity={opacity * 0.12}
			depthWrite={false}
			wireframe
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
</T.Group>
