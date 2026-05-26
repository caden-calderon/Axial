<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import type { Player } from '@axial/core';

	let {
		currentLabel,
		currentPlayer
	}: {
		currentLabel: string;
		currentPlayer: Player | null;
	} = $props();
</script>

<header class="hud top-left">
	<div class="brand-lockup">
		<Sparkles size={18} strokeWidth={1.8} />
		<span>Axial</span>
	</div>
	<div class="turn-chip" data-player={currentPlayer ?? undefined}>
		{currentLabel}
	</div>
</header>
