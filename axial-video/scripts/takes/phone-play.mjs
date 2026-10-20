// Phone, portrait, against the AI on a match already under way: turn the board with a drag, tap
// to aim, tap Drop, the AI replies.
import { CLASSIC, CLASSIC_FORK, PREFERENCES, savedMatch } from './matches.mjs';

// The staged match after 20 moves; move 21 is orange's next staged move and leaves the AI no win.
const RESTORE_AT = 20;

export const setup = {
	viewport: { width: 414, height: 736 },
	deviceScaleFactor: 3,
	touch: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	path: '/?tour=0',
	pointerStart: { x: 300, y: 600 },
	storage: {
		...PREFERENCES,
		'axial-opponent-mode': 'ai',
		'axial-ai-difficulty': 'medium',
		'axial-active-match': savedMatch({ moves: CLASSIC_FORK.slice(0, RESTORE_AT), ...CLASSIC, opponentMode: 'ai' })
	}
};

export async function run(take) {
	const { page } = take;
	await take.hold(0.5);
	take.mark('orbit');
	await take.moveTo({ x: 300, y: 520 }, 0.3);
	await take.drag(-110, 8, 1.2);
	await take.hold(0.3);

	const [row, col] = CLASSIC_FORK[RESTORE_AT];
	await take.moveTo(take.cell(row, col), 0.4);
	take.mark('aim');
	await take.tap();
	await take.hold(0.6);
	await take.moveTo(take.centre(page.getByRole('button', { name: 'Drop selected move' })), 0.45);
	take.mark('drop');
	await take.tap();
	await take.until((count) => JSON.parse(localStorage.getItem('axial-active-match') ?? '{}').moveHistory?.length >= count, RESTORE_AT + 2, 8);
	take.mark('reply');
	await take.hold(1.4);
}
