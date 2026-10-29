// ===== Patternflow pattern =====
// Title:   Foam Coarsening
// Family:  cells
// Idea:    A fine two-dimensional foam coarsens by Potts-model Monte Carlo on the panel, every cell coloured by how many neighbours it has, so the cells with fewer than six sides glow one colour and shrink away with a spark while the cells with more than six glow the far colour and swell, whatever their size, as von Neumann's law says; when only a fraction of the cells are left a new fine foam is laid down from the top.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: von Neumann's law for two-dimensional foams (John von Neumann, 1952), grain-boundary motion (W. W. Mullins, 1956), Potts-model grain growth (M. P. Anderson, D. J. Srolovitz, G. S. Grest and P. S. Sahni, 1984), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=0..1, Noise=0..1
//
// Knob 1: Hue. Turns the side-count colours round the wheel together. At 0 a six-sided cell is cyan, the shrinking five-, four- and three-sided cells go green, lime and orange, and the growing seven-, eight- and nine-sided cells blue, violet and pink.
// Knob 2: Speed. Monte Carlo sweeps a second, 3.5 at 2 for the finest foam. At the start knobs the 640 seeds leave 608 cells once two sweeps have rounded their walls, and the first new foam comes down after 7.0 s, then one every 8.2 s; at 3 every 5.4 s, at 0.2 every 79 s. A coarser foam gets more sweeps, as the square root of its cell size, since its cells take longer to die.
// Knob 3: Size. How many cells a new foam is laid down with: 640 at 0, 12.8 LEDs each, down to 60 at 1, 137 LEDs each, evenly in the logarithm between. A foam is laid anew when fewer than 45% of its cells are left: every 8.2 s at 0, 19 s at 0.5 and 32 s at 1, at Speed 2.
// Knob 4: Noise. The temperature of the Monte Carlo, from 0.12 to 1.22 of a bond. Low, the walls are smooth arcs that slide; high, they shiver and roughen, a cell can lose a corner and win it back, and the foam coarsens faster, a new one every 6.6 s at 1.

// In a two-dimensional foam the walls meet three at a time at 120 degrees
// and each wall moves toward its centre of curvature at a speed set by its
// curvature. Add up the turning round a cell with n sides: the walls must
// turn through 2 pi, the corners take n times pi / 3 of it, so the walls'
// curvature sums to (pi / 3)(6 - n), and the area changes as
// dA/dt = kappa (n - 6), independent of the cell's size (von Neumann 1952 for
// soap froth, Mullins 1956 for grain boundaries). A five-sided cell shrinks
// even when it is the biggest on the panel.
//
// The panel runs the large-Q Potts model the way Anderson, Srolovitz, Grest
// and Sahni grew grains in 1984: every LED holds the number of its grain,
// a bond between unlike neighbours costs one, and a Monte Carlo step offers
// an LED the grain of one of its eight neighbours and takes it when the cost
// does not rise, or with exp(-rise / T) when it does. The grid is a torus,
// so no cell touches a wall of the panel's own.
//
// Checked by running this file's own update at the start knobs for 300 s,
// the side counts read every half second and the frames with a front left
// out (two cells are neighbours when one LED face parts them). Grouped by n,
// the mean dA/dt in LEDs a second is -3.15 for four sides, -1.50 for five,
// 0.20 for six, 2.05 for seven, 3.92 for eight, 5.62 for nine and 7.31 for
// ten. The line through them is 1.77 (n - 5.85), r^2 0.9997, which at 3.5
// sweeps a second is 0.51 LEDs a sweep for each side. Three-sided cells
// shrink at only 2.52: they are a few LEDs across, too small for the lattice
// to bend their walls. The mean side count is 5.87; a lattice cannot draw
// every short wall, so it stays under the 6 Euler's formula gives a torus.

const W = 64, H = 128, N = W * H, MAXG = 2048, SHIFT = 11;
const { floor, min, exp, sqrt, abs, round, random, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Moore neighbours on the torus: right, left, down, up, then the corners.
const NB = new Int32Array(N * 8);
const DX = [1, -1, 0, 0, 1, -1, 1, -1], DY = [0, 0, 1, -1, 1, 1, -1, -1];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    for (let k = 0; k < 8; k++) NB[(y * W + x) * 8 + k] = ((y + DY[k] + H) % H) * W + ((x + DX[k] + W) % W);

const FRESH = 640, FEWEST = 60, LEFT = 0.45;
const SPARK = 0.35;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}

