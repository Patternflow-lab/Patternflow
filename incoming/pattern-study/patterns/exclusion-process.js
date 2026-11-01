// ===== Patternflow pattern =====
// Title:   Exclusion Process
// Family:  particle
// Idea:    Particles enter a line of 64 sites across the panel at rate alpha, each hops one site right at rate 1 only when that site is empty and leaves the last site at rate beta, and the tall panel is the space-time diagram with the newest row at the top, so every particle draws its own coloured thread up and to the right, a jam stands as a block of steep threads whose holes run back to the left, and at the opening rates, equal and below one half, the front between a sparse stream and a jam wanders to and fro.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: totally asymmetric simple exclusion process (Frank Spitzer, Interaction of Markov processes, 1970; first written down for ribosomes on messenger RNA by Carolyn MacDonald, Julian Gibbs and Allen Pipkin, 1968), its exact phase diagram with open ends (Bernard Derrida, Eytan Domany and David Mukamel, 1992; Gunter Schütz and Eytan Domany, 1993); pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Alpha=0.25..1, Beta=0.25..1
//
// Knob 1: Hue. Turns the band of thread colours round the wheel. At 0 the particles take hues from cyan through azure and violet to pink, each 0.618 of the band on from the one that entered before it, so neighbouring threads never share a colour; at 0.5 the band runs from red through yellow to green.
// Knob 2: Speed. At 2 the diagram takes 16 new rows a second at the top, each row one unit of the process's time, in which a particle with an empty site ahead hops once on average, so the 128 rows hold the last 8 s; 80 s at 0.2, 5.3 s at 3.
// Knob 3: Alpha. The rate at which a particle enters an empty first site. At the opening 0.25, equal to beta, a stream at density 0.25 meets a jam at density 0.75 and the front between them wanders about 10 sites over the 128 rows; any alpha above beta (with beta below 1/2) is the high-density phase, where the jam fills the line at density 1 - beta and its front backs out of the left end, a quarter of a site a row at alpha 0.5.
// Knob 4: Beta. The rate at which the particle on the last site leaves. Above alpha (and alpha below 1/2) it is the low-density phase, a free stream at density alpha with no jam; with alpha and beta both above 1/2 it is the maximal-current phase, density 1/2 in the middle of the line and a quarter of a particle through every bond per row, however much higher the two rates go.

// Each site holds at most one particle. In every unit of time each of
// the 65 bonds (the entry, the 63 between sites and the exit) is tried
// once on average, in random order: a particle crosses a bond inside the
// line when the site beyond it is empty, comes in through the entry with
// probability alpha when site 0 is empty and goes out through the exit
// with probability beta. That is random sequential update, the process in
// continuous time sampled once a row.
//
// Derrida, Domany and Mukamel solved the stationary state exactly. The
// current through the line is alpha (1 - alpha) when alpha < beta and
// alpha < 1/2, beta (1 - beta) in the mirror case, and 1/4 when both pass
// 1/2. On alpha = beta < 1/2 the two densities alpha and 1 - beta carry
// the same current J = alpha (1 - alpha), so the front between them, a
// shock, has no drift and walks at random. Its variance grows by
// 2 J / (1 - 2 alpha) a unit of time: 0.75 at the opening, and here it
// wanders 9.8 sites (root mean square) in the 128 rows the panel holds.
//
// Every particle gets a number when it comes in and keeps it, and its
// colour comes from that number. Particles never pass one another, so
// neighbours on the line always hold consecutive numbers, and consecutive
// numbers sit 0.618 of the hue band apart, wrapped. A row stores which particle sits on each
// site at the end of the row, and dimly every site a particle passed
// through during the row, so a particle that hopped three sites leaves a
// short step instead of a gap and its thread stays joined.
//
// Before the first frame the line starts as a step between the two
// densities the ends ask for, runs 120 units to settle and then fills all
// 128 rows, so the panel opens full.

