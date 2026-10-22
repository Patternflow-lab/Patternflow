// ===== Patternflow pattern =====
// Title:   Dragon Fold
// Family:  fractal
// Idea:    A strip folded in half again and again opens into the Heighway dragon: each new generation swings a copy of the whole line a quarter turn out of its own end, and later the folds close back up.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Fold Speed=0.5..6, Generations=8..10, Dragons=1..4
//
// Knob 1: Hue. Where the colour that runs along the line starts.
// Knob 2: Fold Speed. How quickly one generation swings out of the last.
// Knob 3: Generations. How many folds before it holds, from 256 segments to 1024.
// Knob 4: Dragons. One to four dragons from the same first point, the second turned half round and the others a quarter; four of them tile the plane around that point.
// Buttons: K1 tap turns the folding round, so it closes up or opens out from where it is.

const W = 64;
const H = 128;
const MAX_GEN = 10;
const COUNT = 1 << MAX_GEN;
// Panel LEDs per unit of the line's end-to-end span. With 64 a held
// dragon's segments land on whole LEDs: 4 LEDs long at 8 folds, 2 diagonal
// steps at 9, 2 LEDs at 10.
const K = 64;
const HOLD = 4;
const QUARTERS = [0, 2, 1, 3];

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  // The deepest dragon's corners. A shallower generation is its first 2^n + 1
  // points, because each fold only adds to the end.
  const px = new Int32Array(COUNT + 1);
  const py = new Int32Array(COUNT + 1);
  px[1] = 1;
  for (let n = 0; n < MAX_GEN; n++) {
    const m = 1 << n;
    for (let k = 1; k <= m; k++) {
      // The new half is the old one walked backward and turned a quarter about the end.
      const dx = px[m - k] - px[m];
      const dy = py[m - k] - py[m];
      px[m + k] = px[m] - dy;
      py[m + k] = py[m] + dx;
    }
  }
  params.px = px;
  params.py = py;
  params.sx = new Float32Array(COUNT + 1);
  params.sy = new Float32Array(COUNT + 1);
  params.rgb = new Float32Array(W * H * 3);
  params.colour = new Float32Array(4 * 3 * 64);
  params.g = -1;
  params.dir = 1;
  params.hold = 0;
  params.flow = 0;
  params.run = 0;
  params.ox = 21;
  params.oy = 37;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 8, 1];
  const gen = Math.max(1, Math.min(MAX_GEN, Math.round(k[2])));
  params.gen = gen;
  params.dragons = Math.max(1, Math.min(4, Math.round(k[3])));
  // Open two folds short of the top, so the first seconds show folding.
  if (params.g < 0) params.g = Math.max(0, gen - 2);
  if (input.btnPressed && input.btnPressed[0]) {
    params.dir = -params.dir;
    params.hold = 0;
  }
  // A fold of a long line takes longer than a fold of a short one.
  const n = Math.floor(params.g);
  const step = (dt * k[1]) / (1 + 0.26 * n);
  if (params.hold > 0) {
    params.hold -= dt;
    if (params.hold <= 0) params.dir = params.g >= gen ? -1 : 1;
  } else if (params.dir > 0) {
    params.g = Math.min(gen, params.g + step);
    if (params.g >= gen) params.hold = HOLD;
  } else {
    params.g = Math.max(0, params.g - step);
    if (params.g <= 0) params.hold = 0.6;
  }
  if (params.g > gen) {
    params.dir = -1;
    params.hold = 0;
  }
  params.flow += dt * 0.025;
  params.run += dt * 0.12;

  // One dragon sits in the middle of its own box; more share the panel's centre.
  const tx = params.dragons > 1 ? 32 : 21;
  const ty = params.dragons > 1 ? 64 : 37;
  const ease = Math.min(1, dt * 2.5);
  params.ox += (tx - params.ox) * ease;
  params.oy += (ty - params.oy) * ease;

  // Colours along the line, 64 steps per dragon, yellow through green to cyan at K1 0.
  const hue = k[0] + 0.11 + params.flow;
  for (let d = 0; d < 4; d++) {
    for (let s = 0; s < 64; s++) hsv(hue + d * 0.27 + (s / 63) * 0.38, 0.85, 0.9, params.colour, (d * 64 + s) * 3);
  }
}

function plot(rgb, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  rgb[o] = r;
  rgb[o + 1] = g;
  rgb[o + 2] = b;
}

// A crisp line one LED wide, both ends included.
function line(rgb, x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    plot(rgb, Math.round(x0 + dx * t), Math.round(y0 + dy * t), r, g, b);
  }
}

export function draw(display, params, time) {
  const rgb = params.rgb;
  rgb.fill(0);
  const g = params.g;
  const n = Math.min(MAX_GEN - 1, Math.floor(g));
  const f = g - n;
  const e = f * f * (3 - 2 * f);
  const m = 1 << n;
  // Points past 2^(n+1) are not drawn. Those past 2^n are mid-fold: turned
  // back toward the old half by the part of the quarter turn still to go.
  const last = f > 0 ? 2 * m : m;
  const turn = (e - 1) * Math.PI * 0.5;
  const tc = Math.cos(turn);
  const ts = Math.sin(turn);
  // The view divides by the span from first point to last, (1 - i)^g, so the
  // dragon keeps its size and its heading while it folds.
  const span = Math.pow(2, -(n + e) / 2) * K;
  const va = (Math.PI / 4) * (n + e);
  const vc = Math.cos(va) * span;
  const vs = Math.sin(va) * span;
  const px = params.px;
  const py = params.py;
  const sx = params.sx;
  const sy = params.sy;
  const cx = px[m];
  const cy = py[m];
  const col = params.colour;
  const total = 1 << params.gen;
  for (let d = params.dragons - 1; d >= 0; d--) {
    // The second dragon is the first turned half round about the first point,
    // so two of them stand up and down the tall panel; the third and fourth
    // fill the quarter turns between.
    const q = QUARTERS[d];
    const dc = q === 0 ? 1 : q === 2 ? -1 : 0;
    const ds = q === 1 ? 1 : q === 3 ? -1 : 0;
    for (let i = 0; i <= last; i++) {
      let x = px[i];
      let y = py[i];
      if (i > m) {
        const ax = x - cx;
        const ay = y - cy;
        x = cx + ax * tc - ay * ts;
        y = cy + ax * ts + ay * tc;
      }
      const rx = x * dc - y * ds;
      const ry = x * ds + y * dc;
      // Down the panel is along the span, across is the quarter turn from it.
      sy[i] = params.oy + rx * vc - ry * vs;
      sx[i] = params.ox + rx * vs + ry * vc;
    }
    // Newest segments first, so a half that has only begun to swing out
    // stays under the line it is leaving.
    for (let i = last - 1; i >= 0; i--) {
      const c = (d * 64 + Math.min(63, Math.floor((i / total) * 64))) * 3;
      // A slow swell of light walks from the first point to the last.
      const along = i / total - params.run;
      const lift = 0.8 + 0.2 * Math.cos((along - Math.floor(along)) * Math.PI * 2 * 3);
      line(rgb, sx[i], sy[i], sx[i + 1], sy[i + 1], col[c] * lift, col[c + 1] * lift, col[c + 2] * lift);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
    }
  }
}
