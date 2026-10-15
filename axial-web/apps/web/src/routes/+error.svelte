<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? 'This square isn’t on the board' : 'Something went wrong');
	const detail = $derived(
		notFound
			? 'The link may be mistyped or out of date.'
			: 'Axial couldn’t load this page. Try again from the start.'
	);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Error'} · Axial</title>
</svelte:head>

<main class="error-page">
	<section class="error-card" aria-labelledby="error-title">
		<p class="error-brand">AXIAL <span>{page.status}</span></p>
		<h1 id="error-title">{title}</h1>
		<p class="error-detail">{detail}</p>
		<a class="error-action" href={resolve('/')}>Play Axial</a>
	</section>
</main>

<style>
	.error-page {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));
		background:
			radial-gradient(
				circle at 50% 38%,
				color-mix(in oklab, #a88cff 12%, transparent),
				transparent 58%
			),
			#070a0d;
		color: #ecf8f3;
	}

	.error-card {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		max-width: 26rem;
		text-align: center;
	}

	.error-brand {
		margin: 0;
		color: #8fa29b;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.32em;
	}

	.error-brand span {
		margin-left: 0.5em;
		color: #a88cff;
		font-variant-numeric: tabular-nums;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.4rem, 5vw, 1.9rem);
		font-weight: 700;
		line-height: 1.15;
		text-wrap: balance;
	}

	.error-detail {
		margin: 0;
		color: #92aca4;
		font-size: 0.95rem;
		line-height: 1.5;
		text-wrap: pretty;
	}

	.error-action {
		display: inline-grid;
		min-height: 2.75rem;
		place-items: center;
		margin-top: 0.4rem;
		padding: 0 1.4rem;
		border: 1px solid color-mix(in oklab, #a88cff 52%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, #a88cff 22%, #101719);
		color: #ecf8f3;
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
		transition: background-color 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.error-action:hover {
		background: color-mix(in oklab, #a88cff 34%, #101719);
	}

	.error-action:focus-visible {
		outline: 2px solid #a88cff;
		outline-offset: 3px;
	}
</style>
