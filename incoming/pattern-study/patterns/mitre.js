// ===== Patternflow pattern =====
// Title:   Mitre
// Family:  geometry
// Idea:    A rectangular frame whose four sides have each drawn back from the corners, so four separate bars stand where the frame was, and the four knobs are the colour, the size of the frame, how far the sides have drawn back and how far each has slid along its edge: closing, the corners shut all at once and four bars become one frame.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 170
// Round:   172
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Close=-28..20, Slide=0.06..1
//
// Knob 1: Hue. The colour of the frame, all the way round the wheel from yellow.
// Knob 2: Size. How big the frame is, 50 LEDs wide and 75 tall at 1, 56 by 84 where it opens at 2, and 62 by 93 at 3. The sides are 10 LEDs thick whatever the size.
// Knob 3: Close. How far the sides have drawn back from the corners, counted in clicks; turn it up and they come back. Where it opens, 0, each side stops 20 LEDs short of the corner and the four bars stand well apart. With Slide at its bottom the corners shut nine clicks on: every gap closes on the same click, the four bars become one frame with a notch at each corner, and the knob holds for three clicks. Seven clicks after that the notches have gone, the frame is whole and the knob holds again, three clicks to the top end. The eight clicks before each hold move every side more than a LED.
// Knob 4: Slide. How far each side has slid along its edge, all the same way round the frame, up to 10 LEDs, one thickness. At its bottom, where it opens, the four bars are centred on their sides. Turned up to 5 LEDs the corners shut later on the Close knob and the notches go earlier, until both happen on the same click; turned further the notches go first and the corners shut last, and at the top the knob holds twice, where the notches go and where the corners shut.

const W = 64;
const H = 128;
// The frame's sides are this thick, and it is centred this far down the panel.
const THICK = 10;
const CX = 32;
const CY = 48;
// Knob 3 is counted in clicks and the knob has 48 of them, 28 below where it opens and 20 above.
const OPEN = 28;
// How far the sides stand from the corners where Close opens, and the clicks before the corners shut each move them more than a LED.
const R_OPEN = 20;
const SLIDE_MAX = THICK;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

// How far the sides stand back from the corners for every point of the Close knob, as corners (clicks, LEDs) joined by straight lines. There are two meetings. The corners shut when the sides have drawn back only as far as it takes to touch the next side, which is one thick less the slide (a slide of more than half a thick shuts them at half a thick). The notches are gone when the sides stand back only as far as they have slid. The eight clicks before the first meeting move the sides more than a LED, and the click right before it moves them 2.1 LEDs, so the last picture before it has a whole column of LEDs dark where the next meeting is.
function plan(slide, P) {
  const shut = slide <= THICK / 2 ? THICK - Math.max(slide, 1) : THICK / 2;
  const whole = slide;
  const lo = Math.min(shut, whole);
  const gap = Math.max(shut, whole) - lo;
  const n = gap < 0.8 ? 0 : Math.max(1, Math.ceil(gap / 1.3));
  // Two meetings less than a LED apart are one: the knob holds once, where the second comes.
  const hi = n > 0 ? lo + gap : lo;
  const first = n > 0 ? 44 - n : 46;
  // Where Close opens the sides stand R_OPEN back; if the first meeting is far up the knob (a big slide), a click or two below the eight before it, the sides keep moving at 0.4 LEDs a click so the knob has no dead clicks.
  const open = Math.max(R_OPEN, hi + 9.8 + (first - 8 - OPEN) * 0.4);
  let c = 0;
  P.qs[c] = 0;
  P.rs[c++] = Math.max(P.end, open + 0.5);
  P.qs[c] = OPEN;
  P.rs[c++] = open;
  P.qs[c] = first - 8;
  P.rs[c++] = hi + 9.8;
  P.qs[c] = first - 1;
  P.rs[c++] = hi + 2.1;
  P.qs[c] = first;
  P.rs[c++] = hi;
  if (n > 0) {
    P.qs[c] = first + 2;
    P.rs[c++] = hi;
  }
  P.qs[c] = 46;
  P.rs[c++] = lo;
  P.qs[c] = 48;
  P.rs[c++] = lo;
  P.count = c;
}

function backAt(P, q) {
  const qs = P.qs;
  const rs = P.rs;
  if (q <= qs[0]) return rs[0];
  for (let i = 1; i < P.count; i++) {
    if (q <= qs[i]) {
      const w = qs[i] - qs[i - 1];
      return w > 0 ? rs[i - 1] + ((rs[i] - rs[i - 1]) * (q - qs[i - 1])) / w : rs[i];
    }
  }
  return rs[P.count - 1];
}

// One bar of the frame, added to the coverage of the LEDs it lies over.
function bar(cov, x0, x1, y0, y1) {
  if (x1 <= x0 || y1 <= y0) return;
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(H - 1, Math.ceil(y1));
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W - 1, Math.ceil(x1));
  for (let y = ya; y <= yb; y++) {
    const ry = span(y0, y1, y);
    for (let x = xa; x <= xb; x++) cov[y * W + x] += span(x0, x1, x) * ry;
  }
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.cov = new Float32Array(W * H);
  params.P = { qs: new Float32Array(12), rs: new Float32Array(12), count: 0, end: 22 };
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The frame's width is 44 + 6 * Size LEDs, snapped to an even number so it stays centred on whole LEDs; it is 1.5 times as tall.
  const wide = 2 * Math.round((44 + 6 * clamp(k[1], 1, 3)) / 2);
  const tall = 2 * Math.round((1.5 * wide) / 2);
  const x0 = CX - wide / 2;
  const x1 = CX + wide / 2;
  const y0 = CY - tall / 2;
  const y1 = CY + tall / 2;
  const slide = SLIDE_MAX * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const P = params.P;
  P.end = wide / 2 - 3;
  plan(slide, P);
  const back = backAt(P, clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  // A side never slides past its corner, so where it has not drawn back as far as it has slid the slide is the draw back.
  const s = Math.min(slide, back);
  const cov = params.cov;
  cov.fill(0);
  bar(cov, x0 + back + s, x1 - back + s, y0, y0 + THICK);
  bar(cov, x1 - THICK, x1, y0 + back + s, y1 - back + s);
  bar(cov, x0 + back - s, x1 - back - s, y1 - THICK, y1);
  bar(cov, x0, x0 + THICK, y0 + back - s, y1 - back - s);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.16 + 0.02 * Math.sin(t * 0.41), 0.74, 0.86 * (0.88 + 0.12 * Math.sin(t * 0.63 + 0.7)), params.col);
}

export function draw(display, params, time) {
  const { cov, col } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cov[y * W + x];
      const a = m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * a, col[1] * a, col[2] * a);
    }
  }
}
