<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Billboard, Text } from '@threlte/extras';
	import { BOARD_COLUMNS, BOARD_HEIGHT, BOARD_ROWS } from '@axial/core';
	import { MeshBasicMaterial } from 'three';
	import type { ScenePalette, UiThemeName } from '../theming/sceneThemes';
	import { BOARD_SIZE, CELL_SPACING, cellPosition, type Vec3 } from './geometry';

	let {
		palette,
		uiTheme,
		boardRotation
	}: {
		palette: ScenePalette;
		uiTheme: UiThemeName;
		boardRotation: number;
	} = $props();

	type PerimeterRailId = 'west-y' | 'south-x' | 'east-y' | 'north-x';
	type Side = -1 | 1;

	type PerimeterRail = {
		id: PerimeterRailId;
		normalX: number;
		normalZ: number;
		numberPositions: Vec3[];
	};

	type PerimeterLabel = {
		id: string;
		text: string;
		position: Vec3;
		railId: PerimeterRailId;
	};

	type AxisLabelCandidate = {
		id: string;
		text: 'X' | 'Y';
		position: Vec3;
		fadeAxis: 'x' | 'z';
		side: Side;
	};

	type ZRailCandidate = {
		id: string;
		sideX: Side;
		sideZ: Side;
	};

	const { camera } = useThrelte();
	const labelOffset = CELL_SPACING * 0.68;
	const lowerOffset = CELL_SPACING * 0.5;
	const axisOffset = CELL_SPACING * 0.98;
	const axisLetterOffset = CELL_SPACING * 1.7;
	const xHalf = BOARD_SIZE[0] / 2;
	const yHalf = BOARD_SIZE[1] / 2;
	const zHalf = BOARD_SIZE[2] / 2;
	const perimeterAxisY = -yHalf + CELL_SPACING * 0.25;
	const zRailCandidates: ZRailCandidate[] = [
		{ id: 'z-west-south', sideX: -1, sideZ: -1 },
		{ id: 'z-west-north', sideX: -1, sideZ: 1 },
		{ id: 'z-east-south', sideX: 1, sideZ: -1 },
		{ id: 'z-east-north', sideX: 1, sideZ: 1 }
	];

	const perimeterRails: PerimeterRail[] = [
		{
			id: 'west-y',
			normalX: -1,
			normalZ: 0,
			numberPositions: createYRailPositions(-1, -1)
		},
		{
			id: 'south-x',
			normalX: 0,
			normalZ: -1,
			numberPositions: createXRailPositions(-1, 1)
		},
		{
			id: 'east-y',
			normalX: 1,
			normalZ: 0,
			numberPositions: createYRailPositions(1, 1)
		},
		{
			id: 'north-x',
			normalX: 0,
			normalZ: 1,
			numberPositions: createXRailPositions(1, -1)
		}
	];
	const perimeterLabels = createPerimeterLabels();
	const axisLabelCandidates = createAxisLabelCandidates();
	const zNumbers = Array.from({ length: BOARD_HEIGHT }, (_, index) => String(index + 1));

	let cameraLocalX = $state(1);
	let cameraLocalZ = $state(1);
	const labelColor = $derived(uiTheme === 'dark' ? '#dcecff' : palette.grid);
	const fillOpacity = $derived(uiTheme === 'dark' ? 0.46 : 0.5);
	const outlineOpacity = $derived(uiTheme === 'dark' ? 0.32 : 0.18);
	const labelMaterial = new MeshBasicMaterial({
		depthTest: false,
		depthWrite: false,
		transparent: true
	});

	onDestroy(() => labelMaterial.dispose());

	useTask((delta) => {
		const world = camera.current.position;
		const cos = Math.cos(boardRotation);
		const sin = Math.sin(boardRotation);
		const nextLocalX = cos * world.x - sin * world.z;
		const nextLocalZ = sin * world.x + cos * world.z;
		const length = Math.hypot(nextLocalX, nextLocalZ) || 1;
		const blend = Math.min(1, delta * 8);

		cameraLocalX += (nextLocalX / length - cameraLocalX) * blend;
		cameraLocalZ += (nextLocalZ / length - cameraLocalZ) * blend;
	});

	function createPerimeterLabels(): PerimeterLabel[] {
		return perimeterRails.flatMap((rail) =>
			rail.numberPositions.map((position, index) => ({
				id: `${rail.id}-${index + 1}`,
				text: String(index + 1),
				position,
				railId: rail.id
			}))
		);
	}

	function createAxisLabelCandidates(): AxisLabelCandidate[] {
		return [
			{
				id: 'x-south',
				text: 'X',
				position: [0, perimeterAxisY, -zHalf - axisLetterOffset],
				fadeAxis: 'z',
				side: -1
			},
			{
				id: 'x-north',
				text: 'X',
				position: [0, perimeterAxisY, zHalf + axisLetterOffset],
				fadeAxis: 'z',
				side: 1
			},
			{
				id: 'y-west',
				text: 'Y',
				position: [-xHalf - axisLetterOffset, perimeterAxisY, 0],
				fadeAxis: 'x',
				side: -1
			},
			{
				id: 'y-east',
				text: 'Y',
				position: [xHalf + axisLetterOffset, perimeterAxisY, 0],
				fadeAxis: 'x',
				side: 1
			}
		];
	}

	function createXRailPositions(sideZ: Side, direction: Side): Vec3[] {
		return Array.from({ length: BOARD_COLUMNS }, (_, index) => {
			const col = direction === 1 ? index : BOARD_COLUMNS - 1 - index;

			return [cellPosition(0, 0, col)[0], -yHalf - lowerOffset, sideZ * (zHalf + labelOffset)];
		});
	}

	function createYRailPositions(sideX: Side, direction: Side): Vec3[] {
		return Array.from({ length: BOARD_ROWS }, (_, index) => {
			const row = direction === 1 ? index : BOARD_ROWS - 1 - index;

			return [sideX * (xHalf + labelOffset), -yHalf - lowerOffset, cellPosition(0, row, 0)[2]];
		});
	}

	function perimeterNumberVisibility(label: PerimeterLabel): number {
		return railVisibility(railScore(label.railId));
	}

	function axisLabelVisibility(label: AxisLabelCandidate): number {
		const value = label.fadeAxis === 'x' ? cameraLocalX : cameraLocalZ;

		return axisSideVisibility(value, label.side);
	}

	function railScore(railId: PerimeterRailId): number {
		const rail = perimeterRails.find((candidate) => candidate.id === railId);

		if (!rail) return 0;

		return Math.max(0, rail.normalX * cameraLocalX + rail.normalZ * cameraLocalZ);
	}

	function railVisibility(score: number): number {
		return smoothstep(0.05, 0.42, score);
	}

	function zRailVisibility(candidate: ZRailCandidate): number {
		const xVisibility = zSideVisibility(cameraLocalX, candidate.sideX);
		const zVisibility = zSideVisibility(cameraLocalZ, candidate.sideZ);

		return xVisibility * zVisibility;
	}

	function zNumberPosition(candidate: ZRailCandidate, index: number): Vec3 {
		return [
			candidate.sideX * (xHalf + labelOffset),
			cellPosition(index, 0, 0)[1],
			candidate.sideZ * (zHalf + lowerOffset)
		];
	}

	function zAxisPosition(candidate: ZRailCandidate): Vec3 {
		return [
			candidate.sideX * (xHalf + axisOffset * 0.72),
			yHalf + axisOffset * 0.86,
			candidate.sideZ * (zHalf + axisOffset * 0.72)
		];
	}

	function axisSideVisibility(value: number, side: Side): number {
		return smoothstep(-0.28, 0.46, side * value);
	}

	function zSideVisibility(value: number, side: Side): number {
		return smoothstep(-0.14, 0.58, side * value);
	}

	function smoothstep(edge0: number, edge1: number, value: number): number {
		const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
		return t * t * (3 - 2 * t);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
</script>

<T.Group>
	{#each perimeterLabels as label (label.id)}
		{@const visibility = perimeterNumberVisibility(label)}
		{#if visibility > 0.01}
			<Billboard position={label.position}>
				<Text
					text={label.text}
					fontSize={0.2}
					anchorX="center"
					anchorY="middle"
					material={labelMaterial}
					color={labelColor}
					fillOpacity={visibility * fillOpacity}
					outlineColor={palette.gridEmissive}
					outlineOpacity={visibility * outlineOpacity}
					outlineBlur="12%"
					outlineWidth="2%"
					depthOffset={-4}
					characters="XYZ1234567"
					renderOrder={9}
				/>
			</Billboard>
		{/if}
	{/each}

	{#each axisLabelCandidates as label (label.id)}
		{@const visibility = axisLabelVisibility(label)}
		{#if visibility > 0.01}
			<Billboard position={label.position}>
				<Text
					text={label.text}
					fontSize={0.3}
					anchorX="center"
					anchorY="middle"
					material={labelMaterial}
					color={labelColor}
					fillOpacity={visibility * (fillOpacity + 0.14)}
					outlineColor={palette.gridEmissive}
					outlineOpacity={visibility * (outlineOpacity + 0.08)}
					outlineBlur="18%"
					outlineWidth="2%"
					depthOffset={-4}
					characters="XYZ1234567"
					renderOrder={9}
				/>
			</Billboard>
		{/if}
	{/each}

	{#each zRailCandidates as candidate (candidate.id)}
		{@const visibility = zRailVisibility(candidate)}
		{#if visibility > 0.01}
			{#each zNumbers as number, index (`${candidate.id}-${number}`)}
				<Billboard position={zNumberPosition(candidate, index)}>
					<Text
						text={number}
						fontSize={0.2}
						anchorX="center"
						anchorY="middle"
						material={labelMaterial}
						color={labelColor}
						fillOpacity={visibility * fillOpacity * 0.9}
						outlineColor={palette.gridEmissive}
						outlineOpacity={visibility * outlineOpacity * 0.85}
						outlineBlur="12%"
						outlineWidth="2%"
						depthOffset={-4}
						characters="XYZ1234567"
						renderOrder={9}
					/>
				</Billboard>
			{/each}

			<Billboard position={zAxisPosition(candidate)}>
				<Text
					text="Z"
					fontSize={0.3}
					anchorX="center"
					anchorY="middle"
					material={labelMaterial}
					color={labelColor}
					fillOpacity={visibility * (fillOpacity + 0.14)}
					outlineColor={palette.gridEmissive}
					outlineOpacity={visibility * (outlineOpacity + 0.08)}
					outlineBlur="18%"
					outlineWidth="2%"
					depthOffset={-4}
					characters="XYZ1234567"
					renderOrder={9}
				/>
			</Billboard>
		{/if}
	{/each}
</T.Group>
