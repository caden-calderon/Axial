<script lang="ts">
	import { onMount } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { Vec3 } from './geometry';

	let {
		enableDamping = false,
		dampingFactor = 0.05,
		enablePan = true,
		rotateSpeed = 1,
		zoomSpeed = 1,
		minDistance = 0,
		maxDistance = Infinity,
		target = [0, 0, 0],
		maxPolarAngle = Math.PI
	}: {
		enableDamping?: boolean;
		dampingFactor?: number;
		enablePan?: boolean;
		rotateSpeed?: number;
		zoomSpeed?: number;
		minDistance?: number;
		maxDistance?: number;
		target?: Vec3;
		maxPolarAngle?: number;
	} = $props();

	const { camera, dom } = useThrelte();
	let controls: OrbitControls | null = null;

	onMount(() => {
		const nextControls = new OrbitControls(camera.current, dom);
		controls = nextControls;
		applyControlSettings(nextControls);
		nextControls.update();

		return () => {
			nextControls.dispose();
			controls = null;
		};
	});

	$effect(() => {
		if (!controls) return;

		applyControlSettings(controls);
		controls.update();
	});

	useTask(() => {
		if (!controls?.enabled) return;
		controls.update();
	});

	function applyControlSettings(nextControls: OrbitControls): void {
		nextControls.enableDamping = enableDamping;
		nextControls.dampingFactor = dampingFactor;
		nextControls.enablePan = enablePan;
		nextControls.rotateSpeed = rotateSpeed;
		nextControls.zoomSpeed = zoomSpeed;
		nextControls.minDistance = minDistance;
		nextControls.maxDistance = maxDistance;
		nextControls.maxPolarAngle = maxPolarAngle;
		nextControls.target.set(target[0], target[1], target[2]);
	}
</script>
