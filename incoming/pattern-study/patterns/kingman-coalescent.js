// ===== Patternflow pattern =====
// Title:   Kingman Coalescent
// Family:  data
// Idea:    A Moran population of 64 runs forward one birth at a time while the panel draws the family tree of the living as a flame chart, now along the bottom row and the past going up, each LED in the colour of the ancestor its column came from at that time, so the narrow blocks at the bottom merge fast into a few wide ones, the last two take about as long to meet as all the others together, and when one of them dies out the common ancestor jumps forward and the panel takes the survivor's colours.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kingman's coalescent (John Kingman, 1982), traced back through a Moran population (Patrick Moran, 1958)
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Span=3..9, Speed=0.2..3, Width=1..4, Mutation=0..1
//
// Knob 1: Span. How far back the top row reaches, in units of Kingman time: N(N-1)/2 = 2016 Moran events, about 31 generations of the 64. At 3 a row is 48 events and the common ancestor of all 64 sits on average 1.97 units back, at row 83 of 128; at 6 at row 42; at 9 a row is 143 events, the tree crowds into the bottom 28 rows and above it the one line of ancestors shows its mutations as bands.
// Knob 2: Speed. At 2 the population runs 0.06 units of Kingman time a second, 121 births, and the panel climbs 2.5 rows a second at Span 3; the common ancestor of all 64 moves forward on average every 17 seconds, by about 43 rows. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Width. LEDs for each traced individual. At 1 all 64 are traced, one column each, and a block gets its dark seam from two LEDs wide; at 2 the first 32 of the population's 64 places, at 3 the first 21, at 4 the first 16, each 4 LEDs with a seam. The common ancestor of a sample can also move back, when a newborn's line joins the sample's tree above it: at 4 it moves forward every 0.34 units of Kingman time and back every 0.5.
// Knob 4: Mutation. The chance that a birth carries a mutation, which steps the child's hue 0.05 to 0.11 round the wheel either way. 0.03 at 0 and 0.066 at the start, about two along each line per unit of Kingman time, so the two families of the last split mostly differ in colour; at 1 0.63, nearly every row of every block steps and the blocks turn to stripes.

const W = 64, H = 128, N = 64;
// One unit of Kingman time: N(N-1)/2 Moran events, in which a given pair of
// lineages meets once on average going back.
const UNIT = (N * (N - 1)) / 2;
// Every individual ever born gets an id, in order of birth; its parent, the
// event it was born in and its hue sit in a ring of the last RING births.
const RING = 1 << 16, MASK = RING - 1;
// Kingman time run before the first frame, so the history covers the panel.
const BURN = 16;
// Kingman time per second at Speed 1.
const RATE = 0.03;
const { floor, round, random, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    init: false, ev: 0, next: 0, acc: 0, n: 0, span: 3, speed: 2, mu: 0.05, shift: 0,
    par: new Int32Array(RING), born: new Float64Array(RING), hue: new Float32Array(RING),
    slot: new Int32Array(N), front: new Int32Array(N), tm: 0, order: new Int32Array(N), anc: new Int32Array(W * H),
    c: [0, 0, 0],
  };
}

// The founders: N individuals with no parent, born at event 0.
function found(S) {
  for (let i = 0; i < N; i++) {
    S.par[i] = -1;
    S.born[i] = 0;
    S.hue[i] = 0.58;
    S.slot[i] = i;
  }
  S.next = N;
  S.ev = 0;
}

// One Moran event: a parent picked at random has a child, which takes the
// place of another individual picked at random, who dies.
function event(S) {
  const p = floor(random() * N);
  let d = floor(random() * (N - 1));
  if (d >= p) d++;
  const id = S.next++, j = id & MASK, pa = S.slot[p];
  S.ev++;
  S.par[j] = pa;
  S.born[j] = S.ev;
  // A mutation, with chance mu: the hue steps a little either way.
  let m = 0;
  if (random() < S.mu) m = (random() < 0.5 ? -1 : 1) * (0.05 + 0.06 * random());
  S.hue[j] = S.hue[pa & MASK] + m;
  S.slot[d] = id;
}

const parent = (S, a) => (a < N || S.next - a > RING - 2 * N ? -1 : S.par[a & MASK]);

// Going back from the first n slots, always stepping the youngest ancestor
// to its parent, until one is left: returns that common ancestor and, in
// S.tm, the Moran events back to the merge of the last two lineages.
function mrca(S, n) {
  const f = S.front;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = S.slot[i];
    let dup = false;
    for (let j = 0; j < k; j++) if (f[j] === a) dup = true;
    if (!dup) f[k++] = a;
  }
  S.tm = 0;
  while (k > 1) {
    let m = 0;
    for (let j = 1; j < k; j++) if (f[j] > f[m]) m = j;
    const a = f[m], q = parent(S, a);
    if (q < 0) return -1;
    let dup = false;
    for (let j = 0; j < k; j++) if (f[j] === q) dup = true;
    if (dup) {
      f[m] = f[--k];
      S.tm = S.ev - S.born[a & MASK] + 1;
    } else f[m] = q;
  }
  return f[0];
}

