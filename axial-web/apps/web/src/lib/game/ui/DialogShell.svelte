<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';

	let {
		labelledby,
		describedby,
		initialFocusSelector,
		closeOnEscape = true,
		onEscape,
		onKeydown,
		children
	}: {
		labelledby: string;
		describedby?: string;
		initialFocusSelector?: string;
		closeOnEscape?: boolean;
		onEscape?: () => void;
		onKeydown?: (event: KeyboardEvent) => void;
		children: Snippet;
	} = $props();

	let dialogElement: HTMLDialogElement;

	onMount(() => {
		const returnFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (!dialogElement.open) dialogElement.showModal();

		void tick().then(() => {
			const requested = initialFocusSelector
				? dialogElement.querySelector<HTMLElement>(initialFocusSelector)
				: null;
			const fallback = dialogElement.querySelector<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			(requested ?? fallback ?? dialogElement).focus({ preventScroll: true });
		});

		return () => {
			if (dialogElement.open) dialogElement.close();
			queueMicrotask(() => returnFocus?.focus({ preventScroll: true }));
		};
	});

	function handleCancel(event: Event): void {
		event.preventDefault();
		if (!closeOnEscape) return;
		onEscape?.();
	}

	function handleKeydown(event: KeyboardEvent): void {
		onKeydown?.(event);
		if (event.defaultPrevented || event.key !== 'Tab') return;

		const focusable = Array.from(
			dialogElement.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => element.getClientRects().length > 0);
		if (focusable.length === 0) {
			event.preventDefault();
			dialogElement.focus({ preventScroll: true });
			return;
		}

		const first = focusable[0];
		const last = focusable.at(-1)!;
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !dialogElement.contains(active))) {
			event.preventDefault();
			last.focus({ preventScroll: true });
			return;
		}
		if (!event.shiftKey && (active === last || !dialogElement.contains(active))) {
			event.preventDefault();
			first.focus({ preventScroll: true });
		}
	}
</script>

<dialog
	class="dialog-shell"
	aria-labelledby={labelledby}
	aria-describedby={describedby}
	bind:this={dialogElement}
	oncancel={handleCancel}
	onkeydown={handleKeydown}
>
	{@render children()}
</dialog>

<style>
	.dialog-shell {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 0;
		background: transparent;
		color: var(--text);
	}

	.dialog-shell::backdrop {
		background: transparent;
	}

	.dialog-shell:focus-visible {
		outline: none;
	}
</style>
