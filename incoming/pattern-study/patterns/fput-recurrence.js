// ===== Patternflow pattern =====
// Title:   FPUT Recurrence
// Family:  physics
// Idea:    The 1955 chain of 31 masses on springs with a quadratic term vibrates as a string down the panel, plucked with all its energy in its lowest mode; the energy runs into modes 2, 3 and 4, drawn as coloured lobes round the string, until mode 1 keeps 9% of it, and 147 swings after the pluck 98% of it is back in mode 1.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fermi–Pasta–Ulam–Tsingou problem (Enrico Fermi, John Pasta, Stanislaw Ulam, Mary Tsingou, 1955), pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Amplitude=1..1.9, Alpha=0..1
//
// Knob 1: Hue. Turns the mode colours round the wheel together. At 0 mode 1 is magenta, mode 2 cyan, mode 3 gold, mode 4 green and modes 5 to 8 a pale ice blue; at 0.5 mode 1 is green and mode 2 red.
// Knob 2: Speed. At 2 the chain runs 300 units of its own time a second, so mode 1 swings 4.7 times a second and the energy is back in mode 1 after 31 seconds; at 0.2 a swing takes 2.1 seconds and the return 5 minutes, at 3 the return takes 21 seconds.
// Knob 3: Amplitude. How far the pluck pulls the middle mass: 1 unit at the start, as in 1955, drawn 24 LEDs to the side; up to 1.9 units, drawn 31 LEDs to the side, the scale shrinking so the string stays on the panel. Only Alpha times Amplitude matters to the motion. At 1.9 mode 1 drops to 4.5% and 97% is back after 107 swings.
// Knob 4: Alpha. The strength of the springs' quadratic term, alpha = 0.25 times the square root of the knob over 0.06: 0.25 at 0.06, where the knob opens, as in 1955; 0.5 at 0.24; 1.02 at 1, where mode 1 drops to 2% and 95% is back after 73 swings. At 0 the springs are linear and the energy never leaves mode 1. With Amplitude at 1.9 and Alpha at 1 the energy runs up into modes 5 to 8 within 2 seconds and does not come back in two minutes. A turned Amplitude or Alpha plucks the chain again once the knob has rested 0.4 seconds.
// Buttons: K1 tap plucks the chain again, all its energy in mode 1.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The chain: N springs, masses 1..N-1 moving, masses 0 and N held. In the
// model each mass moves along the chain; here its displacement is drawn
// sideways, so the chain reads as a string stretched from the top of the
// panel to the bottom.
const N = 32;
// Rows of the two held ends and the step between masses.
const Y0 = 0.5, DY = 127 / N;
const CX = 31.5;
// LEDs per unit of displacement: 24 at amplitude 1, fewer for a bigger
// pluck so the swing stays on the panel, 31 LEDs either side at 1.9.
const scaleOf = (A) => 24 * A ** -0.6;
// Velocity Verlet step in the chain's own time. With a step of 0.1 the
// energy is back in mode 1 after 147 periods of mode 1 (T1 = 64.03); 0.05
// gives the same within half a period. A coarser step stretches it: a step
// of 0.354, the square root of 1/8, gives 157 periods and 0.4 gives 160.
const HSTEP = 0.1;
// Chain time per second at Speed 1.
const RATE = 150;
// Mode k: frequency 2 sin(pi k / 2N), shape sqrt(2/N) sin(pi k i / N).
const OM = new Float64Array(N), SH = new Float64Array(N * (N + 1));
for (let k = 1; k < N; k++) {
  OM[k] = 2 * sin((PI * k) / (2 * N));
  for (let i = 0; i <= N; i++) SH[k * (N + 1) + i] = sqrt(2 / N) * sin((PI * k * i) / N);
}
const T1 = (2 * PI) / OM[1];
// Energy of mode 1 plucked to amplitude 1: the unit the lobes are drawn in.
const EREF = 0.5 * OM[1] * OM[1] * (N / 2);
// Mode colours at Hue 0: magenta, cyan, gold and green for modes 1 to 4,
// and one pale ice blue for modes 5 to 8. At the opening knobs mode 5 holds
// 15% at most and mode 6 4%; a larger Alpha or Amplitude fills up to mode 8.
const MHUE = [0, 0.87, 0.5, 0.13, 0.3, 0.58, 0.58, 0.58, 0.58], MSAT = [0, 0.75, 0.8, 0.7, 0.75, 0.35, 0.35, 0.35, 0.35];
const GHOSTS = 8;
// Lobe fill, as a share of the outline's level.
const FILL = 0.2;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const alphaOf = (k) => 0.25 * sqrt(max(0, k) / 0.06);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, amp: 1, alpha: 0.25, ampSet: -1, alphaSet: -1, wait: 0, begun: false,
    u: new Float64Array(N + 1), v: new Float64Array(N + 1), a: new Float64Array(N + 1),
    clock: 0, carry: 0, e: new Float64Array(N), es: new Float64Array(N),
    rgb: new Float32Array(W * H * 3), col: new Float32Array(3 * (GHOSTS + 1)),
  };
}

