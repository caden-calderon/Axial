<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	onMount(() => {
		void goto(resolve('/?online=1'), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Axial Online</title>
</svelte:head>

<main class="room-redirect" aria-live="polite">Opening Axial online...</main>

<style>
	.room-redirect {
		min-height: 100svh;
		display: grid;
		place-items: center;
		background: #070a0d;
		color: #ecf8f3;
		font:
			800 0.95rem Inter,
			ui-sans-serif,
			system-ui;
	}
</style>
