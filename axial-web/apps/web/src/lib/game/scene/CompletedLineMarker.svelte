<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { AdditiveBlending, Quaternion, Vector3 } from 'three';
	import { cellFromIndex, type CompletedLine } from '@axial/core';
	import { cellPosition, PIECE_SIZE, type Vec3 } from './geometry';
	import type { PieceColors } from '../state/pieceAppearance';

	let {
		line,
		pieceColors
	}: {
		line: CompletedLine;
		pieceColors: PieceColors;
	} = $props();

	const cells = $derived(line.cells.map(cellCenter));
	const color = $derived(line.player === 1 ? pieceColors.playerOne : pieceColors.playerTwo);
	const start = $derived(extendedEndpoint(cells, -1));
	const end = $derived(extendedEndpoint(cells, 1));
	const delta = $derived(vectorDelta(start, end));
	const length = $derived(Math.max(0.001, vectorLength(delta)));
	const direction = $derived(normalize(delta));
	const quaternion = $derived(rotationFromY(direction));
	const idlePhaseOffset = $derived(hashPhase(line.id));

	let elapsed = $state(0);
	const drawDuration = 1.35;
	const settleDuration = 0.45;
	const progress = $derived(Math.min(elapsed / drawDuration, 1));
	const easedProgress = $derived(easeInOutCubic(progress));
	const settleProgress = $derived(
		Math.min(Math.max((elapsed - drawDuration) / settleDuration, 0), 1)
	);
	const idlePulse = $derived(0.62 + Math.sin(elapsed * 2.1 + idlePhaseOffset) * 0.14);
	const finalPulse = $derived(Math.sin(settleProgress * Math.PI) * 0.48);
	const lineScale = $derived(Math.max(0.001, easedProgress));
	const linePosition = $derived(pointAlong(start, direction, (length * lineScale) / 2));
	const frontPosition = $derived(pointAlong(start, direction, length * easedProgress));
	const haloOpacity = $derived(0.12 + finalPulse * 0.16 + idlePulse * 0.035);
	const coreOpacity = $derived(0.5 + finalPulse * 0.14);
	const frontOpacity = $derived(progress < 1 ? 0.52 : finalPulse * 0.28);

	useTask((delta) => {
		elapsed += Math.min(delta, 0.05);
	});

	function cellCenter(cellIndex: number): Vec3 {
		const cell = cellFromIndex(cellIndex);
		return cellPosition(cell.height, cell.row, cell.col);
	}

	function extendedEndpoint(points: readonly Vec3[], side: -1 | 1): Vec3 {
		const first = points[0] ?? [0, 0, 0];
		const last = points.at(-1) ?? first;
		const delta = vectorDelta(first, last);
		const direction = normalize(delta);
		const base = side < 0 ? first : last;
		const padding = PIECE_SIZE * 0.34 * -side;

		return [
			base[0] + direction[0] * padding,
			base[1] + direction[1] * padding,
			base[2] + direction[2] * padding
		];
	}

	function pointAlong(origin: Vec3, direction: Vec3, distance: number): Vec3 {
		return [
			origin[0] + direction[0] * distance,
			origin[1] + direction[1] * distance,
			origin[2] + direction[2] * distance
		];
	}

	function vectorDelta(start: Vec3, end: Vec3): Vec3 {
		return [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
	}

	function vectorLength(vector: Vec3): number {
		return Math.hypot(vector[0], vector[1], vector[2]);
	}

	function normalize(vector: Vec3): Vec3 {
		const length = vectorLength(vector);
		if (length <= 0.0001) return [0, 1, 0];
		return [vector[0] / length, vector[1] / length, vector[2] / length];
	}

	function rotationFromY(direction: Vec3): [number, number, number, number] {
		const quaternion = new Quaternion().setFromUnitVectors(
			new Vector3(0, 1, 0),
			new Vector3(...direction).normalize()
		);
		return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
	}

	function hashPhase(value: string): number {
		let hash = 2166136261;
		for (let index = 0; index < value.length; index += 1) {
			hash ^= value.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}

		return ((hash >>> 0) / 4294967296) * Math.PI * 2;
	}

	function easeInOutCubic(value: number): number {
		return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
	}
</script>

<T.Group>
	<T.Mesh position={linePosition} {quaternion} scale={[1, lineScale, 1]} renderOrder={12}>
		<T.CylinderGeometry args={[PIECE_SIZE * 0.082, PIECE_SIZE * 0.082, length, 18]} />
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={coreOpacity}
			depthWrite={false}
			depthTest={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	<T.Mesh position={linePosition} {quaternion} scale={[1, lineScale, 1]} renderOrder={11}>
		<T.CylinderGeometry args={[PIECE_SIZE * 0.15, PIECE_SIZE * 0.15, length, 18]} />
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={haloOpacity}
			depthWrite={false}
			depthTest={true}
			blending={AdditiveBlending}
		/>
	</T.Mesh>

	{#if frontOpacity > 0.02}
		<T.PointLight
			{color}
			position={frontPosition}
			intensity={frontOpacity * 0.85}
			distance={1.45}
		/>
		<T.Mesh position={frontPosition} renderOrder={13}>
			<T.SphereGeometry args={[PIECE_SIZE * 0.18 + finalPulse * 0.03, 20, 12]} />
			<T.MeshBasicMaterial
				{color}
				transparent
				opacity={frontOpacity}
				depthWrite={false}
				depthTest={true}
				blending={AdditiveBlending}
			/>
		</T.Mesh>
	{/if}
</T.Group>
