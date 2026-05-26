<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { SCENE_THEME_OPTIONS, type SceneThemeName } from '../theming/sceneThemes';

	let {
		value,
		onChange
	}: {
		value: SceneThemeName;
		onChange: (theme: SceneThemeName) => void;
	} = $props();
</script>

<div class="scene-selector" role="group" aria-label="Scene">
	{#each SCENE_THEME_OPTIONS as option (option.value)}
		{@const selected = value === option.value}
		<button
			type="button"
			class:selected
			style={`--swatch: ${option.accent}`}
			aria-pressed={selected}
			onclick={() => onChange(option.value)}
		>
			<span class="scene-swatch"></span>
			<span>{option.label}</span>
			{#if selected}
				<Check size={14} strokeWidth={2.2} />
			{/if}
		</button>
	{/each}
</div>
