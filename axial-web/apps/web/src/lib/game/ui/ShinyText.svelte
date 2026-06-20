<script lang="ts">
	type ShineDirection = 'left' | 'right';

	let {
		text,
		disabled = false,
		speed = 7.2,
		delay = 0.18,
		color = 'currentColor',
		shineColor = '#ffffff',
		spread = 112,
		yoyo = false,
		pauseOnHover = false,
		direction = 'left',
		ariaHidden = false
	}: {
		text: string;
		disabled?: boolean;
		speed?: number;
		delay?: number;
		color?: string;
		shineColor?: string;
		spread?: number;
		yoyo?: boolean;
		pauseOnHover?: boolean;
		direction?: ShineDirection;
		ariaHidden?: boolean;
	} = $props();

	const cycleSeconds = $derived(Math.max(0.2, speed) + Math.max(0, delay));
	const animationDirection = $derived(
		yoyo
			? direction === 'left'
				? 'alternate'
				: 'alternate-reverse'
			: direction === 'left'
				? 'normal'
				: 'reverse'
	);
	const style = $derived(
		[
			`--shiny-base: ${color}`,
			`--shiny-shine: ${shineColor}`,
			`--shiny-spread: ${spread}deg`,
			`--shiny-cycle: ${cycleSeconds}s`,
			`--shiny-direction: ${animationDirection}`
		].join('; ')
	);
</script>

<span
	class="shiny-text"
	data-disabled={disabled ? 'true' : undefined}
	data-pause-on-hover={pauseOnHover ? 'true' : undefined}
	aria-hidden={ariaHidden ? 'true' : undefined}
	{style}
>
	{text}
</span>

<style>
	.shiny-text {
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		background-image: linear-gradient(
			var(--shiny-spread),
			var(--shiny-base) 0%,
			var(--shiny-base) 33%,
			var(--shiny-shine) 50%,
			var(--shiny-base) 67%,
			var(--shiny-base) 100%
		);
		background-position: 150% center;
		background-size: 200% auto;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		text-overflow: ellipsis;
		text-shadow: none;
		-webkit-text-fill-color: transparent;
		white-space: inherit;
		will-change: background-position;
		animation: shiny-text-sweep var(--shiny-cycle) linear infinite;
		animation-direction: var(--shiny-direction);
	}

	.shiny-text[data-pause-on-hover='true']:hover {
		animation-play-state: paused;
	}

	.shiny-text[data-disabled='true'] {
		background-image: none;
		color: var(--shiny-base);
		-webkit-text-fill-color: currentColor;
		animation: none;
	}

	@keyframes shiny-text-sweep {
		0% {
			background-position: 150% center;
		}

		97.5% {
			background-position: -50% center;
		}

		100% {
			background-position: -50% center;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shiny-text {
			background-image: none;
			color: var(--shiny-base);
			-webkit-text-fill-color: currentColor;
			animation: none;
		}
	}
</style>
