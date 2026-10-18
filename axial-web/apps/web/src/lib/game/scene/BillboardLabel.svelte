<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import {
		CanvasTexture,
		LinearFilter,
		Sprite,
		SpriteMaterial,
		SRGBColorSpace,
		type Texture
	} from 'three';
	import type { Vec3 } from './geometry';
	import { useLabelTextureCache } from './labelTextures';

	let {
		text,
		position,
		fontSize,
		color,
		outlineColor,
		fillOpacity,
		outlineOpacity,
		opacity,
		outlineWidth = 0.1,
		outlineGlow = 0.09,
		fillGlow = 0.02,
		renderOrder = 9,
		name = ''
	}: {
		text: string;
		position: Vec3;
		fontSize: number;
		color: string;
		outlineColor: string;
		fillOpacity: number;
		outlineOpacity: number;
		opacity: number;
		outlineWidth?: number;
		outlineGlow?: number;
		fillGlow?: number;
		renderOrder?: number;
		name?: string;
	} = $props();

	const { invalidate } = useThrelte();
	const material = new SpriteMaterial({
		depthTest: false,
		depthWrite: false,
		transparent: true,
		toneMapped: false
	});

	const textureCache = useLabelTextureCache();
	let texture: Texture | null = null;
	let textureKey: string | null = null;
	let fontsReady = $state(false);

	onMount(() => {
		let mounted = true;
		// Canvas textures do not automatically redraw when the UI font finishes loading.
		void document.fonts.ready.then(() => {
			if (mounted) fontsReady = true;
		});
		return () => {
			mounted = false;
		};
	});
	const scale = $derived([fontSize * 1.34, fontSize * 1.34, 1] as Vec3);

	$effect(() => {
		if (!fontsReady) return;
		const style = {
			text,
			color,
			outlineColor,
			fillOpacity,
			outlineOpacity,
			outlineWidth,
			outlineGlow,
			fillGlow
		};
		const nextKey = JSON.stringify(style);
		const nextTexture = textureCache
			? textureCache.acquire(nextKey, () => createLabelTexture(style))
			: createLabelTexture(style);
		releaseTexture();
		texture = nextTexture;
		textureKey = nextKey;
		material.map = nextTexture;
		material.needsUpdate = true;
		invalidate();
	});

	$effect(() => {
		material.opacity = opacity;
		invalidate();
	});

	onDestroy(() => {
		releaseTexture();
		material.dispose();
	});

	function releaseTexture(): void {
		if (textureCache && textureKey !== null) textureCache.release(textureKey);
		else texture?.dispose();
		texture = null;
		textureKey = null;
	}

	function createLabelTexture({
		text,
		color,
		outlineColor,
		fillOpacity,
		outlineOpacity,
		outlineWidth,
		outlineGlow,
		fillGlow
	}: {
		text: string;
		color: string;
		outlineColor: string;
		fillOpacity: number;
		outlineOpacity: number;
		outlineWidth: number;
		outlineGlow: number;
		fillGlow: number;
	}): CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;

		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Canvas labels require a 2D rendering context.');
		}

		const fontPixels = 154;
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.font = `600 ${fontPixels}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-ui')}`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.lineJoin = 'round';
		context.miterLimit = 2;

		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2 + fontPixels * 0.03;

		context.globalAlpha = outlineOpacity;
		context.strokeStyle = outlineColor;
		context.lineWidth = fontPixels * outlineWidth;
		context.shadowColor = outlineColor;
		context.shadowBlur = fontPixels * outlineGlow;
		context.strokeText(text, centerX, centerY);

		context.globalAlpha = fillOpacity;
		context.fillStyle = color;
		context.shadowBlur = fontPixels * fillGlow;
		context.fillText(text, centerX, centerY);

		const nextTexture = new CanvasTexture(canvas);
		nextTexture.colorSpace = SRGBColorSpace;
		nextTexture.minFilter = LinearFilter;
		nextTexture.magFilter = LinearFilter;
		nextTexture.needsUpdate = true;
		return nextTexture;
	}
</script>

<!-- Labels stay mounted and fade through opacity; a fully faded one is skipped by the renderer. -->
<T
	is={Sprite}
	args={[material]}
	{name}
	{position}
	{scale}
	{renderOrder}
	visible={fontsReady && opacity > 0.01}
/>
