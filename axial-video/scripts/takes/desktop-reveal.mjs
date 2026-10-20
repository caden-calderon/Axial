// The opening shot. A local match is restored with the camera square to the front of the board,
// so the front row reads as a flat Connect 4 rack; a piece drops into it, then the camera orbits
// up and round to show the rows behind.
import { CLASSIC, PREFERENCES, REVEAL, savedMatch } from './matches.mjs';

// Front view: from the default camera (azimuth 0.55 rad, polar 1.09 rad) to the board's front
// face (azimuth -0.34, level). Orbit is 2π · 0.52 / 1080 rad per pixel.
const SQUARE_DX = Number(process.env.SQUARE_DX ?? 295);
const SQUARE_DY = Number(process.env.SQUARE_DY ?? -158);
const SQUARE_ZOOM = Number(process.env.SQUARE_ZOOM ?? 0);

export const setup = {
	viewport: { width: 1920, height: 1080 },
	deviceScaleFactor: 2,
	path: '/?tour=0',
	pointerStart: { x: 1500, y: 300 },
	storage: {
		...PREFERENCES,
		// Square to the front, both Z scales and the Y labels stack up beside the rack.
		'axial-axis-labels': 'false',
		'axial-opponent-mode': 'local',
		'axial-active-match': savedMatch({ moves: REVEAL.slice(0, -1), ...CLASSIC })
	}
};

export async function run(take) {
	const { page } = take;
	await take.offCamera(async () => {
		await take.moveTo(take.centre(page.getByRole('button', { name: 'Collapse settings' })), 0.2);
		await take.click();
		await take.moveTo({ x: 1500, y: 900 }, 0.2);
		await take.drag(SQUARE_DX, SQUARE_DY, 0.6);
		if (SQUARE_ZOOM) await take.wheel(SQUARE_ZOOM, 0.3);
		await take.moveTo({ x: 1560, y: 760 }, 0.2);
		await take.hold(1.5);
	});

	await take.hold(0.6);
	const [row, col] = REVEAL.at(-1);
	await take.moveTo(take.cell(row, col), 0.7);
	await take.hold(0.15);
	take.mark('drop');
	await take.click();
	// Off the board, so the drop preview clears; room for two title lines before the view turns.
	await take.moveTo({ x: 1640, y: 900 }, 0.6);
	await take.hold(2.2);
	take.mark('reveal');
	await take.moveTo({ x: 1380, y: 840 }, 0.35);
	await take.drag(Number(process.env.REVEAL_DX ?? -300), Number(process.env.REVEAL_DY ?? 60), 2.6);
	await take.hold(1.4);
	take.mark('end');
}
