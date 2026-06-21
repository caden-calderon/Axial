<script lang="ts">
	import { onMount } from 'svelte';

	let {
		text,
		shineText = '',
		onComplete = () => {}
	}: {
		text: string;
		shineText?: string;
		onComplete?: () => void;
	} = $props();

	const initialDelayMs = 120;

	let visibleLength = $state(0);
	let settled = $state(false);
	let rafId = 0;
	let startTime = 0;

	const shineStart = $derived(shineText ? text.indexOf(shineText) : -1);
	const shineEnd = $derived(shineStart >= 0 ? shineStart + shineText.length : -1);
	const beforeShine = $derived(shineStart >= 0 ? text.slice(0, shineStart) : text);
	const visibleBeforeShine = $derived(
		beforeShine.slice(0, Math.min(visibleLength, beforeShine.length))
	);
	const visibleShine = $derived(
		shineStart >= 0 && visibleLength > shineStart
			? shineText.slice(0, Math.min(visibleLength - shineStart, shineText.length))
			: ''
	);
	const visibleAfterShine = $derived(
		shineEnd >= 0 && visibleLength > shineEnd ? text.slice(shineEnd, visibleLength) : ''
	);
	const characterTimes = $derived(buildCharacterTimes(text, shineStart));
	const hasShineText = $derived(shineText.length > 0);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			finishTyping();
			return;
		}

		rafId = requestAnimationFrame(typeFrame);

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	});

	function typeFrame(timestamp: number): void {
		if (startTime === 0) startTime = timestamp;

		const elapsed = timestamp - startTime;
		visibleLength = characterTimes.findIndex((time) => elapsed < time);
		if (visibleLength === -1) visibleLength = text.length;

		if (visibleLength >= text.length) {
			finishTyping();
			return;
		}

		rafId = requestAnimationFrame(typeFrame);
	}

	function finishTyping(): void {
		if (settled) return;
		visibleLength = text.length;
		settled = true;
		onComplete();
	}

	function buildCharacterTimes(value: string, shineIndex: number): number[] {
		let elapsed = initialDelayMs;

		return Array.from(value, (character, index) => {
			elapsed += getCharacterDelay(character, index, shineIndex);
			return elapsed;
		});
	}

	function getCharacterDelay(character: string, index: number, shineIndex: number): number {
		if (character === ' ') return 64;
		if (shineIndex >= 0 && index >= shineIndex) return 46;
		return 36 + (index % 3) * 5;
	}
</script>

<span class="typed-title" aria-hidden="true">
	<span>{visibleBeforeShine}</span>
	{#if visibleShine}
		<span class="typed-shine" class:has-shine={hasShineText} data-text={visibleShine}>
			{visibleShine}
		</span>
	{/if}
	{#if visibleAfterShine}
		<span>{visibleAfterShine}</span>
	{/if}
	<span class="typed-cursor" class:settled aria-hidden="true"></span>
</span>

<style>
	.typed-title {
		display: inline;
		white-space: pre-wrap;
	}

	.typed-shine {
		position: relative;
		display: inline-block;
		color: var(--text);
		text-shadow: none;
	}

	.typed-shine::after {
		position: absolute;
		inset: 0;
		background-image: linear-gradient(
			112deg,
			transparent 0%,
			transparent 42%,
			color-mix(in oklab, var(--accent) 72%, transparent) 47%,
			var(--accent) 51%,
			color-mix(in oklab, var(--accent) 72%, transparent) 55%,
			transparent 60%,
			transparent 100%
		);
		background-position: 135% center;
		background-size: 220% auto;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		content: attr(data-text);
		pointer-events: none;
		text-shadow: none;
		-webkit-text-fill-color: transparent;
		animation: typed-shine-sweep 7.38s linear 0.18s infinite;
	}

	.typed-shine.has-shine::after {
		background-image: linear-gradient(
			112deg,
			transparent 0%,
			transparent 40%,
			color-mix(in oklab, var(--accent) 72%, transparent) 46%,
			var(--accent) 51%,
			color-mix(in oklab, var(--accent) 72%, transparent) 56%,
			transparent 62%,
			transparent 100%
		);
	}

	.typed-cursor {
		display: inline-block;
		width: 0.075em;
		height: 0.82em;
		margin-left: 0.1em;
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 78%, var(--text));
		box-shadow: 0 0 0.5em color-mix(in oklab, var(--accent) 32%, transparent);
		transform: translateY(0.08em);
		animation: typed-cursor-blink 820ms steps(2, jump-none) infinite;
	}

	.typed-cursor.settled {
		display: none;
		animation: none;
	}

	@keyframes typed-shine-sweep {
		0% {
			background-position: 135% center;
		}

		88%,
		100% {
			background-position: -45% center;
		}
	}

	@keyframes typed-cursor-blink {
		0%,
		48% {
			opacity: 1;
		}

		52%,
		100% {
			opacity: 0.18;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.typed-shine::after,
		.typed-cursor {
			animation: none;
		}
	}
</style>
