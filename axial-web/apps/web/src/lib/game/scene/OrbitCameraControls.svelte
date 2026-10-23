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
		maxPolarAngle = Math.PI,
		wheelZoomNeedsModifier = false
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
		/** Embedded in another page, a plain wheel scrolls that page; Ctrl/⌘ (or a pinch) zooms. */
		wheelZoomNeedsModifier?: boolean;
	} = $props();

	const { camera, dom, invalidate } = useThrelte();
	let controls = $state.raw<OrbitControls | null>(null);

	onMount(() => {
		// Capture listeners on the target run before OrbitControls' own wheel listener, which
		// would otherwise cancel the event and trap the host page's scroll.
		const passWheelToPage = (event: WheelEvent) => {
			if (wheelZoomNeedsModifier && !event.ctrlKey && !event.metaKey) {
				event.stopImmediatePropagation();
			}
		};
		dom.addEventListener('wheel', passWheelToPage, { capture: true });
		const nextControls = new OrbitControls(camera.current, dom);
		nextControls.addEventListener('change', invalidate);
		controls = nextControls;
		applyControlSettings(nextControls);
		nextControls.update();

		return () => {
			dom.removeEventListener('wheel', passWheelToPage, { capture: true });
			nextControls.removeEventListener('change', invalidate);
			nextControls.dispose();
			controls = null;
		};
	});

	$effect(() => {
		if (!controls) return;

		applyControlSettings(controls);
		controls.update();
	});

	useTask(
		() => {
			if (!controls?.enabled) return;
			controls.update();
		},
		{ autoInvalidate: false }
	);

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
