// Illustrative MediaPipe-style hand landmarks (21 points), wrist at the origin, y pointing down.
// Units are "hand units"; HAND_SCALE converts them to normalized image coordinates.
export const OPEN_HAND = [
	[0, 0],
	[-0.28, -0.1], [-0.5, -0.22], [-0.66, -0.34], [-0.8, -0.44],
	[-0.22, -0.62], [-0.26, -0.92], [-0.28, -1.1], [-0.3, -1.26],
	[-0.02, -0.66], [-0.02, -0.99], [-0.02, -1.19], [-0.02, -1.36],
	[0.17, -0.61], [0.2, -0.9], [0.22, -1.08], [0.23, -1.23],
	[0.33, -0.52], [0.4, -0.74], [0.44, -0.88], [0.47, -1.01]
];

// Same palm (wrist and base knuckles unchanged), fingers curled into a fist.
export const FIST = [
	[0, 0],
	[-0.28, -0.12], [-0.42, -0.32], [-0.36, -0.48], [-0.18, -0.54],
	[-0.22, -0.62], [-0.25, -0.8], [-0.22, -0.64], [-0.19, -0.52],
	[-0.02, -0.66], [-0.02, -0.84], [0, -0.66], [0.01, -0.53],
	[0.17, -0.61], [0.19, -0.78], [0.19, -0.61], [0.19, -0.5],
	[0.33, -0.52], [0.37, -0.67], [0.36, -0.54], [0.33, -0.45]
];

export const BONES = [
	[0, 1], [1, 2], [2, 3], [3, 4],
	[0, 5], [5, 6], [6, 7], [7, 8],
	[5, 9], [9, 10], [10, 11], [11, 12],
	[9, 13], [13, 14], [14, 15], [15, 16],
	[13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

export const PALM_POINTS = [0, 5, 9, 13, 17];
export const WRIST = 0;
export const INDEX_BASE = 5;
export const MIDDLE_BASE = 9;
export const PINKY_BASE = 17;
export const MIDDLE_TIP = 12;

// Normalized image size of one hand unit, horizontally, at a comfortable mid-range distance.
// MediaPipe normalizes x by image width and y by image height, so on the 1280 x 720 webcam the
// same length reads 16/9 larger vertically. Together these reproduce the neutral hand measured in
// HandTracker3D_Documentation.md: index-to-pinky width 0.0585, wrist-to-middle-knuckle 0.1241.
export const HAND_SCALE = 0.106;
export const IMAGE_ASPECT = 16 / 9;

export function rotate(points, degrees) {
	const r = (degrees * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

// Squashes a pose about the wrist, as a camera sees a hand turned away (x) or tipped toward it (y).
export function foreshorten(points, sx, sy) {
	return points.map(([x, y]) => [x * sx, y * sy]);
}

const inverseLerp = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));

// Mirrors HandTracker3D.CalculateHandSize (PalmMaxDimension), including its normalization ranges.
export function palmMax(points, scale = HAND_SCALE) {
	const p = (i) => [points[i][0] * scale, points[i][1] * scale * IMAGE_ASPECT];
	const [ix, iy] = p(INDEX_BASE);
	const [px, py] = p(PINKY_BASE);
	const [wx, wy] = p(WRIST);
	const [mx, my] = p(MIDDLE_BASE);
	const x = inverseLerp(0.03, 0.12, Math.abs(ix - px));
	const y = inverseLerp(0.01, 0.15, Math.abs(iy - py));
	const h = inverseLerp(0.06, 0.2, Math.hypot(wx - mx, wy - my));
	return { x, y, h, max: Math.max(x, y, h) };
}

// The tops of HandTracker3D.cs's normalization ranges (width 0.12, height 0.15, palm length 0.20),
// converted to hand units: x is normalized by image width and y by image height, so vertical
// lengths read IMAGE_ASPECT larger. Palm length is converted as vertical, the way it usually sits.
const RANGE_TOP = {
	x: 0.12 / HAND_SCALE,
	y: 0.15 / (HAND_SCALE * IMAGE_ASPECT),
	h: 0.2 / (HAND_SCALE * IMAGE_ASPECT)
};

// Illustrative scores for the rulers figure: each ruler's on-screen span over the top of its own
// range, so every bar stays proportional to the ruler drawn above it. Palm length is shown by the
// height it spans: in camera coordinates vertical distance counts 16/9 more, so the code's palm
// length also drops when the palm tilts. Unlike the code, this skips subtracting each range's bottom.
// In each of the figure's poses it picks the same winner as palmMax.
export function rulerScores(points) {
	const [ix, iy] = points[INDEX_BASE];
	const [px, py] = points[PINKY_BASE];
	const [wx, wy] = points[WRIST];
	const [mx, my] = points[MIDDLE_BASE];
	const x = Math.min(1, Math.abs(ix - px) / RANGE_TOP.x);
	const y = Math.min(1, Math.abs(iy - py) / RANGE_TOP.y);
	const h = Math.min(1, Math.abs(wy - my) / RANGE_TOP.h);
	return { x, y, h, max: Math.max(x, y, h) };
}

const NS = 'http://www.w3.org/2000/svg';

export function el(name, attrs = {}, parent) {
	const node = document.createElementNS(NS, name);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	if (parent) parent.appendChild(node);
	return node;
}

// Draws a hand into `parent` at (cx, cy) with `size` px per hand unit.
export function drawHand(parent, points, { cx, cy, size, highlight = PALM_POINTS, dim = false } = {}) {
	const g = el('g', {}, parent);
	const at = (i) => [cx + points[i][0] * size, cy + points[i][1] * size];
	const palm = PALM_POINTS.map(at);
	el('polygon', { points: palm.map((p) => p.join(',')).join(' '), fill: 'rgba(115,245,216,0.07)' }, g);
	for (const [a, b] of BONES) {
		const [x1, y1] = at(a);
		const [x2, y2] = at(b);
		el('line', {
			x1, y1, x2, y2,
			stroke: dim ? 'rgba(236,248,243,0.18)' : 'rgba(236,248,243,0.45)',
			'stroke-width': 4,
			'stroke-linecap': 'round'
		}, g);
	}
	points.forEach((_, i) => {
		const [x, y] = at(i);
		const isPalm = highlight.includes(i);
		el('circle', {
			cx: x, cy: y,
			r: isPalm ? 11 : 7,
			fill: isPalm ? '#73f5d8' : dim ? 'rgba(255,122,150,0.35)' : '#ff7a96',
			stroke: isPalm ? 'rgba(115,245,216,0.35)' : 'none',
			'stroke-width': isPalm ? 8 : 0
		}, g);
	});
	return { g, at };
}
