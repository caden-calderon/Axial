<script lang="ts">
	import { T } from '@threlte/core';
	import type { BoardDimensions, Move } from '@axial/core';
	import { CELL_SPACING, cellPosition, type Vec3 } from './geometry';

	let { move, dimensions, color }: { move: Move; dimensions: BoardDimensions; color: string } =
		$props();
	const position: Vec3 = $derived([
		cellPosition(0, move.row, move.col, dimensions)[0],
		(-dimensions.height * CELL_SPACING) / 2 + CELL_SPACING * 0.025,
		cellPosition(0, move.row, move.col, dimensions)[2]
	]);
</script>

<!-- This cue stays on the winning tile even while the player explores other columns. -->
<T.Group name="tutorial-target" {position}>
	<T.Mesh rotation.x={-Math.PI / 2} renderOrder={6}>
		<T.PlaneGeometry args={[CELL_SPACING * 1.1, CELL_SPACING * 1.1]} />
		<T.MeshBasicMaterial {color} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
	</T.Mesh>
	<T.Mesh rotation.x={-Math.PI / 2} position.y={0.004} renderOrder={7}>
		<T.PlaneGeometry args={[CELL_SPACING * 0.88, CELL_SPACING * 0.88]} />
		<T.MeshBasicMaterial {color} transparent opacity={0.62} depthWrite={false} toneMapped={false} />
	</T.Mesh>
	<T.Mesh rotation.x={-Math.PI / 2} position.y={0.008} renderOrder={8}>
		<T.RingGeometry args={[CELL_SPACING * 0.58, CELL_SPACING * 0.65, 4, 1, Math.PI / 4]} />
		<T.MeshBasicMaterial
			color="#f3eaff"
			transparent
			opacity={0.95}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>
</T.Group>
