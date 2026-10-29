// ===== Patternflow pattern =====
// Title:   Golomb Ruler
// Family:  number
// Idea:    A ruler runs down the panel with a mark on some of its 128 rows, every pair of marks is joined by an arc as tall as the distance it measures, and a caliper sweeps the lengths 1 to 127, lighting the arcs of each length and ticking a length scale on the right edge, so the optimal 14-mark Golomb ruler lights one arc or none at each length and Wichmann's ruler lights at least one, with the sevens piling up.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sidon sets (Simon Sidon, 1932) and Golomb rulers (W. C. Babcock's radio channels, 1953; named for Solomon W. Golomb), sparse rulers (Brian Wichmann, 1963), the greedy Sidon sequence (Abdul Majid Mian and Sarvadaman Chowla, 1944), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ruler=0..3, Shape=-1..1
//
// Knob 1: Hue. Turns the length colours round the wheel: at 0 the short arcs are sea green and the long ones run through blue and violet to rose; at 0.5 they run from rose through yellow to green.
// Knob 2: Speed. How fast the caliper measures: 16 lengths a second at 2, so a sweep of 1 to 127 takes 8 s, then the whole picture holds 1.5 s and fades back to its ghost in 1 s. At 0.2 a sweep takes 80 s, at 3 it takes 5.3 s.
// Knob 3: Ruler. Which marks: 0 the optimal Golomb ruler, 14 marks on 0..127 whose 91 arcs measure every length from 1 to 55 once and 36 longer ones never; 1 Mian and Chowla's greedy Sidon set, 12 marks on 0..122 whose 66 arcs already miss 22; 2 fourteen random marks with both ends, drawn anew each sweep, which on average measure 66 lengths and repeat 20 of them; 3 Wichmann's ruler W(1,16), 23 marks whose 253 arcs measure every length, 7 sixteen times, 14 fifteen times and so on down the multiples of 7.
// Knob 4: Shape. The outline of every arc, a half superellipse: straight chevrons at -1, where the arcs from one mark run along one ray and the picture turns into a lattice of crossing rays; half ellipses near the opening 0.06; square brackets like the dimension lines of a drawing at 1.