export function setup(params) {
  params.s = {
    g: new Int32Array(N), area: new Int32Array(MAXG), sides: new Uint8Array(MAXG), shown: new Float32Array(MAXG),
    keys: new Int32Array(N * 2), list: new Int32Array(FRESH),
    alive: 0, C: 0, laid: 0, debt: 0, T: -1, boltz: new Float32Array(9),
    front: -1, sx: null, sy: null, sid: null,
    sparks: [], hue: 0, speed: 2, c: [0, 0, 0], palette: new Float32Array(13 * 3), first: true,
  };
}

// The grain of the nearest new seed to an LED centre, on the torus. Only
// the seeds in a band of rows round it are tried: the band is three seed
// spacings each way, and a Poisson foam leaves a disc that wide empty about
// once in 10^12 tries.
function band(S, y) {
  const { sy } = S, R = 3 * sqrt(N / sy.length) + 2, list = S.list;
  let m = 0;
  for (let i = 0; i < sy.length; i++) {
    let dy = abs(y - sy[i]);
    if (dy > H / 2) dy = H - dy;
    if (dy <= R) list[m++] = i;
  }
  return m;
}

function nearest(S, x, y, m) {
  const { sx, sy, sid, list } = S;
  let best = 1e9, id = sid[0];
  for (let j = 0; j < m; j++) {
    const i = list[j];
    let dx = abs(x - sx[i]), dy = abs(y - sy[i]);
    if (dx > W / 2) dx = W - dx;
    if (dy > H / 2) dy = H - dy;
    const d = dx * dx + dy * dy;
    if (d < best) (best = d), (id = sid[i]);
  }
  return id;
}

// Seeds for a new Poisson Voronoi foam, each with a grain number no LED holds.
function newSeeds(S, count) {
  const { area } = S;
  const sx = new Float32Array(count), sy = new Float32Array(count), sid = new Int32Array(count);
  let next = 0;
  for (let i = 0; i < count; i++) {
    while (area[next] > 0) next++;
    S.shown[next] = 99;
    sid[i] = next++;
    sx[i] = random() * W;
    sy[i] = random() * H;
  }
  S.sx = sx;
  S.sy = sy;
  S.sid = sid;
}

function give(S, i, id) {
  const { g, area } = S, old = g[i];
  if (old === id) return;
  if (--area[old] === 0) S.alive--;
  if (area[id]++ === 0) S.alive++;
  g[i] = id;
}

function layRow(S, y) {
  const m = band(S, y + 0.5);
  for (let x = 0; x < W; x++) give(S, y * W + x, nearest(S, x + 0.5, y + 0.5, m));
}

function layAll(S) {
  const { g, area } = S;
  area.fill(0);
  newSeeds(S, S.C);
  for (let y = 0; y < H; y++) {
    const m = band(S, y + 0.5);
    for (let x = 0; x < W; x++) {
      const id = nearest(S, x + 0.5, y + 0.5, m);
      g[y * W + x] = id;
      area[id]++;
    }
  }
  S.alive = 0;
  for (let i = 0; i < MAXG; i++) if (area[i] > 0) S.alive++;
  S.laid = S.C;
  for (let i = 0; i < MAXG; i++) S.shown[i] = 0;
}

// Monte Carlo attempts: an LED is offered one neighbour's grain.
function steps(S, count) {
  const { g, area, boltz, sparks } = S;
  for (let a = 0; a < count; a++) {
    const i = (random() * N) | 0, o = i * 8;
    const b = g[NB[o + ((random() * 8) | 0)]], c = g[i];
    if (b === c) continue;
    let rise = 0;
    for (let k = 0; k < 8; k++) {
      const q = g[NB[o + k]];
      if (q === c) rise++;
      else if (q === b) rise--;
    }
    if (rise > 0 && random() >= boltz[rise]) continue;
    g[i] = b;
    area[b]++;
    if (--area[c] === 0) {
      S.alive--;
      if (sparks.length < 64) sparks.push({ x: i % W, y: (i / W) | 0, life: SPARK });
    }
  }
}

