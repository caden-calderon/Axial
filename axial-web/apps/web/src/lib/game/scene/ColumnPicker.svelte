<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import { getDropHeight, type GameSnapshot, type Move } from '@axial/core';
	import { Raycaster, Vector2 } from 'three';
	import { CELL_SPACING } from './geometry';
	import {
		moveFromBoardLocalPoint,
		moveFromBoardLocalRay,
		type BoardLocalPoint,
		type BoardLocalRay
	} from './picking';
	import { createPlacementGesture } from './placementGesture';

	let {
		game,
		boardRotation,
		boardScale,
		onHover,
		onPlay,
		isMovePlayable,
		enabled = true
	}: {
		game: GameSnapshot;
		boardRotation: number;
		boardScale: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
		isMovePlayable?: (move: Move) => boolean;
		/** False while it isn't the player's turn: no preview follows the pointer, taps do nothing. */
		enabled?: boolean;
	} = $props();

	const { camera, canvas, dom } = useThrelte();
	const raycaster = new Raycaster();
	const pointerNdc = new Vector2();

	const placementGesture = createPlacementGesture();
	let hoverKey = '';
	// Where a mouse last rested over the board; cleared when it leaves or the keyboard takes over.
	let restingPointer: { clientX: number; clientY: number } | null = null;

	// Every new position (a drop, undo, the opponent's reply) clears the hover upstream, and the
	// cached key used to swallow the next hover over the same cell, so the preview only returned
	// after the pointer crossed into another cell. Re-pick under a resting mouse instead.
	$effect(() => {
		void game.moveHistory;
		void enabled;
		untrack(() => {
			const previousKey = hoverKey;
			hoverKey = '';
			if (enabled && restingPointer) setHover(pickMove(restingPointer));
			else if (previousKey) onHover(null);
		});
	});

	onMount(() => {
		dom.addEventListener('pointerdown', handlePointerDown);
		dom.addEventListener('pointermove', handlePointerMove);
		dom.addEventListener('pointerleave', cancelPointer);
		dom.addEventListener('pointercancel', cancelPointer);
		dom.addEventListener('pointerup', handlePointerUp);
		window.addEventListener('keydown', forgetRestingPointer);

		return () => {
			window.removeEventListener('keydown', forgetRestingPointer);
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
		restingPointer =
			event.pointerType === 'mouse' ? { clientX: event.clientX, clientY: event.clientY } : null;
		if (event.buttons !== 0) return;
		setHover(enabled ? pickMove(event) : null);
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!placementGesture.up(event, performance.now())) return;
		if (!enabled) return;

		const move = pickMove(event);
		if (move) onPlay(move);
	}

	function forgetRestingPointer(): void {
		restingPointer = null;
	}

	function pickMove(pointer: { clientX: number; clientY: number }): Move | null {
		if (game.status.state !== 'playing') return null;

		const ray = boardLocalRayFromPointer(pointer);
		if (ray === null) return null;

		// A stack under the pointer wins; otherwise the floor tile the pointer projects onto.
		const floor = floorPoint(ray);
		const move =
			moveFromBoardLocalRay(ray, game.dimensions, stackHeight) ??
			(floor && moveFromBoardLocalPoint(floor, game.dimensions));
		if (move === null) return null;
		if (isMovePlayable && !isMovePlayable(move)) return null;

		return getDropHeight(game.board, move, game.dimensions) >= 0 ? move : null;
	}

	function stackHeight(move: Move): number {
		const landing = getDropHeight(game.board, move, game.dimensions);
		return landing < 0 ? game.dimensions.height : landing;
	}

	/** The pointer's camera ray in the board group's unrotated, unscaled space. */
	function boardLocalRayFromPointer(pointer: {
		clientX: number;
		clientY: number;
	}): BoardLocalRay | null {
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;

		pointerNdc.set(
			((pointer.clientX - rect.left) / rect.width) * 2 - 1,
			-(((pointer.clientY - rect.top) / rect.height) * 2 - 1)
		);

		camera.current.updateMatrixWorld();
		raycaster.setFromCamera(pointerNdc, camera.current);

		const { origin, direction } = raycaster.ray;
		const cos = Math.cos(boardRotation);
		const sin = Math.sin(boardRotation);
		return {
			origin: [
				(cos * origin.x - sin * origin.z) / boardScale,
				origin.y / boardScale,
				(sin * origin.x + cos * origin.z) / boardScale
			],
			direction: [
				cos * direction.x - sin * direction.z,
				direction.y,
				sin * direction.x + cos * direction.z
			]
		};
	}

	function floorPoint(ray: BoardLocalRay): BoardLocalPoint | null {
		const floorY = -game.dimensions.height * CELL_SPACING * 0.5;
		if (ray.direction[1] >= 0) return null;
		const distance = (floorY - ray.origin[1]) / ray.direction[1];
		return {
			x: ray.origin[0] + ray.direction[0] * distance,
			z: ray.origin[2] + ray.direction[2] * distance
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
		restingPointer = null;
		setHover(null);
	}
</script>
