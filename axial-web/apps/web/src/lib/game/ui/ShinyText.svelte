<script lang="ts">
	type ShineDirection = 'left' | 'right';

	let {
		text,
		disabled = false,
		speed = 7.2,
		delay = 0.18,
		color = 'currentColor',
		shineColor = 'var(--accent)',
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
	<span class="shiny-base">{text}</span>
	<span class="shiny-overlay" aria-hidden="true">{text}</span>
</span>

<style>
	.shiny-text {
		display: inline-grid;
		max-width: 100%;
		overflow: hidden;
		color: var(--shiny-base);
		text-overflow: ellipsis;
		text-shadow: none;
		white-space: inherit;
	}

	.shiny-base,
	.shiny-overlay {
		grid-area: 1 / 1;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: inherit;
	}

	.shiny-base {
		color: var(--shiny-base);
	}

	.shiny-overlay {
		background-image: linear-gradient(
			var(--shiny-spread),
			transparent 0%,
			transparent 42%,
			color-mix(in oklab, var(--shiny-shine) 72%, transparent) 47%,
			var(--shiny-shine) 50%,
			color-mix(in oklab, var(--shiny-shine) 72%, transparent) 53%,
			transparent 58%,
			transparent 100%
		);
		background-position: 150% center;
		background-size: 220% auto;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		pointer-events: none;
		-webkit-text-fill-color: transparent;
		will-change: background-position;
		animation: shiny-text-sweep var(--shiny-cycle) linear infinite;
		animation-direction: var(--shiny-direction);
	}

	.shiny-text[data-pause-on-hover='true']:hover {
		animation-play-state: paused;
	}

	.shiny-text[data-pause-on-hover='true']:hover .shiny-overlay {
		animation-play-state: paused;
	}

	.shiny-text[data-disabled='true'] {
		color: var(--shiny-base);
	}

	.shiny-text[data-disabled='true'] .shiny-overlay {
		display: none;
	}

	@keyframes shiny-text-sweep {
		0% {
			background-position: 150% center;
		}

		88% {
			background-position: -50% center;
		}

		100% {
			background-position: -50% center;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shiny-overlay {
			display: none;
		}
	}
</style>
