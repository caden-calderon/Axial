<script lang="ts">
	import { onMount } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';
	import { MathUtils, Spherical, Vector3 } from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import type { Vec3 } from './geometry';
	import { createWheelGestureClassifier, type WheelSample } from './wheelGesture';

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

	/**
	 * Trackpad swipes report more distance than the fingers travel (system acceleration plus
	 * momentum after lift-off), so they turn at a fraction of the pointer-drag rate. Tuned on a
	 * real touchpad, where one quick flick summed to over 1,100 px.
	 */
	const TRACKPAD_ORBIT_SCALE = 0.3;
	const classifyWheel = createWheelGestureClassifier();
	const orbitOffset = new Vector3();
	const orbitSpherical = new Spherical();

	onMount(() => {
		// Capture listeners on the target run before OrbitControls' own wheel listener, so they
		// can claim a sideways swipe for orbiting, or pass an embedded page's scroll through,
		// before OrbitControls zooms and cancels the event.
		const routeWheel = (event: WheelEvent) => {
			if (wheelZoomNeedsModifier && !event.ctrlKey && !event.metaKey) {
				event.stopImmediatePropagation();
				return;
			}
			const intent = classifyWheel(toWheelSample(event));
			if (intent !== 'orbit' || !controls?.enabled || !controls.enableRotate) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			orbitBy(controls, event.deltaX, event.deltaY);
		};
		dom.addEventListener('wheel', routeWheel, { capture: true, passive: false });
		const nextControls = new OrbitControls(camera.current, dom);
		nextControls.addEventListener('change', invalidate);
		controls = nextControls;
		applyControlSettings(nextControls);
		nextControls.update();

		return () => {
			dom.removeEventListener('wheel', routeWheel, { capture: true });
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

	/**
	 * Turns a two-finger swipe into a rotation, scaled down from what a pointer drag of that
	 * distance gives (see TRACKPAD_ORBIT_SCALE). The deltas follow the system scroll direction, so with natural scrolling the board moves with
	 * the fingers, exactly as scrolling a page does.
	 */
	function orbitBy(activeControls: OrbitControls, deltaX: number, deltaY: number): void {
		const height = Math.max(1, dom.clientHeight);
		const turn = (2 * Math.PI * activeControls.rotateSpeed * TRACKPAD_ORBIT_SCALE) / height;
		const camera = activeControls.object;
		orbitOffset.copy(camera.position).sub(activeControls.target);
		orbitSpherical.setFromVector3(orbitOffset);
		orbitSpherical.theta += deltaX * turn;
		orbitSpherical.phi = MathUtils.clamp(
			orbitSpherical.phi + deltaY * turn,
			activeControls.minPolarAngle,
			activeControls.maxPolarAngle
		);
		orbitSpherical.makeSafe();
		orbitOffset.setFromSpherical(orbitSpherical);
		camera.position.copy(activeControls.target).add(orbitOffset);
		camera.lookAt(activeControls.target);
		activeControls.update();
	}

	function toWheelSample(event: WheelEvent): WheelSample {
		return {
			deltaX: event.deltaX,
			deltaY: event.deltaY,
			ctrlKey: event.ctrlKey,
			timeStamp: event.timeStamp
		};
	}

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
