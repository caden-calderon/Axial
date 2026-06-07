<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { T } from '@threlte/core';
	import {
		AdditiveBlending,
		BackSide,
		BufferGeometry,
		DoubleSide,
		Float32BufferAttribute,
		LineBasicMaterial,
		LineSegments,
		NormalBlending,
		Points,
		PointsMaterial,
		ShaderMaterial
	} from 'three';
	import type { BoardDimensions } from '@axial/core';
	import type { UiThemeName, ScenePalette } from '../theming/sceneThemes';
	import {
		boardSize,
		createGridGlowStreakGeometry,
		createGridLinePositions,
		createGridNodePositions,
		createOuterEdgeLinePositions
	} from './geometry';

	let {
		palette,
		uiTheme,
		dimensions,
		layersVisible = true
	}: {
		palette: ScenePalette;
		uiTheme: UiThemeName;
		dimensions: BoardDimensions;
		layersVisible?: boolean;
	} = $props();

	const initialDimensions = untrack(() => dimensions);
	const includeLayers = untrack(() => layersVisible);
	const geometryOptions = { includeLayers };
	const lineGeometry = new BufferGeometry();
	lineGeometry.setAttribute(
		'position',
		new Float32BufferAttribute(createGridLinePositions(initialDimensions, geometryOptions), 3)
	);

	const edgeGeometry = new BufferGeometry();
	edgeGeometry.setAttribute(
		'position',
		new Float32BufferAttribute(createOuterEdgeLinePositions(initialDimensions, geometryOptions), 3)
	);

	const innerStreakGeometry = createFadedLineGeometry(
		createGridGlowStreakGeometry(0.38, initialDimensions, geometryOptions)
	);

	const outerStreakGeometry = createFadedLineGeometry(
		createGridGlowStreakGeometry(0.78, initialDimensions, geometryOptions)
	);

	const nodeGeometry = new BufferGeometry();
	nodeGeometry.setAttribute(
		'position',
		new Float32BufferAttribute(createGridNodePositions(initialDimensions, geometryOptions), 3)
	);

	const lineMaterial = new LineBasicMaterial({
		transparent: true,
		depthTest: true,
		depthWrite: false,
		toneMapped: false,
		blending: AdditiveBlending
	});

	const edgeMaterial = new LineBasicMaterial({
		transparent: true,
		depthTest: true,
		depthWrite: false,
		toneMapped: false,
		blending: AdditiveBlending
	});

	const innerStreakMaterial = createFadedLineMaterial();

	const outerStreakMaterial = createFadedLineMaterial();

	const nodeMaterial = new PointsMaterial({
		transparent: true,
		depthTest: true,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false,
		blending: AdditiveBlending
	});

	const nodeHaloMaterial = new PointsMaterial({
		transparent: true,
		depthTest: true,
		depthWrite: false,
		sizeAttenuation: true,
		toneMapped: false,
		blending: AdditiveBlending
	});

	const lineOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.34 : 0.48) : uiTheme === 'dark' ? 0.44 : 0.56
	);
	const edgeOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.8 : 0.76) : uiTheme === 'dark' ? 0.88 : 0.82
	);
	const innerStreakOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.42 : 0.24) : uiTheme === 'dark' ? 0.34 : 0.2
	);
	const outerStreakOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.18 : 0.12) : uiTheme === 'dark' ? 0.14 : 0.1
	);
	const nodeOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.64 : 0.58) : uiTheme === 'dark' ? 0.7 : 0.64
	);
	const nodeHaloOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.11 : 0.14) : uiTheme === 'dark' ? 0.09 : 0.12
	);
	const shellOpacity = $derived(
		includeLayers ? (uiTheme === 'dark' ? 0.045 : 0.055) : uiTheme === 'dark' ? 0.07 : 0.08
	);
	const gridLineBlending = $derived(uiTheme === 'dark' ? AdditiveBlending : NormalBlending);
	const gridGlowBlending = AdditiveBlending;
	const shellSize = boardSize(initialDimensions);
	const floorPlanePosition: [number, number, number] = [0, -shellSize[1] / 2, 0];

	$effect(() => {
		lineMaterial.color.set(palette.grid);
		lineMaterial.opacity = lineOpacity;
		lineMaterial.blending = gridLineBlending;
		lineMaterial.needsUpdate = true;

		edgeMaterial.color.set(palette.grid);
		edgeMaterial.opacity = edgeOpacity;
		edgeMaterial.blending = gridLineBlending;
		edgeMaterial.needsUpdate = true;

		innerStreakMaterial.uniforms.glowColor.value.set(uiTheme === 'dark' ? '#ffffff' : palette.grid);
		innerStreakMaterial.uniforms.opacity.value = innerStreakOpacity;
		innerStreakMaterial.blending = gridGlowBlending;
		innerStreakMaterial.needsUpdate = true;

		outerStreakMaterial.uniforms.glowColor.value.set(palette.gridEmissive);
		outerStreakMaterial.uniforms.opacity.value = outerStreakOpacity;
		outerStreakMaterial.blending = gridGlowBlending;
		outerStreakMaterial.needsUpdate = true;

		nodeMaterial.color.set(uiTheme === 'dark' ? '#ffffff' : palette.grid);
		nodeMaterial.opacity = nodeOpacity;
		nodeMaterial.size = uiTheme === 'dark' ? 0.045 : 0.042;
		nodeMaterial.blending = gridLineBlending;
		nodeMaterial.needsUpdate = true;

		nodeHaloMaterial.color.set(palette.gridEmissive);
		nodeHaloMaterial.opacity = nodeHaloOpacity;
		nodeHaloMaterial.size = uiTheme === 'dark' ? 0.14 : 0.13;
		nodeHaloMaterial.blending = gridGlowBlending;
		nodeHaloMaterial.needsUpdate = true;
	});

	function createFadedLineGeometry(data: {
		positions: number[];
		alphas: number[];
	}): BufferGeometry {
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
		geometry.setAttribute('lineAlpha', new Float32BufferAttribute(data.alphas, 1));
		return geometry;
	}

	function createFadedLineMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: {
				glowColor: { value: lineMaterial.color.clone() },
				opacity: { value: 1 }
			},
			vertexShader: `
				attribute float lineAlpha;
				varying float vLineAlpha;

				void main() {
					vLineAlpha = lineAlpha;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform vec3 glowColor;
				uniform float opacity;
				varying float vLineAlpha;

				void main() {
					float alpha = opacity * pow(clamp(vLineAlpha, 0.0, 1.0), 1.7);
					if (alpha < 0.004) discard;
					gl_FragColor = vec4(glowColor, alpha);
				}
			`,
			transparent: true,
			depthTest: true,
			depthWrite: false,
			toneMapped: false,
			blending: AdditiveBlending
		});
	}

	onDestroy(() => {
		lineGeometry.dispose();
		edgeGeometry.dispose();
		innerStreakGeometry.dispose();
		outerStreakGeometry.dispose();
		nodeGeometry.dispose();
		lineMaterial.dispose();
		edgeMaterial.dispose();
		innerStreakMaterial.dispose();
		outerStreakMaterial.dispose();
		nodeMaterial.dispose();
		nodeHaloMaterial.dispose();
	});