const W = 64, H = 128, L = 127;
const { floor, ceil, min, max, abs, sqrt, sin, cos, exp, pow, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The optimal Golomb ruler with 14 marks: its 91 differences are all
// different and 127 is the shortest length that holds 14 such marks.
const GOLOMB = [0, 4, 6, 20, 35, 52, 59, 77, 78, 86, 89, 99, 122, 127];

// Mian and Chowla's greedy Sidon sequence 1, 2, 4, 8, 13, ...: each term the
// least number that keeps all pairwise sums (so all differences) distinct.
// Shifted to start at 0, twelve terms fit, up to 122.
function mianChowla() {
  const T = [1], sums = new Set([2]);
  for (let k = 2; k - 1 <= L; k++) {
    let ok = !sums.has(2 * k);
    for (const a of T) if (sums.has(k + a)) ok = false;
    if (!ok) continue;
    for (const a of T) sums.add(k + a);
    sums.add(2 * k);
    T.push(k);
  }
  return T.map((a) => a - 1);
}

// Wichmann's ruler W(r, s): steps 1 (r times), r+1, 2r+1 (r times),
// 4r+3 (s times), 2r+2 (r+1 times), 1 (r times). Length
// 4r(r+s+2)+3(s+1) with 4r+s+3 marks; W(1,16) is 127 long with 23.
function wichmann(r, s) {
  const steps = [];
  const put = (v, n) => { for (let i = 0; i < n; i++) steps.push(v); };
  put(1, r), put(r + 1, 1), put(2 * r + 1, r), put(4 * r + 3, s), put(2 * r + 2, r + 1), put(1, r);
  const m = [0];
  for (const v of steps) m.push(m[m.length - 1] + v);
  return m;
}

// Fourteen random marks on 0..127, the ends always among them.
function randomRuler() {
  const set = new Set([0, L]);
  while (set.size < 14) set.add(1 + floor(Math.random() * (L - 1)));
  return [...set].sort((a, b) => a - b);
}

const RULERS = [() => GOLOMB, mianChowla, randomRuler, () => wichmann(1, 16)];

// Geometry. The spine stands at x = X0; an arc for the marks a < b leaves
// the spine at rows a and b and bulges right to X0 + A, A in proportion to
// b - a, so the 127-row arc reaches column X0 + AMAX. The length scale is
// the right edge: row d is the length d.
const X0 = 1.5, AMAX = 52.5, SX = 63;

// Superellipse exponent from the Shape knob: 1 chevron, 2 ellipse, 8 bracket.
const expo = (k) => (k < 0 ? pow(2, 1 + k) : pow(2, 1 + 2 * k));

// One arc's light as a list of pixels and weights: the half superellipse
// sampled along its angle, each piece of the polyline cut into steps of at
// most 0.4 LED and splatted bilinearly with its length as weight. Each arc
// owns a slot of cap entries in the shared arrays.
const TMP = new Float32Array(W * H), TOUCH = new Int32Array(W * H);
const cap = (d) => 104 + 12 * d;
function arcPixels(S, i, p) {
  const [a, b, d] = S.pairs[i], A = (AMAX * d) / L, B = d / 2, c = (a + b) / 2, e = 2 / p;
  const n = 24 + 2 * ceil(A + B), at = S.off[i], room = cap(d), I = S.I, Wt = S.Wt;
  let nt = 0, px = X0, py = a;
  const splat = (x, y, w) => {
    const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
    for (let q = 0; q < 4; q++) {
      const ii = i + (q & 1), jj = j + (q >> 1);
      if (ii < 0 || ii >= W || jj < 0 || jj >= H) continue;
      const ww = w * (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy);
      if (ww <= 0) continue;
      const k = jj * W + ii;
      if (TMP[k] === 0) {
        if (nt >= room) continue;
        TOUCH[nt++] = k;
      }
      TMP[k] += ww;
    }
  };
  for (let s = 1; s <= n; s++) {
    const th = -PI / 2 + (PI * s) / n, cs = max(0, cos(th)), sn = sin(th);
    const x = X0 + A * pow(cs, e), y = c + B * (sn < 0 ? -pow(-sn, e) : pow(sn, e));
    const len = sqrt((x - px) * (x - px) + (y - py) * (y - py)), k = max(1, ceil(len / 0.4));
    for (let u = 0; u < k; u++) {
      const f = (u + 0.5) / k;
      splat(px + (x - px) * f, py + (y - py) * f, len / k);
    }
    px = x, py = y;
  }
  for (let q = 0; q < nt; q++) {
    const k = TOUCH[q];
    I[at + q] = k, Wt[at + q] = min(1.4, TMP[k]);
    TMP[k] = 0;
  }
  S.np[i] = nt;
}

// Marks, pairs (shortest first) and how many pairs measure each length. The
// arcs are drawn over the next few frames, shortest first.
function useRuler(S, which, p) {
  S.which = which;
  const m = RULERS[which]();
  const P = [];
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) P.push([m[i], m[j], m[j] - m[i]]);
  P.sort((u, v) => u[2] - v[2]);
  const cnt = new Int32Array(L + 1);
  for (const q of P) cnt[q[2]]++;
  S.marks = m, S.pairs = P, S.cnt = cnt;
  // Denser rulers draw each arc fainter so 253 arcs do not burn to white.
  S.gain = min(1, pow(91 / P.length, 0.75));
  S.tm = new Float64Array(P.length).fill(-1);
  const off = new Int32Array(P.length + 1);
  for (let i = 0; i < P.length; i++) off[i + 1] = off[i] + cap(P[i][2]);
  S.off = off, S.np = new Int32Array(P.length);
  S.I = new Int32Array(off[P.length]), S.Wt = new Float32Array(off[P.length]);
  S.geoP = p, S.redo = 0;
}