// The side count of every grain: grains are neighbours when one LED face
// parts them. Pairs are packed into one integer, sorted and counted once.
function countSides(S) {
  const { g, keys, sides } = S;
  let m = 0;
  for (let i = 0; i < N; i++) {
    const a = g[i], r = g[NB[i * 8]], d = g[NB[i * 8 + 2]];
    if (r !== a) keys[m++] = a < r ? (a << SHIFT) | r : (r << SHIFT) | a;
    if (d !== a) keys[m++] = a < d ? (a << SHIFT) | d : (d << SHIFT) | a;
  }
  const pairs = keys.subarray(0, m).sort();
  sides.fill(0);
  let prev = -1;
  for (let j = 0; j < m; j++) {
    const k = pairs[j];
    if (k === prev) continue;
    prev = k;
    sides[k >> SHIFT]++;
    sides[k & (MAXG - 1)]++;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.C = round(FRESH * pow(FEWEST / FRESH, cl(kv[2], 0, 1)));
  const T = 0.12 + 1.1 * cl(kv[3], 0, 1);
  if (T !== S.T) {
    S.T = T;
    for (let k = 0; k < 9; k++) S.boltz[k] = exp(-k / T);
  }
  if (S.first) {
    S.first = false;
    layAll(S);
    steps(S, 2 * N);
    countSides(S);
    for (let i = 0; i < MAXG; i++) S.shown[i] = S.sides[i] - 6;
  }

  // A new foam comes down from the top as a front, row by row.
  if (S.front < 0 && (S.alive < LEFT * S.laid || abs(S.C - S.laid) > 0.25 * S.laid)) {
    newSeeds(S, S.C);
    S.laid = S.C;
    S.front = 0;
  }
  if (S.front >= 0) {
    const to = min(H, S.front + (d * S.speed * H) / 2.4);
    for (let y = floor(S.front); y < floor(to); y++) layRow(S, y);
    S.front = to >= H ? -1 : to;
  }

  // Sweeps a second, faster for a coarse foam so its cells still come and go.
  const rate = 1.75 * S.speed * sqrt(FRESH / S.laid);
  S.debt += rate * d * N;
  const n = floor(S.debt);
  S.debt -= n;
  steps(S, n);
  countSides(S);

  const ease = min(1, d * 8);
  for (let i = 0; i < MAXG; i++) {
    if (S.area[i] === 0) continue;
    const want = cl(S.sides[i] - 6, -3, 3);
    // A grain just laid takes its colour at once.
    S.shown[i] = S.shown[i] > 50 ? want : S.shown[i] + (want - S.shown[i]) * ease;
  }
  for (const s of S.sparks) s.life -= d * S.speed * 0.5;
  S.sparks = S.sparks.filter((s) => s.life > 0);

  // Thirteen colours for n - 6 from -3 to 3 in half steps.
  for (let j = 0; j < 13; j++) {
    const v = j / 2 - 3;
    hsv(S.hue + 0.5 + 0.13 * v, v === 0 ? 0.45 : 0.9, v === 0 ? 0.85 : 1, S.c);
    S.palette[j * 3] = S.c[0];
    S.palette[j * 3 + 1] = S.c[1];
    S.palette[j * 3 + 2] = S.c[2];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { g, shown, palette } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, a = g[i];
      // A wall is the LED whose right or lower neighbour is another grain.
      if (g[NB[i * 8]] !== a || g[NB[i * 8 + 2]] !== a) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const j = round((shown[a] + 3) * 2) * 3;
      display.setPixel(x, y, palette[j], palette[j + 1], palette[j + 2]);
    }
  // A cell that has just shrunk away flashes white where it closed.
  for (const s of S.sparks) {
    const v = 255 * (s.life / SPARK);
    display.setPixel(s.x, s.y, v, v, v);
    if (s.life > SPARK / 2) {
      const u = v * 0.45;
      display.setPixel((s.x + 1) % W, s.y, u, u, u);
      display.setPixel((s.x + W - 1) % W, s.y, u, u, u);
      display.setPixel(s.x, (s.y + 1) % H, u, u, u);
      display.setPixel(s.x, (s.y + H - 1) % H, u, u, u);
    }
  }
}
