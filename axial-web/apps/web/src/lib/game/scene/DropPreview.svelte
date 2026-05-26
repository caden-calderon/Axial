<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RoundedBoxGeometry } from '@threlte/extras';
	import { AdditiveBlending } from 'three';
	import type { Move } from '@axial/core';
	import { cellPosition, PIECE_SIZE } from './geometry';
	import type { ScenePalette } from '../theming/sceneThemes';

	let { move, height, palette }: { move: Move; height: number; palette: ScenePalette } = $props();

	const target = $derived(cellPosition(height, move.row, move.col));
	let pulse = $state(1);
	let phase = 0;

	useTask((delta) => {
		phase += delta * 4.2;
		pulse = 1 + Math.sin(phase) * 0.08;
	});
</script>

<T.Group position={target}>
	<T.Mesh scale={pulse}>
		<RoundedBoxGeometry args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE]} radius={0.07} smoothness={4} />
		<T.MeshBasicMaterial
			color={palette.preview}
			transparent
			opacity={0.16}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>
	<T.Mesh scale={pulse * 1.02}>
		<RoundedBoxGeometry args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE]} radius={0.07} smoothness={4} />
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
			color={palette.preview}
			transparent
			opacity={0.56}
			depthWrite={false}
			blending={AdditiveBlending}
		/>
	</T.Mesh>
</T.Group>
