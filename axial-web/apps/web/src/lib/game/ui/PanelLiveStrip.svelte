<script lang="ts">
	let {
		label,
		title,
		meta
	}: {
		label: string;
		title: string;
		meta: string;
	} = $props();
</script>

<div class="live-strip" aria-live="polite">
	<div>
		<span>{label}</span>
		<strong>{title}</strong>
	</div>
	<small>{meta}</small>
</div>
