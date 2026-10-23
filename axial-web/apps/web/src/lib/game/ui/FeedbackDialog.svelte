<script module lang="ts">
	type FeedbackKind = 'bug' | 'idea' | 'review';

	// Lives outside the component so closing the dialog by accident doesn't throw away a half-written report.
	const draft = $state({ kind: 'bug' as FeedbackKind, message: '', name: '', contact: '' });
</script>

<script lang="ts">
	import { Bug, CheckCircle2, Lightbulb, Send, Star, X } from '@lucide/svelte';
	import { version } from '$app/environment';
	import { sendFeedback } from '$lib/multiplayer/client';
	import { requestTurnstileToken } from '$lib/feedback/turnstile';
	import DialogShell from './DialogShell.svelte';

	let { mode, onClose }: { mode: string; onClose: () => void } = $props();

	const MIN_LENGTH = 10;
	const MAX_LENGTH = 2000;
	const KINDS: { id: FeedbackKind; label: string; icon: typeof Bug; placeholder: string }[] = [
		{
			id: 'bug',
			label: 'Bug',
			icon: Bug,
			placeholder:
				'What happened, and what did you expect? Steps to make it happen again help a lot.'
		},
		{
			id: 'idea',
			label: 'Idea',
			icon: Lightbulb,
			placeholder: 'What would make Axial better?'
		},
		{
			id: 'review',
			label: 'Review',
			icon: Star,
			placeholder: 'How was your game? Anything you loved or didn’t?'
		}
	];

	let status = $state<'idle' | 'sending' | 'sent'>('idle');
	let error = $state('');
	let honeypot = $state('');
	let turnstileContainer = $state<HTMLDivElement>();

	const trimmedLength = $derived(draft.message.trim().length);
	const placeholder = $derived(KINDS.find((kind) => kind.id === draft.kind)?.placeholder ?? '');

	function validationError(): string {
		if (trimmedLength < MIN_LENGTH) {
			return `Write at least ${MIN_LENGTH} characters so there's something to go on.`;
		}
		if (trimmedLength > MAX_LENGTH) return `Keep it under ${MAX_LENGTH} characters.`;
		const contact = draft.contact.trim();
		if (contact && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(contact)) {
			return "That email address doesn't look right. Leave it blank if you'd rather not say.";
		}
		return '';
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (status === 'sending') return;
		error = validationError();
		if (error || !turnstileContainer) return;

		status = 'sending';
		try {
			const turnstileToken = await requestTurnstileToken(turnstileContainer);
			await sendFeedback({
				kind: draft.kind,
				message: draft.message,
				name: draft.name,
				contact: draft.contact,
				turnstileToken,
				website: honeypot,
				context: {
					mode,
					viewport: `${window.innerWidth}x${window.innerHeight}`,
					build: buildLabel(version)
				}
			});
			draft.message = '';
			status = 'sent';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not send that. Try again.';
			status = 'idle';
		}
	}

	/** SvelteKit's default version is the build's epoch milliseconds; a date reads better in email. */
	function buildLabel(value: string): string {
		const stamp = Number(value);
		return Number.isFinite(stamp) && stamp > 0 ? new Date(stamp).toISOString() : value;
	}

	// Only a press that starts and ends on the backdrop closes: selecting text in the message and
	// letting go outside the card also lands a click on the backdrop.
	let pressStartedOnBackdrop = false;

	function noteBackdropPress(event: PointerEvent): void {
		pressStartedOnBackdrop = event.target === event.currentTarget;
	}

	function closeFromBackdrop(event: MouseEvent): void {
		if (pressStartedOnBackdrop && event.target === event.currentTarget) onClose();
		pressStartedOnBackdrop = false;
	}
</script>

<DialogShell
	labelledby="feedback-title"
	describedby="feedback-detail"
	initialFocusSelector={status === 'sent' ? '.feedback-done' : 'textarea'}
	onEscape={onClose}
