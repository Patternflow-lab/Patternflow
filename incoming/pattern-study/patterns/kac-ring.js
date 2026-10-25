// ===== Patternflow pattern =====
// Title:   Kac Ring
// Family:  rhythm
// Idea:    Mark Kac's ring of 64 balls steps round its 64 columns, each ball flipping colour as it crosses one of an odd number of marked edges, the newest step entering at the bottom so the panel always holds one whole 128-step period, a quilt of parallelograms that goes all dark at its middle row and all light again at its ends, with the white share of each row traced against the Stosszahlansatz curve that says it should settle at a half.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kac ring model (Mark Kac, 1959)
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Marks=3..15, Dark=0..0.5
//
// Knob 1: Hue. Turns the colour of the light balls round the wheel, and the dashed prediction opposite them; the dark balls stay a deep navy and the measured trace white. At 0 the light balls are ice cyan and the prediction coral, at 0.25 violet, at 0.5 rose with a cyan prediction and at 0.75 lime.
// Knob 2: Speed. Steps a second, eight times the knob: 16 at 2, so a whole period of 128 steps passes in 8 s; 1.6 at 0.2 and 24 at 3.
// Knob 3: Marks. How many of the 64 edges are marked, the knob rounded to an odd number: 3 at the start, 7 at a quarter of the way, 9 at half, 13 at three quarters and 15 at the end. Three marks make parallelograms tens of LEDs tall; fifteen make a close weave. A new count redraws the whole period at once.
// Knob 4: Dark. How many balls start dark, side by side in one run: none at 0, 4 of 64 at 0.06 (a 4-LED band that crosses the quilt and inverts it), 16 at 0.25 and half the ring at 0.5. The ring comes back to exactly this start every 128 steps whatever the share, and the prediction starts from it.

const W = 64, H = 128;
// The ring: N sites, one per column, and the period 2N, one per row.
const N = 64, P = 128;
const { floor, round, min, max, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Steps a second for each unit of Speed.
const RATE = 8;
// Hue of the light balls at knob 0.
const HUE0 = 0.5;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    begun: false, hue: 0, speed: 2, m: 0, nd: -1, acc: 0,
    // marks[e] is 1 when the edge from site e to site e+1 is marked; init is
    // the start (1 = a dark ball), cur the ring now, at step k of its period.
    marks: new Uint8Array(N), init: new Uint8Array(N), cur: new Uint8Array(N), nxt: new Uint8Array(N), k: 0,
    // One row per step of the period, indexed by step mod 128: the colours,
    // the light share, and the Stosszahlansatz prediction for that step.
    rows: new Uint8Array(P * N), wf: new Float32Array(P), wp: new Float32Array(P),
    col: new Float32Array(12),
  };
}

const oddOf = (v) => 2 * round((cl(v, 3, 15) - 1) / 2) + 1;

// m distinct edges out of N, a partial shuffle.
function pick(out, m) {
  const idx = Array.from({ length: N }, (_, i) => i);
  out.fill(0);
  for (let i = 0; i < m; i++) {
    const j = i + floor(Math.random() * (N - i));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
    out[idx[i]] = 1;
  }
}

// One step of the ring: every ball moves one site on, and a ball that
// crosses a marked edge changes colour.
function step(cur, marks, out) {
  for (let x = 0; x < N; x++) out[(x + 1) % N] = cur[x] ^ marks[x];
}

function lightShare(c) {
  let n = 0;
  for (let x = 0; x < N; x++) n += c[x] ? 0 : 1;
  return n / N;
}

// Boltzmann's coarse equation for the ring: the light-minus-dark share
// shrinks by (1 - 2 mu) every step, so the light share heads for one half.
function predict(S, k) {
  const w0 = lightShare(S.init), mu = S.m / N;
  return 0.5 + (w0 - 0.5) * pow(1 - 2 * mu, k);
}

function store(S, k, c) {
  S.rows.set(c, k * N);
  S.wf[k] = lightShare(c);
  S.wp[k] = predict(S, k);
}

// The whole period at once, as if these marks had run all along: rows for
// steps 0..127 from the start, and the ring set back to step k.
function fill(S) {
  const a = S.init.slice(), b = new Uint8Array(N);
  for (let k = 0; k < P; k++) {
    store(S, k, a);
    if (k === S.k) S.cur.set(a);
    step(a, S.marks, b);
    a.set(b);
  }
}

function advance(S) {
  step(S.cur, S.marks, S.nxt);
  S.cur.set(S.nxt);
  S.k = (S.k + 1) % P;
  // Back at the start: a fresh set of marks, as many as before.
  if (S.k === 0) pick(S.marks, S.m);
  store(S, S.k, S.cur);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 3, 0.06];
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const m = oddOf(kv[2]), nd = round(cl(kv[3], 0, 0.5) * N);
  if (!S.begun || m !== S.m || nd !== S.nd) {
    if (m !== S.m) {
      S.m = m;
      pick(S.marks, m);
    }
    if (nd !== S.nd) {
      S.nd = nd;
      // The dark balls start side by side, a run of nd from a random site.
      const a = floor(Math.random() * N);
      S.init.fill(0);
      for (let i = 0; i < nd; i++) S.init[(a + i) % N] = 1;
    }
    S.begun = true;
    fill(S);
  }
  S.acc += cl(dt || 0, 0, 0.1) * RATE * S.speed;
  for (let n = 0; S.acc >= 1 && n < 8; n++) {
    S.acc -= 1;
    advance(S);
  }
  S.acc = min(S.acc, 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const C = S.col;
  // Light balls, dark balls, the measured trace and the predicted one.
  hsv(HUE0 + S.hue, 0.6, 1, C, 0);
  hsv(0.66, 0.85, 0.2, C, 3);
  C[6] = C[7] = C[8] = 1;
  hsv(HUE0 + S.hue + 0.5, 0.7, 0.9, C, 9);
  const c8 = Array.from(C, (v) => round(v * 255));
  const xa = new Int16Array(H), xp = new Int16Array(H);
  for (let y = 0; y < H; y++) {
    const r = (S.k + 1 + y) % P;
    xa[y] = round(S.wf[r] * (W - 2));
    xp[y] = round(S.wp[r] * (W - 2));
  }
  for (let y = 0; y < H; y++) {
    const r = (S.k + 1 + y) % P, o = r * N;
    const a0 = min(xa[y], y ? xa[y - 1] : xa[y]), a1 = max(xa[y], y ? xa[y - 1] : xa[y]) + 1;
    // The prediction starts again with each period, so it is not joined
    // across the start row.
    const q = y && r ? xp[y - 1] : xp[y], p0 = min(xp[y], q), p1 = max(xp[y], q) + 1;
    // The prediction is dashed, two rows on and two off, the dashes riding
    // with their steps.
    const dash = (r & 3) < 2;
    for (let x = 0; x < W; x++) {
      let c = S.rows[o + x] ? 3 : 0;
      if (x >= a0 && x <= a1) c = 6;
      else if (dash && x >= p0 && x <= p1) c = 9;
      display.setPixel(x, y, c8[c], c8[c + 1], c8[c + 2]);
    }
  }
}
