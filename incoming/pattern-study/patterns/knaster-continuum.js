// ===== Patternflow pattern =====
// Title:   Knaster Continuum
// Family:  topology
// Idea:    The bucket handle stands on the panel with the middle-thirds Cantor set running down the 128 rows of one column, upper semicircles bulging right and lower semicircles bulging left, all squashed into thin half-ellipses, and a white bead swings along the composant of 0 like a pendulum, right arc then left arc, from 0 to 1 to 2/3 to 1/3 to 2/9 and on, painting each arc it has crossed magenta until it has reached all 32 endpoints of the fourth stage, where the next arcs would run half a row from the ones drawn, closer than the LEDs can show, so the trail dissolves and the walk begins again from 0.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Brouwer-Janiszewski-Knaster continuum or bucket handle, the first indecomposable continuum (L. E. J. Brouwer, 1910) in the picture credited to Bronisław Knaster, built on the middle-thirds Cantor set (Georg Cantor, 1883), pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=4..7, Fade=0..1
//
// Knob 1: Hue. Turns the three colours round the wheel together: at 0 the right arcs are cyan, the left arcs green and the walked composant magenta; at 0.17 they are blue, cyan and red, at 0.5 red, magenta and green.
// Knob 2: Speed. At 2 the swing down the biggest arc, all 127 rows, takes 0.5 s, and every arc takes 0.5 s times the square root of its radius over 63.5 rows, as a pendulum's swing would, so the 31 arcs to the fourth stage take 9.0 s, the finished walk holds 1.2 s and its trail dissolves in 1 s; at 0.2 everything takes ten times as long, at 3 two thirds.
// Knob 3: Depth. The stage of the Cantor set whose endpoints the arcs join, and where the walk starts again: at 4, 31 arcs in ribbons of four lines 1.6 rows apart, 24.5% of the LEDs; at 5, 63 arcs half a row apart that the panel can only show as solid ribbons, 30%; at 7, 255 arcs and 32%, and the walk takes 18 s, 36 s and 72 s at 5, 6 and 7.
// Knob 4: Fade. How long a crossed LED stays magenta, in seconds at Speed 2: 30 s at 0 and 24 s at the opening 0.06, longer than the 9 s walk, so the whole ray stays painted; 3.9 s at 0.5, a magenta stretch of about a dozen arcs behind the bead; 0.5 s at 1, a short tail on the bead.

// The Cantor set C is what is left of [0, 1] when the open middle third is
// taken out, then the middle third of each piece, and on for ever. Join
// every pair of points of C symmetric about 1/2 by a semicircle above the
// line, and for every n >= 1 join the pairs of points of C in
// [2/3^n, 1/3^(n-1)] symmetric about 5/(2 3^n) by a semicircle below it.
// The union is the bucket handle. It is connected and compact, and it
// cannot be written as the union of two proper subcontinua: it is
// indecomposable.
//
// The line runs down the panel here: x in [0, 1] is row 127 x of column 16.
// The upper family bulges right, the lower family left, and every arc is
// squashed across by 0.745, so the biggest upper arc, radius 63.5 rows,
// reaches column 63 and the biggest lower arc, radius 21.2 rows, column 0.
//
// The composant of 0 is the union of the subcontinua that hold 0 and are
// not the whole thing. It is a ray that starts at 0: along the upper arc
// to 1, a lower arc back to 2/3, an upper arc to 1/3, a lower arc to 2/9,
// an upper arc to 7/9 and on. In exact arithmetic over 3^9, the upper arc sends m to 3^9 - m and
// the lower arc sends m in [2 3^(9-n), 3^(10-n)] to 5 3^(9-n) - m. The
// first 2^(k+1) points of the walk are exactly the 2^(k+1) endpoints of
// the intervals of the k-th stage, so the first 2^(k+1) - 1 arcs draw the
// whole k-th approximation of the continuum. The ray never ends, and it is
// dense: every composant is. At stage 4 the closest arcs are 127/81 = 1.6
// rows apart; the next stage would put them half a row apart, finer than
// the panel shows, so there the walk lets go of its trail and starts again
// from 0.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, cos, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Column of the Cantor axis, the squash across, rows per unit of x.
const AX = 16, SQ = 0.745, SPAN = 127;
// Exact walk over 3^KM; depth 7 needs lower arcs down to n = 8.
const KM = 9, P = 3 ** KM;
const DMIN = 4, DMAX = 7, ARCS = 2 ** (DMAX + 1) - 1;
// At Speed 2: the swing on the biggest arc, the hold at the end of a walk,
// and the time the trail takes to dissolve before the next walk.
const SWING = 0.5, HOLD = 1.2, MELT = 1.0;

// The walk: PTS[i] is the i-th endpoint, numerator over 3^KM.
const PTS = new Int32Array(ARCS + 1);
for (let i = 1, m = 0; i <= ARCS; i++) {
  if (i % 2 === 1) m = P - m;
  else {
    let n = 1;
    while (!(m >= 2 * 3 ** (KM - n) && m <= 3 ** (KM - n + 1))) n++;
    m = 5 * 3 ** (KM - n) - m;
  }
  PTS[i] = m;
}