>
	<div
		class="feedback-backdrop"
		role="presentation"
		onpointerdown={noteBackdropPress}
		onclick={closeFromBackdrop}
	>
		<section class="feedback-dialog">
			<button class="feedback-close" type="button" aria-label="Close feedback" onclick={onClose}>
				<X size={18} strokeWidth={2} />
			</button>

			{#if status === 'sent'}
				<div class="feedback-sent" role="status">
					<CheckCircle2 size={34} strokeWidth={1.7} />
					<h2 id="feedback-title">Thanks for the feedback</h2>
					<p id="feedback-detail">
						It went straight to the developer.
						{#if draft.contact.trim()}
							If a reply helps, it will go to {draft.contact.trim()}.
						{/if}
					</p>
					<button class="feedback-primary feedback-done" type="button" onclick={onClose}>
						Back to the board
					</button>
				</div>
			{:else}
				<h2 id="feedback-title">Send feedback</h2>
				<p id="feedback-detail" class="feedback-detail">
					Report a bug, suggest an idea or leave a review. It goes straight to the developer.
				</p>

				<form class="feedback-form" onsubmit={submit} novalidate>
					<div class="mode-switch feedback-kinds" role="group" aria-label="Feedback type">
						{#each KINDS as kind (kind.id)}
							<button
								type="button"
								class:selected={draft.kind === kind.id}
								aria-pressed={draft.kind === kind.id}
								onclick={() => (draft.kind = kind.id)}
							>
								<kind.icon size={14} strokeWidth={2} />
								<span>{kind.label}</span>
							</button>
						{/each}
					</div>

					<label class="feedback-field">
						<span>Message</span>
						<textarea
							name="message"
							bind:value={draft.message}
							{placeholder}
							rows="5"
							maxlength={MAX_LENGTH}
							required
						></textarea>
						<small aria-hidden="true" class:near-limit={trimmedLength > MAX_LENGTH - 100}>
							{trimmedLength}/{MAX_LENGTH}
						</small>
					</label>

					<div class="feedback-row">
						<label class="feedback-field">
							<span>Name <em>optional</em></span>
							<input name="name" bind:value={draft.name} maxlength="60" autocomplete="nickname" />
						</label>
						<label class="feedback-field">
							<span>Email <em>for a reply</em></span>
							<input
								name="email"
								bind:value={draft.contact}
								type="email"
								maxlength="120"
								autocomplete="email"
								inputmode="email"
							/>
						</label>
					</div>

					<!-- Off-screen trap for bots that fill in every field; people never see or reach it. -->
					<label class="feedback-trap" aria-hidden="true">
						Website
						<input bind:value={honeypot} name="website" tabindex="-1" autocomplete="off" />
					</label>

					<div class="feedback-turnstile" bind:this={turnstileContainer}></div>

					{#if error}
						<p class="feedback-error" role="alert">{error}</p>
					{/if}

					<button class="feedback-primary" type="submit" disabled={status === 'sending'}>
						<Send size={15} strokeWidth={2} />
						{status === 'sending' ? 'Sending…' : 'Send'}
					</button>
					<p class="feedback-fineprint">
						Your browser, screen size and game mode are included to help track down bugs. Protected
						by Cloudflare Turnstile.
					</p>
				</form>
			{/if}
		</section>
	</div>
</DialogShell>

<style>
	.feedback-backdrop {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow-y: auto;
		padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		background: color-mix(in oklab, #000 36%, transparent);
		backdrop-filter: blur(9px) saturate(1.08);
		animation: feedback-backdrop-in 220ms ease-out both;
	}

	.feedback-dialog {
		position: relative;
		width: min(28rem, 100%);
		padding: 1.1rem;
		border: 1px solid color-mix(in oklab, var(--text) 18%, transparent);
		border-radius: 1.4rem;
		background: color-mix(in oklab, var(--surface) 92%, transparent);
		color: var(--text);
		box-shadow: 0 24px 70px var(--shadow);
		animation: feedback-dialog-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	h2 {
		margin: 0 2.4rem 0.3rem 0;
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 0;
	}

	.feedback-detail,
	.feedback-sent p {
		margin: 0 0 0.9rem;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.feedback-close {
		position: absolute;
		top: 0.7rem;
		right: 0.7rem;
		display: grid;
		width: 2.3rem;
		height: 2.3rem;
		place-items: center;
		border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--surface) 50%, transparent);
		color: var(--muted);
		cursor: pointer;
	}

	.feedback-close:hover {
		color: var(--text);
		border-color: color-mix(in oklab, var(--accent) 44%, transparent);
	}

	.feedback-form {
		display: grid;
		gap: 0.75rem;
	}

	.feedback-kinds {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.feedback-kinds button {
		min-height: 2.3rem;
	}

	.feedback-field {
		position: relative;
		display: grid;
		min-width: 0;
		gap: 0.3rem;
	}

	.feedback-field span {
		color: var(--muted);
		font-size: 0.64rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.feedback-field em {
		font-style: normal;
		font-weight: 600;
		opacity: 0.7;
		text-transform: none;
	}

	.feedback-field input,
	.feedback-field textarea {
		width: 100%;
		min-width: 0;
		border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
		border-radius: 0.8rem;
		background: color-mix(in oklab, var(--surface) 42%, transparent);
		color: var(--text);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 500;
		outline: none;
	}

	.feedback-field input {
		min-height: 2.4rem;
		padding: 0 0.7rem;
	}

	.feedback-field textarea {
		min-height: 7.5rem;
		padding: 0.6rem 0.7rem 1.4rem;
		line-height: 1.45;
		resize: vertical;
	}

	.feedback-field input:focus,
	.feedback-field textarea:focus {
		border-color: color-mix(in oklab, var(--accent) 52%, transparent);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent);
	}

	.feedback-field small {
		position: absolute;
		right: 0.7rem;
		bottom: 0.45rem;
		color: var(--muted);
		font-size: 0.66rem;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.feedback-field small.near-limit {
		color: var(--solar);
	}

	.feedback-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.feedback-trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.feedback-turnstile:empty {
		display: none;
	}

	.feedback-error {
		margin: 0;
		color: var(--solar);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.feedback-primary {
		display: inline-flex;
		min-height: 2.9rem;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		border: 1px solid color-mix(in oklab, var(--accent) 42%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--accent) 24%, var(--surface));
		color: var(--text);
		cursor: pointer;
		font: inherit;
		font-size: 0.86rem;
		font-weight: 700;
		transition:
			transform var(--motion-fast) ease,
			border-color var(--motion-fast) ease;
	}

	.feedback-primary:not(:disabled):hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--accent) 60%, transparent);
	}

	.feedback-primary:disabled {
		cursor: progress;
		opacity: 0.62;
	}

	.feedback-fineprint {
		margin: -0.2rem 0 0;
		color: var(--muted);
		font-size: 0.66rem;
		line-height: 1.4;
		text-align: center;
	}

	.feedback-sent {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 0.6rem 0 0.2rem;
		text-align: center;
	}

	.feedback-sent :global(svg) {
		color: var(--accent);
	}

	.feedback-sent h2 {
		margin: 0.3rem 0 0;
	}

	.feedback-sent .feedback-primary {
		width: 100%;
	}

	.feedback-close:focus-visible,
	.feedback-primary:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--accent) 52%, transparent);
		outline-offset: 2px;
	}

	@keyframes feedback-backdrop-in {
		from {
			opacity: 0;
		}
	}

	@keyframes feedback-dialog-in {
		from {
			opacity: 0;
			transform: translateY(0.8rem) scale(0.97);
		}
	}

	/* Phones: 16px text stops iOS zooming into the field, and the name/email pair stacks. */
	@media (max-width: 720px), (hover: none) and (pointer: coarse) {
		.feedback-field input,
		.feedback-field textarea {
			font-size: 1rem;
		}

		.feedback-field input {
			min-height: var(--target-coarse);
		}

		.feedback-kinds button {
			min-height: var(--target-coarse);
		}
	}

	@media (max-width: 480px) {
		.feedback-backdrop {
			align-items: start;
		}

		.feedback-row {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.feedback-backdrop,
		.feedback-dialog {
			animation: none;
		}
	}
</style>