function accel(S) {
  const { u, a } = S, al = S.alphaSet;
  for (let i = 1; i < N; i++) {
    const dr = u[i + 1] - u[i], dl = u[i] - u[i - 1];
    a[i] = dr - dl + al * (dr * dr - dl * dl);
  }
}

function modes(S, out) {
  const { u, v } = S;
  for (let k = 1; k < N; k++) {
    let q = 0, p = 0;
    const o = k * (N + 1);
    for (let i = 1; i < N; i++) {
      q += SH[o + i] * u[i];
      p += SH[o + i] * v[i];
    }
    out[k] = 0.5 * (p * p + OM[k] * OM[k] * q * q);
  }
}

function pluck(S) {
  const { u, v } = S;
  S.ampSet = S.amp;
  S.alphaSet = S.alpha;
  for (let i = 0; i <= N; i++) {
    u[i] = S.amp * sin((PI * i) / N);
    v[i] = 0;
  }
  u[0] = u[N] = 0;
  accel(S);
  S.clock = 0;
  S.carry = 0;
  modes(S, S.es);
  S.wait = 0;
}

// The string's column at row y (any real y), straight between masses.
function colAt(u, y, sc) {
  const f = cl((y - Y0) / DY, 0, N), i = min(N - 1, floor(f)), t = f - i;
  return CX + sc * (u[i] + (u[i + 1] - u[i]) * t);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.amp = cl(k[2], 1, 1.9);
  S.alpha = alphaOf(cl(k[3], 0, 1));
  if (!S.begun) {
    pluck(S);
    S.begun = true;
  }
  if (abs(S.amp - S.ampSet) > 0.004 || abs(S.alpha - S.alphaSet) > 0.004) {
    S.wait += d;
    if (S.wait > 0.4) pluck(S);
  } else S.wait = 0;
  if (input.btnPressed && input.btnPressed[0]) pluck(S);

  const { u, v, a } = S;
  S.carry += d * S.speed * RATE;
  while (S.carry >= HSTEP) {
    for (let i = 1; i < N; i++) {
      v[i] += 0.5 * HSTEP * a[i];
      u[i] += HSTEP * v[i];
    }
    accel(S);
    for (let i = 1; i < N; i++) v[i] += 0.5 * HSTEP * a[i];
    S.carry -= HSTEP;
    S.clock += HSTEP;
  }
  // A chain thrown past its springs' hump starts again.
  let big = 0;
  for (let i = 1; i < N; i++) big = max(big, abs(u[i]));
  if (!(big < 6)) pluck(S);
  // Mode energies, smoothed over one period of mode 1 so the lobes show
  // where the energy is, not the swing of each mode.
  modes(S, S.e);
  const g = 1 - exp(-(d * S.speed * RATE) / T1);
  for (let k2 = 1; k2 < N; k2++) S.es[k2] += (S.e[k2] - S.es[k2]) * g;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, col, es, u } = S, sc = scaleOf(S.ampSet);
  for (let m = 1; m <= GHOSTS; m++) hsv(S.hue + MHUE[m], MSAT[m], 1, col, 3 * m);
  let tot = 0;
  for (let k = 1; k < N; k++) tot += es[k];
  tot = max(tot, 1e-12);
  // String colour: the modes' colours weighted by the fourth power of their
  // shares, so the string takes the colour of the mode holding the most.
  let wr = 0, wg = 0, wb = 0, ws = 0;
  for (let m = 1; m <= GHOSTS; m++) {
    const w = (es[m] / tot) ** 4;
    wr += w * col[3 * m];
    wg += w * col[3 * m + 1];
    wb += w * col[3 * m + 2];
    ws += w;
  }
  ws = max(ws, 1e-9);
  const sr = wr / ws, sg = wg / ws, sb = wb / ws;
  rgb.fill(0);
  // Lobes: mode m as the envelope it would swing through if it held its
  // energy alone, |sin(pi m y / L)| wide, outlined in its colour. A mode
  // holding under 5% of the energy is not drawn; from 20% it is at full.
  for (let m = 1; m <= GHOSTS; m++) {
    const sh = es[m] / tot, w = sc * sqrt(es[m] / EREF), lv = 0.85 * sm(0.05, 0.2, sh);
    if (w < 0.8 || lv <= 0) continue;
    const cr = col[3 * m] * lv, cg = col[3 * m + 1] * lv, cb = col[3 * m + 2] * lv, L = N * DY;
    for (let y = 0; y < H; y++) {
      const hw0 = w * abs(sin((PI * m * (y - Y0)) / L)), hw1 = w * abs(sin((PI * m * (y + 1 - Y0)) / L));
      const lo = min(hw0, hw1) - 0.6, hi = max(hw0, hw1) + 0.6;
      for (let x = max(0, floor(CX - lo + 1)); x <= min(W - 1, floor(CX + lo - 1)); x++) {
        const q = (y * W + x) * 3;
        rgb[q] = max(rgb[q], FILL * cr);
        rgb[q + 1] = max(rgb[q + 1], FILL * cg);
        rgb[q + 2] = max(rgb[q + 2], FILL * cb);
      }
      for (const sgn of [-1, 1]) {
        const xa = CX + sgn * lo, xb = CX + sgn * hi;
        for (let x = max(0, floor(min(xa, xb))); x <= min(W - 1, floor(max(xa, xb))); x++) {
          const q = (y * W + x) * 3;
          rgb[q] = max(rgb[q], cr);
          rgb[q + 1] = max(rgb[q + 1], cg);
          rgb[q + 2] = max(rgb[q + 2], cb);
        }
      }
    }
  }
  // The string, straight between masses, and the 31 masses on it.
  for (let y = 0; y < H; y++) {
    const xa = colAt(u, y, sc), xb = colAt(u, y + 1, sc), x0 = floor(min(xa, xb) - 0.4), x1 = floor(max(xa, xb) + 0.4);
    for (let x = max(0, x0); x <= min(W - 1, x1); x++) {
      const q = (y * W + x) * 3;
      rgb[q] = 0.25 + 0.75 * sr;
      rgb[q + 1] = 0.25 + 0.75 * sg;
      rgb[q + 2] = 0.25 + 0.75 * sb;
    }
  }
  for (let i = 1; i < N; i++) {
    const bx = CX + sc * u[i], by = Y0 + i * DY;
    for (let y = floor(by - 1); y <= floor(by + 1); y++)
      for (let x = floor(bx - 1); x <= floor(bx + 1); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if ((x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 > 1.2) continue;
        const q = (y * W + x) * 3;
        rgb[q] = rgb[q + 1] = rgb[q + 2] = 1;
      }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
