// ===== Patternflow pattern =====
// Title:   Arnold Tongues
// Family:  rhythm
// Idea:    The mode-locking map of the circle map, drive frequency Omega across and coupling K up the panel: every fraction p/q on the bottom edge grows a tongue that widens upward, each tongue flashes once every q beats so the panel plays all its locked rhythms at once, and a scan line climbing the panel draws the devil's staircase of the height it crosses.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Arnold tongues of the circle map (Vladimir Arnold, 1961), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0.2..3, Zoom=0..1, Depth=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the two q = 1 tongues filling the sides are dim teal and 1/2 is pink. The thirds are green and the quarters blue; the fifths are red-orange and the sevenths purple. The unlocked ground runs from navy on the left to plum on the right.
// Knob 2: Tempo. 0.8 beats a second per unit, 1.6 at 2. A tongue locked to p/q flashes on every q-th beat, so the sides flash on every beat and 1/2 on every second one. A band of light runs up the lit tongues within the beat. The scan line goes up and down the panel once every 24 beats, 15 seconds at 2.
// Knob 3: Zoom. At 0 Omega runs 0 to 1 across the panel; at 1 it runs 0.322 to 0.442, ten times closer, round the golden section 0.382, where 1/3, 3/8, 5/13 and 2/5 crowd together. After a turn the map is worked out again from the bottom up in about a second.
// Knob 4: Depth. The largest q that gets a colour: 2 at -1, 13 at the start, 21 at 1. A point locked to a larger q stays in the dim ground with the unlocked points.
// Buttons: K1 tap is a downbeat: the count goes back to beat 0, which every q divides, so every tongue flashes white at once and the scan line starts again from the bottom.

