<script lang="ts">
	import { onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { getDropHeight, type GameSnapshot, type Move } from '@axial/core';
	import { Plane, Raycaster, Vector2, Vector3 } from 'three';
	import { CELL_SPACING } from './geometry';
	import { moveFromBoardLocalPoint, type BoardLocalPoint } from './picking';

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

	let pointerDown: { x: number; y: number; time: number } | null = null;
	let hoverKey = '';

	onMount(() => {
		dom.addEventListener('pointerdown', handlePointerDown);
		dom.addEventListener('pointermove', handlePointerMove);
		dom.addEventListener('pointerleave', clearHover);
		dom.addEventListener('pointerup', handlePointerUp);

		return () => {
			dom.removeEventListener('pointerdown', handlePointerDown);
			dom.removeEventListener('pointermove', handlePointerMove);
			dom.removeEventListener('pointerleave', clearHover);
			dom.removeEventListener('pointerup', handlePointerUp);
		};
	});

	function handlePointerDown(event: PointerEvent): void {
		if (event.button !== 0) return;
		pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
	}

	function handlePointerMove(event: PointerEvent): void {
		if (event.buttons !== 0) return;
		setHover(pickMove(event));
	}

	function handlePointerUp(event: PointerEvent): void {
		if (event.button !== 0 || pointerDown === null) return;

		const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
		const elapsed = performance.now() - pointerDown.time;
		pointerDown = null;

		if (distance > 8 || elapsed > 650) return;

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

	function clearHover(): void {
		pointerDown = null;
		setHover(null);
	}
</script>
