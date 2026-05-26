<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T } from '@threlte/core';
	import {
		AdditiveBlending,
		BackSide,
		BufferGeometry,
		Float32BufferAttribute,
		LineBasicMaterial,
		LineSegments,
		Points,
		PointsMaterial,
		ShaderMaterial
	} from 'three';
	import type { UiThemeName, ScenePalette } from '../theming/sceneThemes';
	import {
		BOARD_SIZE,
		createGridGlowStreakGeometry,
		createGridLinePositions,
		createGridNodePositions,
		createOuterEdgeLinePositions
	} from './geometry';

	let {
		palette,
		uiTheme
	}: {
		palette: ScenePalette;
		uiTheme: UiThemeName;
	} = $props();

	const lineGeometry = new BufferGeometry();
	lineGeometry.setAttribute('position', new Float32BufferAttribute(createGridLinePositions(), 3));

	const edgeGeometry = new BufferGeometry();
	edgeGeometry.setAttribute(
		'position',
		new Float32BufferAttribute(createOuterEdgeLinePositions(), 3)
	);

	const innerStreakGeometry = createFadedLineGeometry(createGridGlowStreakGeometry(0.38));

	const outerStreakGeometry = createFadedLineGeometry(createGridGlowStreakGeometry(0.78));

	const nodeGeometry = new BufferGeometry();
	nodeGeometry.setAttribute('position', new Float32BufferAttribute(createGridNodePositions(), 3));

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

	const lineOpacity = $derived(uiTheme === 'dark' ? 0.34 : 0.28);
	const edgeOpacity = $derived(uiTheme === 'dark' ? 0.8 : 0.52);
	const innerStreakOpacity = $derived(uiTheme === 'dark' ? 0.42 : 0.26);
	const outerStreakOpacity = $derived(uiTheme === 'dark' ? 0.18 : 0.1);
	const nodeOpacity = $derived(uiTheme === 'dark' ? 0.64 : 0.42);
	const nodeHaloOpacity = $derived(uiTheme === 'dark' ? 0.11 : 0.07);
	const shellOpacity = $derived(uiTheme === 'dark' ? 0.045 : 0.09);

	$effect(() => {
		lineMaterial.color.set(palette.grid);
		lineMaterial.opacity = lineOpacity;
		lineMaterial.needsUpdate = true;

		edgeMaterial.color.set(palette.grid);
		edgeMaterial.opacity = edgeOpacity;
		edgeMaterial.needsUpdate = true;

		innerStreakMaterial.uniforms.glowColor.value.set(uiTheme === 'dark' ? '#ffffff' : palette.grid);
		innerStreakMaterial.uniforms.opacity.value = innerStreakOpacity;
		innerStreakMaterial.needsUpdate = true;

		outerStreakMaterial.uniforms.glowColor.value.set(palette.gridEmissive);
		outerStreakMaterial.uniforms.opacity.value = outerStreakOpacity;
		outerStreakMaterial.needsUpdate = true;

		nodeMaterial.color.set(uiTheme === 'dark' ? '#ffffff' : palette.grid);
		nodeMaterial.opacity = nodeOpacity;
		nodeMaterial.size = uiTheme === 'dark' ? 0.045 : 0.036;
		nodeMaterial.needsUpdate = true;

		nodeHaloMaterial.color.set(palette.gridEmissive);
		nodeHaloMaterial.opacity = nodeHaloOpacity;
		nodeHaloMaterial.size = uiTheme === 'dark' ? 0.14 : 0.1;
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
	<T.Mesh renderOrder={0}>
		<T.BoxGeometry args={BOARD_SIZE} />
		<T.MeshPhysicalMaterial
			color={palette.grid}
			emissive={palette.gridEmissive}
			emissiveIntensity={uiTheme === 'dark' ? 0.12 : 0.04}
			roughness={0.12}
			metalness={0}
			clearcoat={1}
			clearcoatRoughness={0.04}
			ior={1.45}
			transmission={uiTheme === 'dark' ? 0.18 : 0.08}
			thickness={0.18}
			transparent
			opacity={shellOpacity}
			depthWrite={false}
			side={BackSide}
		/>
	</T.Mesh>

	<T is={LineSegments} args={[lineGeometry, lineMaterial]} renderOrder={2} />
	<T is={LineSegments} args={[edgeGeometry, edgeMaterial]} renderOrder={3} />
	<T is={LineSegments} args={[outerStreakGeometry, outerStreakMaterial]} renderOrder={4} />
	<T is={LineSegments} args={[innerStreakGeometry, innerStreakMaterial]} renderOrder={5} />
	<T is={Points} args={[nodeGeometry, nodeHaloMaterial]} renderOrder={6} />
	<T is={Points} args={[nodeGeometry, nodeMaterial]} renderOrder={7} />
</T.Group>
