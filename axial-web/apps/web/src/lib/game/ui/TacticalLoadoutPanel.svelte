<script lang="ts">
	import { Boxes, CopyPlus, Shield } from '@lucide/svelte';
	import type { TacticalSpecialId } from '@axial/core';
	import type { TacticalSpecialCounts } from '../state/gameController.svelte';
	import PanelLiveStrip from './PanelLiveStrip.svelte';

	let {
		statusTitle,
		specialStatus,
		activeSpecialCounts,
		selectedSpecial,
		canUseBlockerCombo,
		canUseDoubleAdjacent,
		mustCompleteBlockerCombo,
		mustCompleteDoubleAdjacent,
		onToggleBlockerCombo,
		onToggleDoubleAdjacent
	}: {
		statusTitle: string;
		specialStatus: string;
		activeSpecialCounts: TacticalSpecialCounts;
		selectedSpecial: TacticalSpecialId | null;
		canUseBlockerCombo: boolean;
		canUseDoubleAdjacent: boolean;
		mustCompleteBlockerCombo: boolean;
		mustCompleteDoubleAdjacent: boolean;
		onToggleBlockerCombo: () => void;
		onToggleDoubleAdjacent: () => void;
	} = $props();
</script>

<PanelLiveStrip label="Pieces" title={statusTitle} meta={specialStatus} />

<section class="panel-section piece-info-section">
	<div class="section-heading">
		<Boxes size={15} strokeWidth={2} />
		<span>Loadout</span>
	</div>

	<div class="piece-info-list">
		<button
			type="button"
			class:armed={selectedSpecial === 'blocker-combo' || mustCompleteBlockerCombo}
			disabled={!canUseBlockerCombo && selectedSpecial !== 'blocker-combo'}
			onclick={onToggleBlockerCombo}
		>
			<span class="piece-info-icon"><Shield size={16} strokeWidth={2.1} /></span>
			<span>
				<strong>Blocker</strong>
				<small>Place a neutral blocker, then your regular piece.</small>
			</span>
			<em>{mustCompleteBlockerCombo ? '!' : activeSpecialCounts['blocker-combo']}</em>
		</button>
		<button
			type="button"
			class:armed={selectedSpecial === 'double-adjacent' || mustCompleteDoubleAdjacent}
			disabled={!canUseDoubleAdjacent && selectedSpecial !== 'double-adjacent'}
			onclick={onToggleDoubleAdjacent}
		>
			<span class="piece-info-icon"><CopyPlus size={16} strokeWidth={2.1} /></span>
			<span>
				<strong>Double Adjacent</strong>
				<small>Place a second owned piece next to the first.</small>
			</span>
			<em>{mustCompleteDoubleAdjacent ? '!' : activeSpecialCounts['double-adjacent']}</em>
		</button>
	</div>
</section>