function restart(S) {
  S.d = 0, S.phase = 0, S.pt = 0;
  S.tm.fill(-1);
  S.next = 0;
}

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, which: -1, shape: 0.06, d: 0, phase: 0, pt: 0, next: 0,
    acc: new Float32Array(W * H * 3), mf: new Float32Array(L + 1), c: [0, 0, 0],
  });
  useRuler(S, 0, expo(0.06));
  restart(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.shape = cl(k[3], -1, 1);
  const which = cl(round(k[2]), 0, 3), p = expo(S.shape);
  if (which !== S.which) useRuler(S, which, p), restart(S);
  // When the shape has moved by a visible amount the arcs are drawn again,
  // shortest first and a share each frame, so the new outline spreads out
  // from the spine over a few frames instead of costing one long frame. A
  // pass runs to the end before the next one starts.
  if (S.redo >= S.pairs.length && abs(p - S.geoP) / p > 0.02) (S.geoP = p), (S.redo = 0);
  for (let budget = 1800; S.redo < S.pairs.length && budget > 0; S.redo++) {
    arcPixels(S, S.redo, p);
    budget -= 20 + S.pairs[S.redo][2];
  }
  // Sweep: the caliper opens from 0 to 127, then the picture holds and fades.
  if (S.phase === 0) {
    S.d += 8 * S.speed * d;
    const P = S.pairs;
    while (S.next < P.length && P[S.next][2] <= S.d) S.tm[S.next++] = S.t;
    if (S.d >= L + 1) (S.phase = 1), (S.pt = 0);
  } else {
    S.pt += d * (0.5 + S.speed / 4);
    if (S.pt > 2.5) {
      if (S.which === 2) useRuler(S, 2, S.geoP);
      restart(S);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.I) return;
  const acc = S.acc, c = S.c, P = S.pairs, I = S.I, Wt = S.Wt, off = S.off, np = S.np, t = S.t;
  acc.fill(0);
  const h0 = 0.44 + S.hue;
  // Measured arcs hold their colour; after the hold they fade to the ghost.
  const fade = S.phase === 1 ? cl((S.pt - 1.5) / 1, 0, 1) : 0;
  const ghost = 0.16, mf = S.mf;
  mf.fill(0);
  for (let i = 0; i < P.length; i++) {
    const dd = P[i][2], tm = S.tm[i];
    let e = ghost, flash = 0;
    if (tm >= 0) {
      e = 1 - (1 - ghost) * fade;
      flash = exp(-(t - tm) / 0.2);
      mf[P[i][0]] = max(mf[P[i][0]], flash), mf[P[i][1]] = max(mf[P[i][1]], flash);
    }
    hsv(h0 + 0.46 * (dd / L), 0.8 - 0.6 * flash, 1, c);
    const gn = S.gain * e, r = c[0] * gn + flash, g = c[1] * gn + flash, b = c[2] * gn + flash;
    for (let q = off[i], qe = off[i] + np[i]; q < qe; q++) {
      const k = I[q] * 3, w = Wt[q];
      acc[k] += r * w, acc[k + 1] += g * w, acc[k + 2] += b * w;
    }
  }
  // The caliper's jaw: a faint vertical line where arcs of the current
  // length touch it with their tips.
  if (S.phase === 0) {
    const xj = X0 + (AMAX * S.d) / L, i = floor(xj), f = xj - i;
    for (let y = 0; y < H; y++) {
      if (i >= 0 && i < W) acc[(y * W + i) * 3 + 2] += 0.12 * (1 - f), acc[(y * W + i) * 3] += 0.06 * (1 - f), acc[(y * W + i) * 3 + 1] += 0.06 * (1 - f);
      if (i + 1 < W) acc[(y * W + i + 1) * 3 + 2] += 0.12 * f, acc[(y * W + i + 1) * 3] += 0.06 * f, acc[(y * W + i + 1) * 3 + 1] += 0.06 * f;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, (255 * (1 - exp(-1.5 * acc[k]))) | 0, (255 * (1 - exp(-1.5 * acc[k + 1]))) | 0, (255 * (1 - exp(-1.5 * acc[k + 2]))) | 0);
    }
  // The spine and its marks.
  for (let y = 0; y < H; y++) display.setPixel(0, y, 40, 40, 48);
  // A mark burns white while an arc from it is being measured.
  for (const m of S.marks) {
    const f = mf[m], v = (170 + 85 * f) | 0;
    display.setPixel(0, m, 255, 250, 240);
    display.setPixel(1, m, v, v - 5, v - 15);
    if (f > 0.05) display.setPixel(2, m, (255 * f) | 0, (255 * f) | 0, (255 * f) | 0);
  }
  // The length scale: row d ticks once measured, 2 + n LEDs long when n
  // pairs share the length, white for a moment as the caliper passes; a
  // length nobody measures blinks dark red and stays a gap. Rows the
  // caliper has not reached keep a faint dot.
  const cur = S.phase === 0 ? floor(S.d) : L + 1, rate = 8 * S.speed;
  for (let dd = 1; dd <= L; dd++) {
    const n = S.cnt[dd], since = S.phase === 0 ? (S.d - dd) / rate : 9;
    if (dd > cur) {
      display.setPixel(SX, dd, 34, 34, 40);
      continue;
    }
    if (n === 0) {
      const b = exp(-since / 0.5);
      if (b > 0.1) display.setPixel(SX, dd, (200 * b) | 0, (30 * b) | 0, (40 * b) | 0);
      continue;
    }
    const fl = exp(-since / 0.25);
    hsv(h0 + 0.46 * (dd / L), 0.7 * (1 - fl), 1 - 0.6 * fade, c);
    const len = 2 + n;
    for (let x = SX; x > SX - len; x--) display.setPixel(x, dd, (c[0] * 255) | 0, (c[1] * 255) | 0, (c[2] * 255) | 0);
  }
  if (S.phase === 0) {
    display.setPixel(SX, cur, 255, 255, 255);
    display.setPixel(SX - 1, cur, 255, 255, 255);
  }
}
