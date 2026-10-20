// Three lines to win, restored one move from the end: both players have scored, and blue's third line wins it.
import { THREE_LINES, THREE_LINE_RACE, PREFERENCES, playMoves, savedMatch } from './matches.mjs';

export const setup = {
	viewport: { width: 1920, height: 1080 },
	deviceScaleFactor: 2,
	path: '/?tour=0',
	pointerStart: { x: 1500, y: 300 },
	storage: {
		...PREFERENCES,
		'axial-opponent-mode': 'local',
		'axial-active-match': savedMatch({ moves: THREE_LINE_RACE.slice(0, -1), ...THREE_LINES })
	}
};

export async function run(take) {
	const { page } = take;
	await take.moveTo(take.centre(page.getByRole('button', { name: 'Collapse settings' })), 0.5);
	await take.click();
	await take.moveTo({ x: 1180, y: 840 }, 0.5);
	await take.drag(Number(process.env.ORBIT_DX ?? 200), Number(process.env.ORBIT_DY ?? 90), 1.1);
	take.mark('final-move');
	await playMoves(take, THREE_LINE_RACE.slice(-1), { travel: 0.8, settle: 0.35, after: 0 });
	await take.hold(2.6);
	take.mark('result');
	// Keep the board, then take a slow look around the finished position.
	await take.moveTo(take.centre(page.getByRole('button', { name: /keep board/i })), 0.7);
	await take.hold(0.15);
	await take.click();
	await take.hold(0.4);
	await take.moveTo({ x: 1250, y: 860 }, 0.5);
	await take.drag(-420, 0, 2.6);
	await take.hold(0.8);
}