const W = 64, H = 128, SX = 3, NS = W * SX, QM = 21, T = 320, EPS = 1e-4, RUNS = 4;
const { floor, round, abs, exp, cos, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const GOLD2 = (3 - Math.sqrt(5)) / 2;

// sin(2 pi u) from a table: the map runs 320 steps for each of 24576 points.
const LN = 4096, SIN = new Float64Array(LN + 1);
for (let i = 0; i <= LN; i++) SIN[i] = Math.sin((TAU * i) / LN);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// The lifted circle map th -> th + Om - (K / 2 pi) sin(2 pi th), from th = 0.
// Row y has K = 1 - (1 - u)^2 with u = (127 - y) / 127: 0 at the bottom, 1 at
// the top, and twice as many rows near the top, where the tongues spread, as
// a straight scale would give. After 320 steps the point is locked to p/q
// when th moved by exactly p over each of its last four runs of q steps; the
// smallest such q wins. The rotation number rho is the mean step over the
// last 256.
const kOf = (y) => {
  const u = 1 - (H - 1 - y) / (H - 1);
  return 1 - u * u;
};
const BUF = new Float64Array(T + 1);
function buildRow(P, y) {
  const c = kOf(y) / TAU, o = y * NS, o0 = P.om0, dw = (P.om1 - P.om0) / NS;
  for (let j = 0; j < NS; j++) {
    const om = o0 + (j + 0.5) * dw;
    let th = 0;
    for (let n = 0; n < T; n++) {
      BUF[n] = th;
      const u = (th - floor(th)) * LN, i = u | 0;
      th += om - c * (SIN[i] + (SIN[i + 1] - SIN[i]) * (u - i));
    }
    BUF[T] = th;
    let q = 1;
    for (; q <= QM; q++) {
      const p = round(BUF[T] - BUF[T - q]);
      let r = 0;
      while (r < RUNS && abs(BUF[T - r * q] - BUF[T - r * q - q] - p) < EPS) r++;
      if (r === RUNS) break;
    }
    P.Q[o + j] = q > QM ? 0 : q;
    P.R[o + j] = (BUF[T] - BUF[T - 256]) / 256;
  }
}

export function setup(params) {
  params.s = {
    Q: new Uint8Array(H * NS), R: new Float32Array(H * NS), zoom: -1, om0: 0, om1: 1, next: H,
    beat: 0, hue: NaN, depth: 13, accent: 0,
    pal: new Float32Array((QM + 1) * 3), dim: new Float32Array(256 * 3), env: new Float32Array(QM + 1),
    row: new Float32Array(W * 3), lock: new Uint8Array(W),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const z = round(cl(k[2], 0, 1) * 200) / 200;
  const first = P.zoom < 0;
  if (z !== P.zoom) {
    // The window narrows to 0.12 wide and slides to the golden section.
    P.zoom = z;
    const w = exp(Math.log(0.12) * z), c = 0.5 + (GOLD2 - 0.5) * ((1 - w) / (1 - 0.12));
    (P.om0 = c - w / 2), (P.om1 = c + w / 2), (P.next = 0);
  }
  // The first frame builds all 128 rows; after a turn of Zoom they are built
  // again from the bottom, four rows a frame.
  for (let b = first ? H : 4; b > 0 && P.next < H; b--) buildRow(P, H - 1 - P.next++);
  P.depth = round(2 + 19 * ((cl(k[3], -1, 1) + 1) / 2) ** 0.9);
  P.beat += d * 0.8 * cl(k[1], 0.2, 3);
  if (input.btnPressed && input.btnPressed[0]) (P.beat = 0), (P.accent = 1);
  P.accent = max(0, P.accent - d * 0.9);
  if (P.hue !== k[0]) {
    P.hue = k[0];
    // q = 1, the two wide tongues at the sides, stays dim so the rest show.
    for (let q = 1; q <= QM; q++) hsv(k[0] + 0.52 + GOLD2 * (q - 1), 0.78, q === 1 ? 0.3 : 0.66 - 0.008 * q, P.pal, q * 3);
    for (let i = 0; i < 256; i++) hsv(k[0] + 0.62 + (0.3 * i) / 255, 0.7, 0.17, P.dim, i * 3);
  }
  // Beat b lights every tongue whose q divides it, and the light dies away
  // over the beat.
  const b = floor(P.beat), f = P.beat - b;
  for (let q = 1; q <= QM; q++) P.env[q] = b % q === 0 ? exp(-3.2 * f) : 0;
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.zoom < 0) return;
  const { Q, R, pal, dim, env, row, lock } = P, D = P.depth, acc = P.accent;
  const f = P.beat - floor(P.beat), yb = (H - 1) * (1 - 1.3 * f), rs = 255 / (P.om1 - P.om0), r0 = P.om0;
  // The scan line: up and down the panel once every 24 beats.
  const yp = round((H - 1) * (0.5 + 0.5 * cos((TAU * P.beat) / 24)));
  for (let y = 0; y < H; y++) {
    const o = y * NS;
    // On each beat a band of light runs up the tongues that beat lights.
    const band = exp(-((y - yb) * (y - yb)) / 120);
    row.fill(0);
    for (let x = 0; x < W; x++) {
      // A tongue thinner than an LED still lights the whole LED, so long as
      // it holds for a row above or below; a lone locked point, a thin
      // tongue that bends across this column, lights its third.
      let qs = 99, r = 0, g = 0, b = 0;
      for (let j = x * SX; j < x * SX + SX; j++) {
        const q = Q[o + j];
        if (q && q <= D) {
          if (q < qs && ((y > 0 && Q[o + j - NS] === q) || (y < H - 1 && Q[o + j + NS] === q))) qs = q;
          (r += pal[q * 3]), (g += pal[q * 3 + 1]), (b += pal[q * 3 + 2]);
        } else {
          // Not locked, or locked past Depth: a dim colour that runs with rho.
          const i = cl(round((R[o + j] - r0) * rs), 0, 255) * 3;
          (r += dim[i]), (g += dim[i + 1]), (b += dim[i + 2]);
        }
      }
      if (y === yp) lock[x] = qs < 99 ? qs : 0;
      if (qs < 99) {
        const e = min(1, env[qs] * (0.55 + 0.6 * band) + acc), m = 1 + 0.6 * e, wv = 130 * e;
        display.setPixel(x, y, min(255, pal[qs * 3] * m + wv), min(255, pal[qs * 3 + 1] * m + wv), min(255, pal[qs * 3 + 2] * m + wv));
      } else display.setPixel(x, y, r / SX, g / SX, b / SX);
    }
  }
  // The devil's staircase at the scan line: rho against Omega, rho scaled so
  // the bottom row's straight line rho = Omega would run corner to corner.
  // Its flat steps are the tongues the line crosses, in their colours.
  const o = yp * NS, sc = (H - 1) / (P.om1 - P.om0);
  let py = -1;
  for (let x = 0; x < W; x++) {
    let r = 0;
    for (let s = 0; s < SX; s++) r += R[o + x * SX + s];
    const sy = cl(round(H - 1 - (r / SX - r0) * sc), 0, H - 1);
    const a = py < 0 ? sy : py, y0 = min(a, sy), y1 = max(a, sy), q = lock[x];
    for (let y = y0; y <= y1; y++) display.setPixel(x, y, 170, 170, 165);
    if (q) display.setPixel(x, sy, min(255, pal[q * 3] * 1.3 + 100), min(255, pal[q * 3 + 1] * 1.3 + 100), min(255, pal[q * 3 + 2] * 1.3 + 100));
    py = sy;
    if (x % 2 === 0 && (yp < y0 || yp > y1)) display.setPixel(x, yp, 150, 150, 150);
  }
}
