// ===== Patternflow pattern =====
// Title:   Ising Interface
// Family:  noise
// Idea:    An Ising magnet at its critical temperature, held up on the left and down on the right, boils in two quiet colours while the one domain wall that must cross it from bottom to top is traced every frame as a bright fractal thread, the curve whose scaling limit is SLE(3).
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ising model (Wilhelm Lenz, 1920), with the SLE(3) interface of Stanislav Smirnov (2010), pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Temp=-0.15..0.3, Trail=0..1
//
// Knob 1: Hue. Turns the thread round the wheel from pale gold at 0: pale green at 0.25, sky blue at 0.45, lilac at 0.6, pink at 0.8; its ghost turns with it from rose. The spins stay cool and quiet: teal and indigo at 0 and 0.5, green and navy at 0.25, azure and violet at 0.75.
// Knob 2: Speed. Sweeps a second, every spin offered a flip once per sweep: 20 at 2, 2 at 0.2, 30 at 3. At 2 the small bays of the wall open and close several times a second while its big bends shift over tens of seconds.
// Knob 3: Temp. The temperature as a step from Onsager's critical point T_c = 2.269: 0 is T_c, where the thread is the SLE(3) curve, about 240 lattice edges long on this 32 by 64 lattice. At -0.15 (0.85 T_c) the magnet orders, the islands shrink and the thread straightens to about 135 edges; at 0.3 (1.3 T_c) the spins scatter and the thread, about 485 edges, winds round every island it touches.
// Knob 4: Trail. How long earlier walls linger as a ghost under the thread: a half-life of 0.12 seconds at 0.06, 0.08 at 0, and 3.5 at 1, where the ghost fills the whole band the wall has wandered over.

const W = 64, H = 128, N = W * H;
const { floor, round, exp, log, sqrt, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// One spin for each 2 by 2 block of LEDs: a lattice of 32 by 64. With a spin
// per LED the wall is rough at the scale of single LEDs, its strands run
// side by side one LED apart and merge into a blob; on 2 by 2 blocks every
// strand has a spin's width of its own colour between it and the next, and
// the thread is drawn one LED wide on the up side of the wall. The smaller
// lattice also settles before the first frame: near T_c the big domains take
// about L^2.17 sweeps to form, some 1800 for L = 32, and a 64 by 128
// lattice would want four times the sweeps of four times the spins.
const B = 2, NX = W / B, NY = H / B, PW = NX + 2;
// Onsager's critical temperature, 2 / ln(1 + sqrt 2).
const TC = 2 / log(1 + sqrt(2));
// Sweeps a second at Speed 1.
const SWEEPS = 10;
// How far a fresh ghost of the wall covers the spins under it.
const GHOST = 0.6;
// Half sweeps run before the first frame, 2500 full sweeps. Tried with 300,
// the magnet still looked frozen in its ordered start: two flat halves with
// specks, and a wall that hardly left the middle line.
const BURN = 5000;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, temp: 0, trailK: 0.06, beta: 0, acc: 0, ready: false,
    spin: new Int8Array(PW * (NY + 2)), p: new Float32Array(5), parity: 0, line: new Uint8Array(N), trail: new Float32Array(N), len: 0,
  };
  const S = params.s;
  // The lattice is stored with a frame of fixed boundary spins round it.
  // Start ordered, up on the left half and down on the right, the wall
  // straight up the middle; the first update shakes it to the knob's
  // temperature.
  for (let j = -1; j <= NY; j++) for (let i = -1; i <= NX; i++) S.spin[(j + 1) * PW + i + 1] = bound(i, j);
}

// Dobrushin boundary: up all along the left edge, down all along the right,
// and on the top and bottom rows up over the left half and down over the
// right. Exactly one wall then runs from the middle of the bottom edge to
// the middle of the top.
const bound = (i, j) => (i < 0 ? 1 : i >= NX ? -1 : i < NX / 2 ? 1 : -1);
const spinAt = (S, i, j) => (i < -1 || i > NX || j < -1 || j > NY ? bound(i, j) : S.spin[(j + 1) * PW + i + 1]);

// Heat-bath probabilities that a spin comes up, for local field -4..4 in
// steps of 2: 1 / (1 + exp(-2 beta h)).
function table(S) {
  const beta = 1 / (TC * (1 + S.temp));
  S.beta = beta;
  for (let k = 0; k < 5; k++) S.p[k] = 1 / (1 + exp(-2 * beta * (2 * k - 4)));
}

// Half a sweep: every spin of one colour of the checkerboard, which share no
// neighbours, so each sees the others as they were.
function halfSweep(S, parity) {
  const sp = S.spin, p = S.p;
  for (let j = 0; j < NY; j++)
    for (let i = (j + parity) & 1, q = (j + 1) * PW + i + 1; i < NX; i += 2, q += 2) {
      const h = sp[q - 1] + sp[q + 1] + sp[q - PW] + sp[q + PW];
      sp[q] = Math.random() < p[(h + 4) >> 1] ? 1 : -1;
    }
}