const W = 64, H = 128, N = W * H;
const { floor, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Time units of the process per row, rows per second at Speed 1.
const DT = 1, RATE = 8;
// Time run before the first row is kept, and the hue band the ids fill.
const SETTLE = 120, BAND = 0.42, PHI = 0.6180339887;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

export function setup(params) {
  params.s = {
    occ: new Int32Array(W),
    hist: new Int32Array(N),
    trail: new Int32Array(N),
    head: 0,
    next: 1,
    acc: 0,
    alpha: 0.25,
    beta: 0.25,
    hue: 0,
    ready: false,
    pal: new Uint8Array(256 * 3),
    palHue: -1,
  };
}

// One row: DT units of random sequential update over the W + 1 bonds.
function row(S, keep) {
  const occ = S.occ, a = S.alpha, b = S.beta;
  let hi = 0, ti = 0;
  if (keep) {
    S.head = (S.head + 1) % H;
    hi = S.head * W;
    for (let x = 0; x < W; x++) S.trail[hi + x] = occ[x];
    ti = hi;
  }
  const tries = (W + 1) * DT;
  for (let n = 0; n < tries; n++) {
    const k = floor(Math.random() * (W + 1));
    if (k === 0) {
      if (occ[0] === 0 && Math.random() < a) {
        occ[0] = S.next++;
        if (keep) S.trail[ti] = occ[0];
      }
    } else if (k === W) {
      if (occ[W - 1] !== 0 && Math.random() < b) occ[W - 1] = 0;
    } else if (occ[k - 1] !== 0 && occ[k] === 0) {
      occ[k] = occ[k - 1];
      occ[k - 1] = 0;
      if (keep) S.trail[ti + k] = occ[k];
    }
  }
  if (keep) for (let x = 0; x < W; x++) S.hist[hi + x] = occ[x];
}

function start(S) {
  // A step between the two densities the boundaries ask for, then let it settle.
  const left = S.alpha < 0.5 ? S.alpha : 0.5, right = S.beta < 0.5 ? 1 - S.beta : 0.5;
  for (let x = W - 1; x >= 0; x--) S.occ[x] = Math.random() < (x < W / 2 ? left : right) ? S.next++ : 0;
  for (let t = 0; t < SETTLE; t++) row(S, false);
  for (let r = 0; r < H; r++) row(S, true);
  S.ready = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.25, 0.25], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.alpha = cl(k[2] == null ? 0.25 : k[2], 0, 1);
  S.beta = cl(k[3] == null ? 0.25 : k[3], 0, 1);
  if (!S.ready) start(S);
  S.acc += d * speed * RATE;
  while (S.acc >= 1) {
    S.acc -= 1;
    row(S, true);
  }
}

function palette(S) {
  if (S.palHue === S.hue) return;
  S.palHue = S.hue;
  for (let i = 0; i < 256; i++) {
    const f = (i * PHI) % 1;
    const c = hsv(S.hue + 0.47 + f * BAND, 0.75, 1);
    S.pal[i * 3] = round(c[0] * 255);
    S.pal[i * 3 + 1] = round(c[1] * 255);
    S.pal[i * 3 + 2] = round(c[2] * 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  palette(S);
  const pal = S.pal;
  for (let y = 0; y < H; y++) {
    const r = ((S.head - y) % H + H) % H, o = r * W;
    const fade = 1 - 0.35 * (y / (H - 1));
    for (let x = 0; x < W; x++) {
      const id = S.hist[o + x], tr = S.trail[o + x];
      let v = 0, c = 0;
      if (id) { c = id & 255; v = fade; }
      else if (tr) { c = tr & 255; v = fade * 0.45; }
      if (v > 0) display.setPixel(x, y, round(pal[c * 3] * v), round(pal[c * 3 + 1] * v), round(pal[c * 3 + 2] * v));
      else display.setPixel(x, y, 0, 0, 0);
    }
  }
}
