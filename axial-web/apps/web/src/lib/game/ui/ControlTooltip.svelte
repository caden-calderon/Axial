<script lang="ts">
	import { onMount, tick } from 'svelte';

	const id = 'control-tooltip';
	let tooltip: HTMLDivElement;
	let text = $state('');
	let shown = $state(false);
	let left = $state(0);
	let top = $state(0);
	let anchor: HTMLElement | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function dismiss(): void {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		if (anchor) {
			const descriptions = (anchor.getAttribute('aria-describedby') ?? '')
				.split(/\s+/)
				.filter((value) => value && value !== id);
			if (descriptions.length) anchor.setAttribute('aria-describedby', descriptions.join(' '));
			else anchor.removeAttribute('aria-describedby');
		}
		anchor = null;
		shown = false;
		text = '';
	}

	async function reveal(target: HTMLElement): Promise<void> {
		if (anchor !== target || !target.isConnected || document.querySelector('dialog[open]')) return;
		left = 0;
		top = 0;
		text = target.dataset.tooltip ?? '';
		await tick();
		if (anchor !== target || !text) return;
		const bounds = target.getBoundingClientRect();
		const tip = tooltip.getBoundingClientRect();
		left = Math.max(
			8,
			Math.min(bounds.left + (bounds.width - tip.width) / 2, window.innerWidth - tip.width - 8)
		);
		top = bounds.bottom + 8;
		if (top + tip.height > window.innerHeight - 8) top = Math.max(8, bounds.top - tip.height - 8);
		const descriptions = target.getAttribute('aria-describedby');
		target.setAttribute('aria-describedby', descriptions ? `${descriptions} ${id}` : id);
		shown = true;
	}

	function enter(event: PointerEvent | FocusEvent): void {
		if (event instanceof PointerEvent && event.pointerType === 'touch') return;
		const target =
			event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip]') : null;
		if (!target || !target.closest('.game-shell') || target === anchor) return;
		if (event instanceof FocusEvent && !target.matches(':focus-visible')) return;
		dismiss();
		anchor = target;
		if (event instanceof FocusEvent) void reveal(target);
		else
			timer = setTimeout(() => {
				timer = null;
				void reveal(target);
			}, 600);
	}

	function leave(event: PointerEvent | FocusEvent): void {
		if (anchor && event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget))
			return;
		dismiss();
	}

	onMount(() => {
		const controller = new AbortController();
		const options = { signal: controller.signal, capture: true };
		document.addEventListener('pointerover', enter, options);
		document.addEventListener('pointerout', leave, options);
		// Removing focused tutorial content can dispatch blur during Svelte's render.
		// Handle focus changes after that render before updating tooltip state.
		document.addEventListener('focusin', (event) => queueMicrotask(() => enter(event)), options);
		document.addEventListener('focusout', (event) => queueMicrotask(() => leave(event)), options);
		document.addEventListener('pointerdown', dismiss, options);
		document.addEventListener('scroll', dismiss, options);
		document.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'Escape') dismiss();
			},
			options
		);
		window.addEventListener('resize', dismiss, options);
		return () => {
			controller.abort();
			dismiss();
		};
	});
</script>

<div
	bind:this={tooltip}
	{id}
	role="tooltip"
	hidden={!text}
	style:visibility={shown ? 'visible' : 'hidden'}
	style:left={`${left}px`}
	style:top={`${top}px`}
>
	{text}
</div>

<style>
	div {
		position: fixed;
		z-index: 20;
		max-width: min(16rem, calc(100vw - 1rem));
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 6px 20px var(--shadow);
		font: 500 0.75rem / 1.4 var(--font-ui);
		text-align: center;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}
</style>
