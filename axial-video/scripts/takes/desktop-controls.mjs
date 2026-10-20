// Desktop controls against the real AI on a match already under way: aim (the preview follows),
// click to drop, the AI replies, drag to orbit, scroll to zoom.
import { CLASSIC, CLASSIC_FORK, PREFERENCES, savedMatch } from './matches.mjs';

// The staged match after 16 moves; move 17 is orange's next staged move, and the staging means
// the AI has no win to reply with.
const RESTORE_AT = 16;

export const setup = {
	viewport: { width: 1920, height: 1080 },
	deviceScaleFactor: 2,
	path: '/?tour=0',
	pointerStart: { x: 1500, y: 300 },
	storage: {
		...PREFERENCES,
		'axial-opponent-mode': 'ai',
		'axial-ai-difficulty': 'medium',
		'axial-active-match': savedMatch({ moves: CLASSIC_FORK.slice(0, RESTORE_AT), ...CLASSIC, opponentMode: 'ai' })
	}
};

export async function run(take) {
	const { page } = take;
	await take.offCamera(async () => {
		await take.moveTo(take.centre(page.getByRole('button', { name: 'Collapse settings' })), 0.2);
		await take.click();
		await take.moveTo({ x: 1500, y: 860 }, 0.2);
		await take.hold(1.2);
	});

	await take.hold(0.4);
	const [row, col] = CLASSIC_FORK[RESTORE_AT];
	take.mark('aim');
	await take.moveTo(take.cell(row, (col + 2) % 7), 0.7);
	await take.moveTo(take.cell(row, col), 0.5);
	await take.hold(0.35);
	take.mark('drop');
	await take.click();
	await take.until((count) => JSON.parse(localStorage.getItem('axial-active-match') ?? '{}').moveHistory?.length >= count, RESTORE_AT + 2, 8);
	take.mark('reply');
	await take.hold(0.5);

	take.mark('orbit');
	await take.moveTo({ x: 1180, y: 760 }, 0.45);
	await take.drag(-520, -40, 1.9);
	await take.hold(0.3);
	take.mark('zoom');
	await take.wheel(-1300, 1.1);
	await take.hold(1.4);
}
