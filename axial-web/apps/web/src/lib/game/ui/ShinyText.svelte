<script lang="ts">
	type ShineDirection = 'left' | 'right';

	let {
		text,
		disabled = false,
		speed = 6.8,
		delay = 0.25,
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
			var(--shiny-base) 18%,
			color-mix(in oklab, var(--shiny-shine) 58%, var(--shiny-base)) 32%,
			color-mix(in oklab, var(--shiny-shine) 88%, var(--shiny-base)) 42%,
			var(--shiny-shine) 50%,
			color-mix(in oklab, var(--shiny-shine) 88%, var(--shiny-base)) 58%,
			color-mix(in oklab, var(--shiny-shine) 58%, var(--shiny-base)) 68%,
			var(--shiny-base) 82%,
			var(--shiny-base) 100%
		);
		background-position: 132% center;
		background-size: 235% auto;
		-webkit-background-clip: text;
		background-clip: text;
		color: var(--shiny-base);
		text-overflow: ellipsis;
		-webkit-text-fill-color: transparent;
		white-space: inherit;
		animation: shiny-text-sweep var(--shiny-cycle) cubic-bezier(0.42, 0, 0.24, 1) infinite;
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
			background-position: 132% center;
			filter: drop-shadow(0 0 0 transparent);
		}

		44% {
			filter: drop-shadow(0 0 9px color-mix(in oklab, var(--shiny-shine) 24%, transparent));
		}

		86% {
			background-position: -42% center;
			filter: drop-shadow(0 0 0 transparent);
		}

		100% {
			background-position: -42% center;
			filter: drop-shadow(0 0 0 transparent);
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
