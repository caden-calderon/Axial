<script lang="ts">
	import { onMount } from 'svelte';
	import { useThrelte } from '@threlte/core';
	import {
		BOARD_COLUMNS,
		BOARD_HEIGHT,
		BOARD_ROWS,
		getDropHeight,
		type GameSnapshot,
		type Move
	} from '@axial/core';
	import { Vector3 } from 'three';
	import { cellPosition, type Vec3 } from './geometry';

	let {
		game,
		boardRotation,
		boardScale,
		onHover,
		onPlay
	}: {
		game: GameSnapshot;
		boardRotation: number;
		boardScale: number;
		onHover: (move: Move | null) => void;
		onPlay: (move: Move) => void;
	} = $props();

	const { camera, canvas, dom } = useThrelte();
	const columns = Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, (_, index) => ({
		row: index % BOARD_ROWS,
		col: Math.floor(index / BOARD_ROWS)
	}));

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

		const rect = canvas.getBoundingClientRect();
		const pointer = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
		const threshold = Math.max(34, Math.min(74, rect.width * 0.04));
		let bestMove: Move | null = null;
		let bestScore = Number.POSITIVE_INFINITY;

		for (const column of columns) {
			const dropHeight = getDropHeight(game.board, column);
			if (dropHeight < 0) continue;

			const bottom = project(cellPosition(0, column.row, column.col), rect);
			const top = project(cellPosition(BOARD_HEIGHT - 1, column.row, column.col), rect);
			const target = project(cellPosition(dropHeight, column.row, column.col), rect);
			const segmentScore = distanceToSegment(pointer, bottom, top);
			const targetScore = distance(pointer, target) * 0.82;
			const score = Math.min(segmentScore, targetScore);

			if (score < bestScore) {
				bestScore = score;
				bestMove = column;
			}
		}

		return bestScore <= threshold ? bestMove : null;
	}

	function project(localPosition: Vec3, rect: DOMRect): ScreenPoint {
		const projected = toWorld(localPosition).project(camera.current);
		return {
			x: (projected.x * 0.5 + 0.5) * rect.width,
			y: (-projected.y * 0.5 + 0.5) * rect.height
		};
	}

	function toWorld(localPosition: Vec3): Vector3 {
		const [x, y, z] = localPosition;
		const scaledX = x * boardScale;
		const scaledY = y * boardScale;
		const scaledZ = z * boardScale;
		const cos = Math.cos(boardRotation);
		const sin = Math.sin(boardRotation);

		return new Vector3(cos * scaledX + sin * scaledZ, scaledY, -sin * scaledX + cos * scaledZ);
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

	type ScreenPoint = {
		x: number;
		y: number;
	};

	function distance(a: ScreenPoint, b: ScreenPoint): number {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): number {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const lengthSquared = dx * dx + dy * dy;

		if (lengthSquared === 0) return distance(point, start);

		const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
		return distance(point, {
			x: start.x + dx * t,
			y: start.y + dy * t
		});
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
</script>
