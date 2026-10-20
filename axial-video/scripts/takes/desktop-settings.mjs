// The settings panel on a fresh board: pick the AI and its strength, grow the board one click at
// a time, then switch to connect five and two or three lines to win.
import { PREFERENCES } from './matches.mjs';

export const setup = {
	viewport: { width: 1920, height: 1080 },
	deviceScaleFactor: 2,
	path: '/?tour=0',
	pointerStart: { x: 1240, y: 520 },
	storage: { ...PREFERENCES, 'axial-opponent-mode': 'local' }
};

export async function run(take) {
	const { page } = take;
	const press = async (locator, travel = 0.45, after = 0.35) => {
		await take.moveTo(take.centre(locator), travel);
		await take.hold(0.12);
		await take.click();
		await take.hold(after);
	};
	const group = (name) => page.getByRole('group', { name });

	await take.hold(0.5);
	take.mark('opponents');
	await press(group('Opponent mode').getByRole('button', { name: 'AI' }), 0.8, 0.5);
	take.mark('difficulty');
	for (const level of ['Easy', 'Med', 'Hard', 'Max']) {
		await press(group('AI strength').getByRole('button', { name: level, exact: true }), 0.3, 0.25);
	}
	await press(group('AI strength').getByRole('button', { name: 'Hard', exact: true }), 0.3, 0.6);

	take.mark('board-size');
	const dimension = (name) => page.getByRole('button', { name: new RegExp(`board ${name}`) });
	for (const [name, clicks] of [['height', 3], ['rows', 3], ['columns', 2]]) {
		for (let click = 0; click < clicks; click += 1) await press(dimension(name), click ? 0.18 : 0.4, 0.28);
	}
	await take.hold(0.6);

	take.mark('rules');
	await press(group('Connect length').getByRole('button', { name: '5', exact: true }), 0.5, 0.6);
	await press(group('Lines to win').getByRole('button', { name: '2', exact: true }), 0.4, 0.45);
	await press(group('Lines to win').getByRole('button', { name: '3', exact: true }), 0.25, 0.9);
	await take.moveTo({ x: 1250, y: 640 }, 0.8);
	await take.hold(0.8);
}
