<script lang="ts">
	import { Trophy } from '@lucide/svelte';
	import type { OpponentMode } from '../state/gameController.svelte';
	import type { SessionRecord } from '../state/sessionRecord';

	let {
		sessionRecord,
		opponentMode
	}: {
		sessionRecord: SessionRecord;
		opponentMode: OpponentMode;
	} = $props();
</script>

<section class="panel-section session-section">
	<div class="section-heading">
		<Trophy size={15} strokeWidth={2} />
		<span>Session</span>
	</div>

	<div class="record-grid">
		<div>
			<strong>{sessionRecord.playerOneWins}</strong>
			<span>{opponentMode === 'ai' ? 'You' : 'P1'}</span>
		</div>
		<div>
			<strong>{sessionRecord.playerTwoWins}</strong>
			<span>{opponentMode === 'ai' ? 'AI' : 'P2'}</span>
		</div>
		<div>
			<strong>{sessionRecord.draws}</strong>
			<span>Draw</span>
		</div>
	</div>
</section>