// Each arc as a run of LEDs from its start to its end, one LED wide:
// sampled finely, then every LED whose neighbours on the run already touch
// each other is dropped, so the run steps diagonally where it turns.
const START = new Int32Array(ARCS + 1);
const RADIUS = new Float32Array(ARCS);
const PIX = [];
for (let i = 0; i < ARCS; i++) {
  const ya = (PTS[i] / P) * SPAN, yb = (PTS[i + 1] / P) * SPAN;
  const cy = (ya + yb) / 2, r = Math.abs(yb - ya) / 2, dir = yb > ya ? 1 : -1;
  const side = i % 2 === 0 ? 1 : -1;
  const raw = [];
  const steps = Math.max(8, Math.ceil(r * 8));
  for (let s = 0; s <= steps; s++) {
    const th = -PI / 2 + (PI * s) / steps;
    const x = cl(round(AX + side * SQ * r * cos(th)), 0, W - 1);
    const y = cl(round(cy + dir * r * Math.sin(th)), 0, H - 1);
    const last = raw[raw.length - 1];
    if (!last || last[0] !== x || last[1] !== y) raw.push([x, y]);
  }
  START[i] = PIX.length;
  const kept = [];
  for (let s = 0; s < raw.length; s++) {
    if (kept.length && s < raw.length - 1) {
      const a = kept[kept.length - 1], b = raw[s + 1];
      if (Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1) continue;
    }
    kept.push(raw[s]);
  }
  for (const [x, y] of kept) PIX.push(y * W + x);
  RADIUS[i] = r;
}
START[ARCS] = PIX.length;
const RUN = Int32Array.from(PIX);

// Which family covers each LED at each depth: 1 right, 2 left, 0 none.
const COVER = [];
for (let d = DMIN; d <= DMAX; d++) {
  const c = new Uint8Array(N);
  for (let i = 0; i < 2 ** (d + 1) - 1; i++) for (let j = START[i]; j < START[i + 1]; j++) c[RUN[j]] = i % 2 === 0 ? 1 : 2;
  COVER.push(c);
}

// A pendulum's swing takes time as the square root of its length.
const swingTime = (i) => SWING * sqrt(RADIUS[i] / RADIUS[0]);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6].map(round);
}

export function setup(params) {
  const melt = new Float32Array(N);
  for (let p = 0; p < N; p++) melt[p] = Math.random();
  params.s = {
    clock: 0,
    arc: 0,
    phase: 0,
    done: 0,
    end: 0,
    stamp: new Float32Array(N).fill(-1e9),
    melt,
    hue: 0,
    depth: DMIN,
    life: 1e9,
  };
}

// Marks the LEDs of arc i from index a to b (exclusive) as crossed now.
function cross(S, i, a, b) {
  const s0 = START[i];
  for (let j = a; j < b; j++) S.stamp[RUN[s0 + j]] = S.clock;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, DMIN, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.depth = cl(round(k[2] == null ? DMIN : k[2]), DMIN, DMAX);
  const fade = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  // How long a crossed LED stays in the walk's colour, in seconds at Speed
  // 2: 30 s at Fade 0, 23.6 s at 0.06, 3.9 s at 0.5, half the big swing at 1.
  S.life = SWING * 60 ** (1 - fade);
  const step = (d * speed) / 2;
  S.clock += step;
  const arcs = 2 ** (S.depth + 1) - 1;
  if (S.arc >= arcs && S.end === 0) S.end = 1e-6;

  if (S.end > 0) {
    // The walk has reached every endpoint of this stage: hold, dissolve the
    // trail, and start again from 0.
    S.end += step;
    if (S.end >= HOLD + MELT) {
      S.end = 0;
      S.arc = 0;
      S.phase = 0;
      S.done = 0;
      S.stamp.fill(-1e9);
    }
    return;
  }
  let left = step;
  while (left > 0 && S.arc < arcs) {
    const T = swingTime(S.arc);
    const need = (1 - S.phase) * T;
    const len = START[S.arc + 1] - START[S.arc];
    if (left < need) {
      S.phase += left / T;
      left = 0;
      // The bead eases in and out of each endpoint like a pendulum.
      const u = (1 - cos(PI * S.phase)) / 2;
      const upto = min(len, floor(u * len) + 1);
      if (upto > S.done) cross(S, S.arc, S.done, upto);
      S.done = max(S.done, upto);
    } else {
      left -= need;
      cross(S, S.arc, S.done, len);
      S.arc++;
      S.phase = 0;
      S.done = 0;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cover = COVER[S.depth - DMIN], stamp = S.stamp, melt = S.melt;
  const h = S.hue;
  const right = hsv(h + 0.5, 1, 255), leftc = hsv(h + 1 / 3, 1, 255), walk = hsv(h + 5 / 6, 1, 255);
  // Every lit LED is a full-strength hue, never a dim or a mix: the arcs
  // are one LED wide and sit on black.
  const melting = S.end > HOLD ? (S.end - HOLD) / MELT : -1;
  for (let p = 0; p < N; p++) {
    const c = cover[p];
    const x = p % W, y = (p / W) | 0;
    if (!c) {
      display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    let lit = S.clock - stamp[p] < S.life;
    if (lit && melting >= 0 && melt[p] < melting) lit = false;
    const col = lit ? walk : c === 1 ? right : leftc;
    display.setPixel(x, y, col[0], col[1], col[2]);
  }
  // The bead: white, with a white cross round it while it is moving.
  let bp;
  if (S.end > 0) {
    const i = min(S.arc, ARCS) - 1;
    bp = RUN[START[i + 1] - 1];
  } else {
    const len = START[S.arc + 1] - START[S.arc];
    const u = (1 - cos(PI * S.phase)) / 2;
    bp = RUN[START[S.arc] + min(len - 1, floor(u * len))];
  }
  const bx = bp % W, by = (bp / W) | 0;
  const pulse = S.end > 0 ? (S.end * 4) % 1 < 0.5 : true;
  display.setPixel(bx, by, 255, 255, 255);
  if (pulse)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = bx + dx, y = by + dy;
      if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, 255, 255, 255);
    }
}
