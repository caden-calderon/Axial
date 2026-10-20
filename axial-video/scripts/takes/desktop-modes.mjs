// Who you play: the opponent switch (Local, Online, AI), the AI's four strengths, then a move
// against it with the panel collapsed and the AI's reply.
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
	const opponent = (name) => group('Opponent mode').getByRole('button', { name, exact: true });

	await take.hold(0.4);
	take.mark('modes');
	await take.moveTo(take.centre(opponent('Local')), 0.7);
	await take.hold(0.5);
	take.mark('online');
	await press(opponent('Online'), 0.45, 0.7);
	take.mark('ai');
	await press(opponent('AI'), 0.4, 0.5);

	take.mark('difficulty');
	for (const level of ['Easy', 'Med', 'Hard', 'Max']) {
		await press(group('AI strength').getByRole('button', { name: level, exact: true }), 0.3, 0.25);
	}
	await press(group('AI strength').getByRole('button', { name: 'Hard', exact: true }), 0.3, 0.5);

	take.mark('collapse');
	await press(page.getByRole('button', { name: 'Collapse settings' }), 0.5, 0.4);
	const before = await take.moveCount();
	await take.moveTo(take.cell(3, 3), 0.8);
	await take.hold(0.3);
	take.mark('drop');
	await take.click();
	await take.until((count) => JSON.parse(localStorage.getItem('axial-active-match') ?? '{}').moveHistory?.length >= count, before + 2, 8);
	take.mark('reply');
	await take.moveTo({ x: 1500, y: 860 }, 0.8);
	await take.hold(1.2);
}