// Order of two individuals in the flame chart: follow both lines back to
// where they meet; the one that is that ancestor itself comes first,
// otherwise the one whose line left it earlier. The order of two living
// individuals never changes, so the chart only moves where they are born
// and die.
function cmp(S, a, b) {
  let pa = -1, pb = -1;
  while (a !== b) {
    if (a > b) {
      const q = parent(S, a);
      if (q < 0) return a - b;
      pa = a;
      a = q;
    } else {
      const q = parent(S, b);
      if (q < 0) return a - b;
      pb = b;
      b = q;
    }
  }
  if (pa < 0) return -1;
  if (pb < 0) return 1;
  return pa - pb;
}

function sortOrder(S) {
  const { order, slot } = S, n = S.n;
  for (let i = 1; i < n; i++) {
    const v = order[i], id = slot[v];
    let j = i - 1;
    while (j >= 0 && cmp(S, slot[order[j]], id) > 0) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [3, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.span = cl(k[0], 3, 9);
  S.speed = cl(k[1], 0.2, 3);
  const w = round(cl(k[2], 1, 4)), n = floor(W / w);
  S.mu = 0.03 + 0.6 * cl(k[3], 0, 1);
  if (!S.init) {
    found(S);
    for (let e = 0; e < BURN * UNIT; e++) event(S);
    // Run on until the traced tree is a typical one, its last merge between
    // 0.8 and 1.3 times Kingman's mean 2(1 - 1/n) back, and turn the colours
    // so that the common ancestor is azure.
    const mean = 2 * (1 - 1 / n) * UNIT;
    for (let tries = 0; tries < 60; tries++) {
      const a = mrca(S, n);
      if (a >= 0 && S.tm > 0.8 * mean && S.tm < 1.3 * mean) break;
      for (let e = 0; e < UNIT / 5; e++) event(S);
    }
    const a = mrca(S, n);
    if (a >= 0) S.shift = 0.58 - S.hue[a & MASK];
    S.init = true;
  }
  if (n !== S.n) {
    S.n = n;
    for (let i = 0; i < n; i++) S.order[i] = i;
  }
  S.acc += d * S.speed * RATE * UNIT;
  while (S.acc >= 1) {
    event(S);
    S.acc -= 1;
  }
  sortOrder(S);
  // Each lineage's ancestor at each row's time. Rows sit on a grid of
  // absolute times, so the picture climbs a whole row at a time.
  const { anc, order, slot, born } = S, step = (S.span * UNIT) / (H - 1), K = floor(S.ev / step);
  for (let i = 0; i < n; i++) {
    let a = slot[order[i]];
    anc[i] = a;
    for (let r = 1; r < H; r++) {
      const T = (K - r + 1) * step;
      for (;;) {
        if (born[a & MASK] <= T) break;
        const q = parent(S, a);
        if (q < 0) break;
        a = q;
      }
      anc[r * W + i] = a;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const { anc, hue, c } = S, n = S.n;
  const col = new Int32Array(W);
  for (let x = 0; x < W; x++) col[x] = floor((x * n) / W);
  let top = -1;
  for (let r = 0; r < H; r++) {
    const row = r * W, y = H - 1 - r;
    if (top < 0 && anc[row] === anc[row + n - 1]) top = r;
    const val = 1 - 0.12 * (r / (H - 1));
    // Each block: a run of columns with one ancestor in this row. A dark
    // seam takes its first column when it is two or more wide, and it is
    // shaded round like a tube.
    for (let x0 = 0; x0 < W; ) {
      const a = anc[row + col[x0]];
      let x1 = x0 + 1;
      while (x1 < W && anc[row + col[x1]] === a) x1++;
      const seam = x0 > 0 && x1 - x0 > 1 ? 1 : 0, l0 = x0 + seam, wd = x1 - l0;
      hsv(hue[a & MASK] + S.shift, 0.68, val, c);
      for (let x = x0; x < x1; x++) {
        if (x < l0) {
          display.setPixel(x, y, 0, 0, 0);
          continue;
        }
        const sh = 0.66 + 0.34 * sin((PI * (x - l0 + 0.5)) / wd);
        let R = c[0] * 255 * sh, G = c[1] * 255 * sh, B = c[2] * 255 * sh;
        // A merge: two blocks of the row below meet here.
        if (r > 0 && x > x0 && anc[row - W + col[x]] !== anc[row - W + col[x - 1]]) {
          const g = r === top ? 0.95 : 0.7;
          R += (255 - R) * g;
          G += (255 - G) * g;
          B += (255 - B) * g;
        }
        display.setPixel(x, y, round(R), round(G), round(B));
      }
      x0 = x1;
    }
  }
}
