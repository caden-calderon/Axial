<script lang="ts">
	import { onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { getDropHeight, type GameSnapshot, type Move } from '@axial/core';
	import { Plane, Raycaster, Vector2, Vector3 } from 'three';
	import { CELL_SPACING } from './geometry';
	import { moveFromBoardLocalPoint, type BoardLocalPoint } from './picking';
	import { createPlacementGesture } from './placementGesture';

	let {
		game,
		boardRotation,
		boardScale,
		onHover,
		onPlay,
		isMovePlayable
	}: {
		game: GameSnapshot;
		boardRotation: number;
		boardScale: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
		isMovePlayable?: (move: Move) => boolean;
	} = $props();

	const { camera, canvas, dom } = useThrelte();
	const raycaster = new Raycaster();
	const pointerNdc = new Vector2();
	const hitPlane = new Plane();
	const hitPoint = new Vector3();
	const hitPlaneNormal = new Vector3(0, 1, 0);

	const placementGesture = createPlacementGesture();
	let hoverKey = '';

	onMount(() => {
		dom.addEventListener('pointerdown', handlePointerDown);
		dom.addEventListener('pointermove', handlePointerMove);
		dom.addEventListener('pointerleave', cancelPointer);
		dom.addEventListener('pointercancel', cancelPointer);
		dom.addEventListener('pointerup', handlePointerUp);

		return () => {
			dom.removeEventListener('pointerdown', handlePointerDown);
			dom.removeEventListener('pointermove', handlePointerMove);
			dom.removeEventListener('pointerleave', cancelPointer);
			dom.removeEventListener('pointercancel', cancelPointer);
			dom.removeEventListener('pointerup', handlePointerUp);
			placementGesture.reset();
		};
	});

	function handlePointerDown(event: PointerEvent): void {
		placementGesture.down(event, performance.now());
	}

	function handlePointerMove(event: PointerEvent): void {
		placementGesture.move(event);
		if (event.buttons !== 0) return;
		setHover(pickMove(event));
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!placementGesture.up(event, performance.now())) return;

		const move = pickMove(event);
		if (move) onPlay(move);
	}

	function pickMove(event: PointerEvent): Move | null {
		if (game.status.state !== 'playing') return null;

		const localPoint = boardLocalPointFromPointer(event);
		if (localPoint === null) return null;

		const move = moveFromBoardLocalPoint(localPoint, game.dimensions);
		if (move === null) return null;
		if (isMovePlayable && !isMovePlayable(move)) return null;

		return getDropHeight(game.board, move, game.dimensions) >= 0 ? move : null;
	}

	function boardLocalPointFromPointer(event: PointerEvent): BoardLocalPoint | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;

		pointerNdc.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-(((event.clientY - rect.top) / rect.height) * 2 - 1)
		);

		camera.current.updateMatrixWorld();
		raycaster.setFromCamera(pointerNdc, camera.current);

		const floorY = -game.dimensions.height * CELL_SPACING * 0.5 * boardScale;
		hitPlane.set(hitPlaneNormal, -floorY);

		if (raycaster.ray.intersectPlane(hitPlane, hitPoint) === null) return null;

		const scaledX = hitPoint.x / boardScale;
		const scaledZ = hitPoint.z / boardScale;
		const cos = Math.cos(boardRotation);
		const sin = Math.sin(boardRotation);

		return {
			x: cos * scaledX - sin * scaledZ,
			z: sin * scaledX + cos * scaledZ
		};
	}

	function setHover(move: Move | null): void {
		const nextKey = move ? `${move.row}:${move.col}` : '';
		if (nextKey === hoverKey) return;

		hoverKey = nextKey;
		onHover(move);
	}

	function cancelPointer(event: PointerEvent): void {
		placementGesture.cancel(event.pointerId);
		setHover(null);
	}
</script>
