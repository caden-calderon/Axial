<script lang="ts">
	import { untrack } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import type { BoardDimensions } from '@axial/core';
	import type { ScenePalette, UiThemeName } from '../theming/sceneThemes';
	import { boardSize, CELL_SPACING, cellPosition, type Vec3 } from './geometry';
	import BillboardLabel from './BillboardLabel.svelte';

	let {
		visible = true,
		palette,
		uiTheme,
		boardRotation,
		dimensions,
		compact = false
	}: {
		visible?: boolean;
		palette: ScenePalette;
		uiTheme: UiThemeName;
		boardRotation: number;
		dimensions: BoardDimensions;
		compact?: boolean;
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
	const initialDimensions = untrack(() => dimensions);
	const labelOffset = CELL_SPACING * 0.68;
	const lowerOffset = CELL_SPACING * 0.5;
	const axisLetterOffset = CELL_SPACING * 1.7;
	const zAxisLetterOffset = axisLetterOffset * 0.9;
	const size = boardSize(initialDimensions);
	const xHalf = size[0] / 2;
	const yHalf = size[1] / 2;
	const zHalf = size[2] / 2;
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
	const zNumbers = Array.from({ length: initialDimensions.height }, (_, index) =>
		String(index + 1)
	);
	const initialCameraDirection = cameraDirectionInBoardSpace();

	let cameraLocalX = $state(initialCameraDirection[0]);
	let cameraLocalZ = $state(initialCameraDirection[1]);
	const labelColor = $derived(
		uiTheme === 'dark' ? '#dcecff' : mixHexColor(palette.grid, '#3f3656', compact ? 0.44 : 0.28)
	);
	const numberFontSize = $derived(compact ? 0.255 : 0.2);
	const axisFontSize = $derived(compact ? 0.33 : 0.3);
	const numberFillOpacity = $derived(
		uiTheme === 'dark' ? (compact ? 0.48 : 0.28) : compact ? 0.74 : 0.56
	);
	const numberOutlineOpacity = $derived(
		uiTheme === 'dark' ? (compact ? 0.07 : 0.16) : compact ? 0.04 : 0.055
	);
	const numberOutlineWidth = $derived(compact ? 0.052 : uiTheme === 'dark' ? 0.1 : 0.066);
	const numberOutlineGlow = $derived(compact ? 0.032 : uiTheme === 'dark' ? 0.09 : 0.042);
	const numberFillGlow = $derived(compact ? 0.004 : uiTheme === 'dark' ? 0.02 : 0.006);
	const axisFillOpacity = $derived(uiTheme === 'dark' ? 0.36 : compact ? 0.42 : 0.52);
	const axisOutlineOpacity = $derived(uiTheme === 'dark' ? 0.21 : compact ? 0.14 : 0.08);
	const axisOutlineWidth = $derived(uiTheme === 'dark' ? 0.1 : 0.07);
	const axisOutlineGlow = $derived(uiTheme === 'dark' ? 0.09 : 0.042);
	const axisFillGlow = $derived(uiTheme === 'dark' ? 0.02 : 0.006);
	useTask((delta) => {
		const [nextLocalX, nextLocalZ] = cameraDirectionInBoardSpace();
		const blend = Math.min(1, delta * 8);

		cameraLocalX += (nextLocalX - cameraLocalX) * blend;
		cameraLocalZ += (nextLocalZ - cameraLocalZ) * blend;
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
		return Array.from({ length: initialDimensions.columns }, (_, index) => {
			const col = direction === 1 ? index : initialDimensions.columns - 1 - index;

			return [
				cellPosition(0, 0, col, initialDimensions)[0],
				-yHalf - lowerOffset,
				sideZ * (zHalf + labelOffset)
			];
		});
	}

	function createYRailPositions(sideX: Side, direction: Side): Vec3[] {
		return Array.from({ length: initialDimensions.rows }, (_, index) => {
			const row = direction === 1 ? index : initialDimensions.rows - 1 - index;

			return [
				sideX * (xHalf + labelOffset),
				-yHalf - lowerOffset,
				cellPosition(0, row, 0, initialDimensions)[2]
			];
		});
	}

	function cameraDirectionInBoardSpace(): [number, number] {
		const world = camera.current.position;
		const cos = Math.cos(boardRotation);
		const sin = Math.sin(boardRotation);
		const nextLocalX = cos * world.x - sin * world.z;
		const nextLocalZ = sin * world.x + cos * world.z;
		const length = Math.hypot(nextLocalX, nextLocalZ) || 1;

		return [nextLocalX / length, nextLocalZ / length];
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
		return smoothstep(0, 0.34, score);
	}

	function zRailVisibility(candidate: ZRailCandidate): number {
		const xVisibility = zSideVisibility(cameraLocalX, candidate.sideX);
		const zVisibility = zSideVisibility(cameraLocalZ, candidate.sideZ);
		const xWeight = zSideCrossfade(cameraLocalX, candidate.sideX);
		const zWeight = zSideCrossfade(cameraLocalZ, candidate.sideZ);

		return Math.max(xVisibility, zVisibility) * xWeight * zWeight;
	}

	function zNumberPosition(candidate: ZRailCandidate, index: number): Vec3 {
		return [
			candidate.sideX * (xHalf + labelOffset),
			cellPosition(index, 0, 0, initialDimensions)[1],
			candidate.sideZ * (zHalf + lowerOffset)
		];
	}

	function zAxisPosition(candidate: ZRailCandidate): Vec3 {
		return [
			candidate.sideX * (xHalf + zAxisLetterOffset),
			0,
			candidate.sideZ * (zHalf + zAxisLetterOffset)
		];
	}

	function axisSideVisibility(value: number, side: Side): number {
		return smoothstep(-0.2, 0.36, side * value);
	}

	function zSideVisibility(value: number, side: Side): number {
		return smoothstep(-0.08, 0.44, side * value);
	}

	function zSideCrossfade(value: number, side: Side): number {
		const positiveSideWeight = smoothstep(-0.17, 0.17, value + 0.018);

		return side === 1 ? positiveSideWeight : 1 - positiveSideWeight;
	}

	function smoothstep(edge0: number, edge1: number, value: number): number {
		const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
		return t * t * (3 - 2 * t);
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	function mixHexColor(color: string, target: string, amount: number): string {
		const sourceRgb = parseHexColor(color);
		const targetRgb = parseHexColor(target);

		return `#${sourceRgb
			.map((component, index) => {
				const mixed = Math.round(component + (targetRgb[index] - component) * amount);
				return mixed.toString(16).padStart(2, '0');
			})
			.join('')}`;
	}

	function parseHexColor(color: string): [number, number, number] {
		const normalized = color.replace('#', '');

		return [
			Number.parseInt(normalized.slice(0, 2), 16),
			Number.parseInt(normalized.slice(2, 4), 16),
			Number.parseInt(normalized.slice(4, 6), 16)
		];
	}
</script>

<T.Group {visible}>
	{#each perimeterLabels as label (label.id)}
		{@const visibility = perimeterNumberVisibility(label)}
		{#if visibility > 0.01}
			<BillboardLabel
				text={label.text}
				position={label.position}
				fontSize={numberFontSize}
				color={labelColor}
				outlineColor={palette.gridEmissive}
				fillOpacity={numberFillOpacity}
				outlineOpacity={numberOutlineOpacity}
				outlineWidth={numberOutlineWidth}
				outlineGlow={numberOutlineGlow}
				fillGlow={numberFillGlow}
				opacity={visibility}
			/>
		{/if}
	{/each}

	{#each axisLabelCandidates as label (label.id)}
		{@const visibility = axisLabelVisibility(label)}
		{#if visibility > 0.01}
			<BillboardLabel
				text={label.text}
				position={label.position}
				fontSize={axisFontSize}
				color={labelColor}
				outlineColor={palette.gridEmissive}
				fillOpacity={axisFillOpacity}
				outlineOpacity={axisOutlineOpacity}
				outlineWidth={axisOutlineWidth}
				outlineGlow={axisOutlineGlow}
				fillGlow={axisFillGlow}
				opacity={visibility}
			/>
		{/if}
	{/each}

	{#each zRailCandidates as candidate (candidate.id)}
		{@const visibility = zRailVisibility(candidate)}
		{#if visibility > 0.01}
			{#each zNumbers as number, index (`${candidate.id}-${number}`)}
				<BillboardLabel
					text={number}
					position={zNumberPosition(candidate, index)}
					fontSize={numberFontSize}
					color={labelColor}
					outlineColor={palette.gridEmissive}
					fillOpacity={numberFillOpacity}
					outlineOpacity={numberOutlineOpacity}
					outlineWidth={numberOutlineWidth}
					outlineGlow={numberOutlineGlow}
					fillGlow={numberFillGlow}
					opacity={visibility}
				/>
			{/each}

			<BillboardLabel
				text="Z"
				position={zAxisPosition(candidate)}
				fontSize={axisFontSize}
				color={labelColor}
				outlineColor={palette.gridEmissive}
				fillOpacity={axisFillOpacity}
				outlineOpacity={axisOutlineOpacity}
				outlineWidth={axisOutlineWidth}
				outlineGlow={axisOutlineGlow}
				fillGlow={axisFillGlow}
				opacity={visibility}
			/>
		{/if}
	{/each}
</T.Group>