</script>

<T.Group>
	{#if includeLayers}
		<T.Mesh renderOrder={0}>
			<T.BoxGeometry args={shellSize} />
			<T.MeshPhysicalMaterial
				color={palette.grid}
				emissive={palette.gridEmissive}
				emissiveIntensity={uiTheme === 'dark' ? 0.12 : 0.015}
				roughness={0.12}
				metalness={0}
				clearcoat={1}
				clearcoatRoughness={0.04}
				ior={1.45}
				transmission={uiTheme === 'dark' ? 0.18 : 0.04}
				thickness={0.18}
				transparent
				opacity={shellOpacity}
				depthWrite={false}
				side={BackSide}
			/>
		</T.Mesh>
	{:else}
		<T.Mesh position={floorPlanePosition} rotation.x={-Math.PI / 2} renderOrder={0}>
			<T.PlaneGeometry args={[shellSize[0], shellSize[2]]} />
			<T.MeshPhysicalMaterial
				color={palette.grid}
				emissive={palette.gridEmissive}
				emissiveIntensity={uiTheme === 'dark' ? 0.1 : 0.012}
				roughness={0.18}
				metalness={0}
				clearcoat={1}
				clearcoatRoughness={0.08}
				transparent
				opacity={shellOpacity}
				depthWrite={false}
				side={DoubleSide}
			/>
		</T.Mesh>
	{/if}

	<T is={LineSegments} args={[lineGeometry, lineMaterial]} renderOrder={2} />
	<T is={LineSegments} args={[edgeGeometry, edgeMaterial]} renderOrder={3} />
	<T is={LineSegments} args={[outerStreakGeometry, outerStreakMaterial]} renderOrder={4} />
	<T is={LineSegments} args={[innerStreakGeometry, innerStreakMaterial]} renderOrder={5} />
	<T is={Points} args={[nodeGeometry, nodeHaloMaterial]} renderOrder={6} />
	<T is={Points} args={[nodeGeometry, nodeMaterial]} renderOrder={7} />
</T.Group>
