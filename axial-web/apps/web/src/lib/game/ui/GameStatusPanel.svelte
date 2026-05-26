<script lang="ts">
	import { ChevronUp, Moon, RotateCcw, Sun } from '@lucide/svelte';
	import type { SceneThemeName, UiThemeName } from '../theming/sceneThemes';
	import SceneSelector from './SceneSelector.svelte';

	let {
		arenaLabel,
		statusTitle,
		moveCount,
		sceneTheme,
		uiTheme,
		labelsVisible,
		moveError,
		onReset,
		onSceneThemeChange,
		onToggleLabels,
		onToggleTheme
	}: {
		arenaLabel: string;
		statusTitle: string;
		moveCount: number;
		sceneTheme: SceneThemeName;
		uiTheme: UiThemeName;
		labelsVisible: boolean;
		moveError: string;
		onReset: () => void;
		onSceneThemeChange: (theme: SceneThemeName) => void;
		onToggleLabels: () => void;
		onToggleTheme: () => void;
	} = $props();

	let expanded = $state(true);
</script>

<section class="control-panel" class:collapsed={!expanded}>
	<div class="panel-toolbar">
		<button
			class="icon-button"
			type="button"
			aria-label="Reset game"
			title="Reset game"
			onclick={onReset}
		>
			<RotateCcw size={18} strokeWidth={1.9} />
		</button>
		<button
			class="icon-button"
			type="button"
			aria-label={uiTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			title={uiTheme === 'dark' ? 'Light mode' : 'Dark mode'}
			onclick={onToggleTheme}
		>
			{#if uiTheme === 'dark'}
				<Sun size={18} strokeWidth={1.9} />
			{:else}
				<Moon size={18} strokeWidth={1.9} />
			{/if}
		</button>
		<button
			class="icon-button collapse-button"
			type="button"
			aria-label={expanded ? 'Collapse settings' : 'Expand settings'}
			aria-expanded={expanded}
			title={expanded ? 'Collapse' : 'Expand'}
			onclick={() => (expanded = !expanded)}
		>
			<ChevronUp size={18} strokeWidth={1.9} />
		</button>
	</div>

	{#if expanded}
		<div class="panel-body">
			<div>
				<p class="eyebrow">{arenaLabel}</p>
				<h1>{statusTitle}</h1>
			</div>

			<div class="stats-grid">
				<div>
					<span>{moveCount}</span>
					<small>Moves</small>
				</div>
				<div>
					<span>{sceneTheme}</span>
					<small>Scene</small>
				</div>
			</div>

			<SceneSelector value={sceneTheme} onChange={onSceneThemeChange} />

			<div class="settings-stack">
				<label class="toggle-row">
					<span>Axis numbers</span>
					<input
						type="checkbox"
						checked={labelsVisible}
						aria-label="Toggle axis numbers"
						onchange={() => onToggleLabels()}
					/>
				</label>
			</div>

			{#if moveError}
				<p class="move-error">{moveError}</p>
			{/if}
		</div>
	{/if}
</section>
