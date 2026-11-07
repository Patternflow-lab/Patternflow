// ===== Patternflow pattern =====
// Title:   Zone Plate
// Family:  wave
// Idea:    A Fresnel zone plate, rings at radii proportional to the square root of n, is sampled once per LED while its constant k is swept up from nothing and back, so a clear field breaks into rings that crowd toward the edges and, past the Nyquist limit, fold back into ghost copies of the plate that slide in and out of the tall panel, each copy in a colour of its own.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fresnel zone plate (Augustin-Jean Fresnel, 1818; Jean-Louis Soret, 1875), the zone plate test chart of video engineering, aliasing at the Nyquist limit; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Centre=-1..1, Fill=0.5..0.9
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the true plate, the rings that are really there, is cyan, and each ghost copy of it is a further 0.13 of the wheel round and a fifth dimmer than the one before: blue, violet, magenta, red.
// Knob 2: Speed. How fast k is swept up and back. At 2 one sweep takes 16 s, timed so that the field is clear at 2 s. The first ring is in at the corners by 2.5 s, the top and bottom edges reach the Nyquist limit at 5.0 s and the sides at 6.6 s, and k is largest, 0.08, at 10 s, when copies of the plate stand 39 LEDs above and below the middle. 0.5 is four times slower and 3 is one and a half times as fast.
// Knob 3: Centre. Where the middle of the plate sits, on row 16 at -1, row 64 at 0, where it opens, and row 112 at 1. The panel is twice as tall as it is wide, so the Nyquist limit comes to the top and bottom first, and a centre near an edge puts it at different distances on its two sides.
// Knob 4: Fill. How much of each zone is lit. At 0.5, where it opens, it is Fresnel's plate: lit and dark zones of equal width, the n-th edge at radius sqrt(n pi / k) LEDs. Above that the lit part grows and the dark rings thin until at 0.9 they are hairlines.

const W = 64, H = 128;
const { floor, round, cos, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

const KMAX = 0.08; // the largest k of a sweep, rad per LED squared
const TD = 16; // seconds a sweep up and back takes at Speed 2
const EDGE = 0.08; // how wide the edge of a ring is, in turns of the phase
const GHOST = 0.8; // each copy of the plate is this much of the light of the one before it

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // The sweep starts 2 s before k is nothing, so that the clear field is the
  // picture at 2 s and not at 0.
  params.s = { hue: 0, speed: 2, cen: 0, fill: 0.5, ph: 1 - 2 / TD, k: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.5], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.5, 3);
  S.cen = cl(kn[2], -1, 1);
  S.fill = cl(kn[3], 0.5, 0.9);
  S.ph += (d * S.speed) / (2 * TD);
  S.ph -= floor(S.ph);
  S.k = KMAX * (0.5 - 0.5 * cos(2 * PI * S.ph));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const k = S.k, D = S.fill, x0 = 32, y0 = 64 + round(48 * S.cen);
  const turn = k / (2 * PI), rate = k / PI, inv = 1 / EDGE;
  const rgb = [0, 0, 0];
  const cache = [];
  for (let y = 0; y < H; y++) {
    const dy = y - y0, ty = turn * dy * dy, my = round(rate * abs(dy));
    for (let x = 0; x < W; x++) {
      const dx = x - x0, t = ty + turn * dx * dx;
      // The phase k r^2 in turns. A turn is a lit zone, for its first D, and
      // a dark one. The edge of a ring is a ramp half an EDGE either side of
      // the turn where it falls, so its half-light is where the ring is. The
      // first zone, the disc in the middle, has no edge at its start.
      const p = t - floor(t + 0.5 * EDGE);
      const u = sm((D + 0.5 * EDGE - p) * inv) * (t < 0.5 * EDGE ? 1 : sm((p + 0.5 * EDGE) * inv));
      if (u <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // Which copy of the plate this LED belongs to: the true frequency of
      // the rings here is k |dx| / pi cycles per LED across and k |dy| / pi
      // down, and past a half it folds back, so round() counts the copy.
      const m = (round(rate * abs(dx)) + my) & 7;
      let col = cache[m];
      if (!col) {
        hsv(S.hue + 0.5 + 0.13 * m, 0.85, 1, rgb);
        const g = 255 * Math.pow(GHOST, m);
        col = cache[m] = [rgb[0] * g, rgb[1] * g, rgb[2] * g];
      }
      display.setPixel(x, y, col[0] * u, col[1] * u, col[2] * u);
    }
  }
}