// The exploration path. It walks the corners of the spin squares from the
// middle of the bottom edge, keeping up spins on its left and down spins on
// its right, until it reaches the middle of the top edge. At each corner it
// looks at the two spins ahead: a down spin ahead on the left turns it left,
// an up spin ahead on the right turns it right, otherwise it goes straight.
// Where both happen at once it turns left.
// Directions: 0 up, 1 right, 2 down, 3 left.
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
function trace(S) {
  const L = S.line;
  L.fill(0);
  let a = NX / 2, b = NY, d = 0, n = 0;
  const cap = 4 * (NX + 1) * (NY + 1);
  while (n++ < cap && !(a === NX / 2 && b === 0)) {
    // The spins ahead on the left and on the right of the corner (a, b).
    let fl, fr;
    if (d === 0) (fl = spinAt(S, a - 1, b - 1)), (fr = spinAt(S, a, b - 1));
    else if (d === 1) (fl = spinAt(S, a, b - 1)), (fr = spinAt(S, a, b));
    else if (d === 2) (fl = spinAt(S, a, b)), (fr = spinAt(S, a - 1, b));
    else (fl = spinAt(S, a - 1, b)), (fr = spinAt(S, a - 1, b - 1));
    if (fl < 0) d = (d + 3) & 3;
    else if (fr > 0) d = (d + 1) & 3;
    const na = a + DX[d], nb = b + DY[d];
    edge(L, a, b, na, nb, d);
    a = na;
    b = nb;
  }
  S.len = n;
}

// Light the two LEDs along one edge of the wall, inside the spin on its
// left, the up side; or inside the spin on its right where the left one is
// the fixed frame outside the panel, as it is all along the left edge.
function edge(L, a, b, na, nb, d) {
  // The spin on the left of the step and the one on its right.
  let li, lj, ri, rj;
  if (d === 0) (li = a - 1), (lj = nb), (ri = a), (rj = nb);
  else if (d === 2) (li = a), (lj = b), (ri = a - 1), (rj = b);
  else if (d === 1) (li = a), (lj = b - 1), (ri = a), (rj = b);
  else (li = na), (lj = b), (ri = na), (rj = b - 1);
  let i = li, j = lj;
  if (i < 0 || i >= NX || j < 0 || j >= NY) (i = ri), (j = rj);
  if (i < 0 || i >= NX || j < 0 || j >= NY) return;
  // Which two of the block's four LEDs touch the edge: for a vertical step
  // the block's right column if the block lies west of it, else its left
  // column; for a horizontal step its bottom or top row the same way.
  const vertical = d === 0 || d === 2;
  const x0 = B * i, y0 = B * j;
  if (vertical) {
    const west = i < a;
    const x = west ? x0 + B - 1 : x0;
    for (let k = 0; k < B; k++) L[(y0 + k) * W + x] = 1;
  } else {
    const north = j < b;
    const y = north ? y0 + B - 1 : y0;
    for (let k = 0; k < B; k++) L[y * W + x0 + k] = 1;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const temp = cl(k[2], -0.15, 0.3);
  if (temp !== S.temp || !S.beta) {
    S.temp = temp;
    table(S);
  }
  S.trailK = cl(k[3], 0, 1);
  const d = cl(dt || 0, 0, 0.1);
  S.t += d;
  if (!S.ready) {
    // Settle the ordered start at this temperature before the first frame.
    for (let n = 0; n < BURN; n++) halfSweep(S, n & 1);
    S.ready = true;
  }
  S.acc += d * S.speed * SWEEPS * 2;
  let n = 0;
  while (S.acc >= 1 && n < 16) {
    halfSweep(S, (S.parity ^= 1));
    S.acc -= 1;
    n++;
  }
  trace(S);
  // The ghost of earlier walls fades with a half-life set by Trail.
  const half = 0.08 + 3 * S.trailK * S.trailK + 0.4 * S.trailK;
  const keep = exp((-d * Math.LN2) / half);
  const tr = S.trail, L = S.line;
  for (let p = 0; p < N; p++) tr[p] = L[p] ? 1 : tr[p] * keep;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // The wall goes round the whole wheel from pale gold. The spins stay in
  // cool hues, teal to azure for up and blue to violet for down: dark warm
  // colours read brown on the panel, and these two are meant to be quiet.
  const k = S.hue, w = sin(2 * PI * k);
  const up = hsv(0.48 - 0.12 * w, 0.75, 0.42), down = hsv(0.72 - 0.1 * w, 0.8, 0.3);
  const wall = hsv(0.12 + k, 0.3, 1), ghost = hsv(0.93 + k, 0.55, 0.9);
  const sp = S.spin, L = S.line, tr = S.trail;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let c = sp[(floor(y / B) + 1) * PW + floor(x / B) + 1] > 0 ? up : down;
      let r = c[0], g = c[1], b = c[2];
      if (L[p]) (r = wall[0]), (g = wall[1]), (b = wall[2]);
      else if (tr[p] > 0.05) {
        const a = (round(tr[p] * 8) / 8) * GHOST;
        r += (ghost[0] - r) * a;
        g += (ghost[1] - g) * a;
        b += (ghost[2] - b) * a;
      }
      display.setPixel(x, y, round(255 * r), round(255 * g), round(255 * b));
    }
}
