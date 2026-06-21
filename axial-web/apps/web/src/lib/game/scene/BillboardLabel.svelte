<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T } from '@threlte/core';
	import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';
	import type { Vec3 } from './geometry';

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
		renderOrder = 9
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
	} = $props();

	const material = new SpriteMaterial({
		depthTest: false,
		depthWrite: false,
		transparent: true,
		toneMapped: false
	});

	let texture: CanvasTexture | null = null;
	const scale = $derived([fontSize * 1.34, fontSize * 1.34, 1] as Vec3);

	$effect(() => {
		const nextTexture = createLabelTexture({
			text,
			color,
			outlineColor,
			fillOpacity,
			outlineOpacity,
			outlineWidth,
			outlineGlow,
			fillGlow
		});
		const previousTexture = texture;
		texture = nextTexture;
		material.map = nextTexture;
		material.needsUpdate = true;
		previousTexture?.dispose();
	});

	$effect(() => {
		material.opacity = opacity;
		material.needsUpdate = true;
	});

	onDestroy(() => {
		texture?.dispose();
		material.dispose();
	});

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
		context.font = `640 ${fontPixels}px Inter, ui-sans-serif, system-ui, sans-serif`;
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

<T is={Sprite} args={[material]} {position} {scale} {renderOrder} />
