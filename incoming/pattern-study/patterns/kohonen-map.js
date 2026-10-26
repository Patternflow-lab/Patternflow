// ===== Patternflow pattern =====
// Title:   Kohonen Map
// Family:  data
// Idea:    A lattice of 288 nodes thrown as a random tangle over a shape of faint dots, an annulus, two crescents or a tall S, learns the shape by Kohonen's rule, each dot pulling its nearest node and that node's lattice neighbours toward it, so the tangle draws together, unfolds into a woven cloth coloured by lattice place and spreads over the shape as the neighbourhood shrinks, or as a chain folds into a Peano-like curve; it holds, fades, and the next shape starts.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the self-organizing map (Teuvo Kohonen, 1982), its topographic error (Kimmo Kiviluoto, 1996), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lattice=0..1, Radius=0.5..3
//
// Knob 1: Hue. Turns the cloth's colours round the wheel together. A node's hue is set by its place along the lattice's long side and its whiteness by its place across the short side: at 0 the long side runs azure, blue, violet, magenta; at 0.25 violet to teal; at 0.5 rose to blue. The scale runs the other way round when it would cross the orange to lime gap, which reads brown when dim.
// Knob 2: Speed. 2 anneals in 14 seconds on 9,000 samples a second, about 440 a node: the neighbourhood radius falls from a quarter of the lattice's long side (6 nodes for the sheet, 72 for the chain) to the Radius knob and the learning rate from 0.5 to 0.02, both exponentially, and the first 2.5 seconds learn up to 3,000 times slower so the tangle is seen drawing together. The map then holds 5 seconds, still learning at the last rate, and fades in 0.6. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Lattice. The 288 nodes as a 12 x 24 sheet at 0, then 8 x 36, 6 x 48, 4 x 72, 3 x 96 and 2 x 144, and a chain of 288 at 1; a new lattice starts the shape again from a tangle. A sheet is drawn as a cloth, its cells fainter where stretched and darker where turned over; a ribbon follows the S and the crescents and leaves the annulus open as a C; the chain is a curve through its nodes in order, and at the opening Radius it folds back and forth until it is 828 LEDs long on the annulus, 0.76 of sqrt(288 x area), the length of a path through 288 even cells.
// Knob 4: Radius. The neighbourhood radius the anneal ends at, 0.5 to 3 lattice steps. At 0.5 the sheet reaches the shape's edges: on the annulus after the hold a dot lies 1.52 LEDs from its nearest node on average (the quantization error; 288 even square cells would give 1.44), and 16% of dots have their two nearest nodes not side by side on the lattice (Kiviluoto's topographic error), nearly all of them diagonal neighbours. At 3 the sheet stays smooth and shrinks inside the shape: quantization error 3.62, topographic error 9.8%.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, cos, sin, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Kohonen's map: a lattice of nodes, each with a weight, here a point of
// the panel. For every sample x the best-matching node c (the nearest
// weight) and its lattice neighbours k move toward x:
//   w_k += alpha h(|k - c|) (x - w_k),  h(d) = exp(-d^2 / (2 sigma^2)),
// with d measured on the lattice, not on the panel. While sigma spans the
// lattice every node moves almost alike and the map orders itself; as
// sigma shrinks the nodes spread out over the data, and nodes that are
// neighbours on the lattice mostly stay neighbours on the panel.

// Lattices of 288 nodes, from the sheet to the chain.
const DIMS = [[12, 24], [8, 36], [6, 48], [4, 72], [3, 96], [2, 144], [1, 288]];
const NODES = 288;
// The anneal, in seconds at Speed 2: the neighbourhood radius falls from a
// quarter of the lattice's long side to the Radius knob, the learning rate
// from A0 to A1, both exponentially; then the map holds, fades and a new
// shape starts.
const ANNEAL = 14, HOLD = 5, FADE = 0.6, A0 = 0.5, A1 = 0.02, RAMP = 2.5;
// Samples a second of simulated time.
const RATE = 9000;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

// The data: three shapes in panel coordinates, each a sampler that draws
// points about evenly over its area.
const SHAPES = [
  // An elliptical annulus, outer semi-axes 30 x 60, inner 15 x 34.
  (out) => {
    for (;;) {
      const x = 2 + Math.random() * 60, y = 4 + Math.random() * 120;
      const u = (x - 32) / 30, v = (y - 64) / 60, a = (x - 32) / 15, b = (y - 64) / 34;
      if (u * u + v * v <= 1 && a * a + b * b >= 1) return (out[0] = x), (out[1] = y), out;
    }
  },
  // Two crescents, the two moons turned upright: half rings of radius 1
  // and width 0.5, the second turned half a turn and shifted by (0.5, 1),
  // drawn 30 LEDs to the unit across and 33 down.
  (out) => {
    const th = Math.random() * PI, r = sqrt(0.5625 + Math.random() * (1.5625 - 0.5625));
    let X, Y;
    if (Math.random() < 0.5) (X = r * sin(th)), (Y = r * cos(th));
    else (X = 0.5 - r * sin(th)), (Y = 1 - r * cos(th));
    out[0] = 32 + 30 * (X - 0.25);
    out[1] = 64 + 33 * (Y - 0.5);
    return out;
  },
  // A tall S: two elliptical arcs of 250 degrees, 12 LEDs thick, the lower
  // the upper turned half a turn. The offset across the arc is drawn with
  // weight r + t, as an even spread over a ring of mean radius 26 would be.
  (out) => {
    const s = Math.random() < 0.5 ? 1 : -1, ph = (20 + Math.random() * 250) * (PI / 180);
    const t = sqrt(400 + Math.random() * (1024 - 400)) - 26;
    out[0] = 32 + s * (24 + t) * cos(ph);
    out[1] = 62 - s * (28 + (28 + t) * sin(ph));
    return out;
  },
];

export function setup(params) {
  params.s = {
    dim: -1, shape: 0, phase: 0, pt: 0, hue: 0, sigma: 1,
    wx: new Float32Array(NODES), wy: new Float32Array(NODES),
    hx: new Float32Array(NODES + 1), samp: new Float32Array(240), ns: 0,
    rgb: new Float32Array(W * H * 3), col: new Float32Array(NODES * 3), c: [0, 0, 0], p: [0, 0],
  };
}

function start(S, dim, next) {
  if (next) S.shape = (S.shape + 1) % SHAPES.length;
  S.dim = dim;
  [S.cols, S.rows] = DIMS[dim];
  // The random tangle: every node at a random spot of the panel.
  for (let k = 0; k < NODES; k++) {
    S.wx[k] = 2 + Math.random() * 60;
    S.wy[k] = 4 + Math.random() * 120;
  }
  S.phase = 0;
  S.pt = 0;
}

// One step of Kohonen's rule: the node nearest the sample wins, and it and
// its lattice neighbours move toward the sample by alpha times a Gaussian
// of their lattice distance from the winner.
function learn(S, x, y, alpha, sigma, R) {
  const { wx, wy, cols, rows, hx } = S;
  let best = 0, bd = Infinity;
  for (let k = 0; k < NODES; k++) {
    const dx = wx[k] - x, dy = wy[k] - y, d = dx * dx + dy * dy;
    if (d < bd) (bd = d), (best = k);
  }
  const bi = best % cols, bj = (best / cols) | 0;
  for (let j = max(0, bj - R); j <= min(rows - 1, bj + R); j++) {
    const hj = hx[abs(j - bj)];
    for (let i = max(0, bi - R); i <= min(cols - 1, bi + R); i++) {
      const k = j * cols + i, a = alpha * hj * hx[abs(i - bi)];
      wx[k] += a * (x - wx[k]);
      wy[k] += a * (y - wy[k]);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.5], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), dim = round(cl(kv[2], 0, 1) * (DIMS.length - 1)), rad = cl(kv[3], 0.5, 3);
  if (dim !== S.dim) start(S, dim, false);
  const g = (d * speed) / 2;
  S.pt += g;
  if (S.phase === 0 && S.pt >= ANNEAL) (S.phase = 1), (S.pt = 0);
  else if (S.phase === 1 && S.pt >= HOLD) (S.phase = 2), (S.pt = 0);
  else if (S.phase === 2 && S.pt >= FADE) return start(S, dim, true);
  const f = S.phase === 0 ? S.pt / ANNEAL : 1;
  // The first RAMP seconds learn slowly, the rate rising 3,000-fold, so
  // the tangle is seen drawing itself together before the map orders.
  const ramp = S.phase === 0 && S.pt < RAMP ? 10 ** (-3.5 * (1 - S.pt / RAMP)) : 1;
  const s0 = max(S.cols, S.rows) / 4, sigma = s0 * (rad / s0) ** f, alpha = A0 * (A1 / A0) ** f * ramp;
  const R = min(max(S.cols, S.rows), ceil(3 * sigma));
  for (let k = 0; k <= R; k++) S.hx[k] = exp((-k * k) / (2 * sigma * sigma));
  S.sigma = sigma;
  const n = round(g * RATE), p = S.p, keep = S.samp.length / 2;
  S.ns = 0;
  for (let k = 0; k < n; k++) {
    SHAPES[S.shape](p);
    learn(S, p[0], p[1], alpha, sigma, R);
    if (S.ns < keep) (S.samp[2 * S.ns] = p[0]), (S.samp[2 * S.ns + 1] = p[1]), S.ns++;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.dim < 0) return;
  const rgb = S.rgb, col = S.col, { cols, rows, wx, wy } = S;
  rgb.fill(0);
  const fade = S.phase === 2 ? 1 - S.pt / FADE : S.phase === 0 ? min(1, S.pt / 0.3) : 1;
  // Node colours from lattice coordinates: hue along the long side,
  // whiteness across the short one.
  const pc = 0.4 + S.hue - floor(0.4 + S.hue), span = pc + 0.4 <= 1 ? 0.4 : -0.4, c = S.c;
  for (let j = 0, k = 0; j < rows; j++)
    for (let i = 0; i < cols; i++, k++) {
      const u = cols > 1 ? i / (cols - 1) : 0.5, v = rows > 1 ? j / (rows - 1) : 0;
      hsv(wheel(pc + span * v), 0.95 - 0.55 * u, 1, c);
      col[3 * k] = c[0];
      col[3 * k + 1] = c[1];
      col[3 * k + 2] = c[2];
    }
  const add = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] += r * a;
    rgb[o + 1] += g * a;
    rgb[o + 2] += b * a;
  };
  const top = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], r * a);
    rgb[o + 1] = max(rgb[o + 1], g * a);
    rgb[o + 2] = max(rgb[o + 2], b * a);
  };
  if (cols > 1) {
    // The cloth: each lattice cell a quad of two triangles, colours mixed
    // across it, fainter the more it is stretched past the area a cell
    // would have if the nodes shared the shape evenly. A cell turned over,
    // its corners in the other order round from most cells', shows its
    // back, darker.
    const A0c = 3600 / ((cols - 1) * (rows - 1));
    let turn = 0;
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        turn += (wx[a + 1] - wx[a]) * (wy[a + cols] - wy[a]) - (wy[a + 1] - wy[a]) * (wx[a + cols] - wx[a]) > 0 ? 1 : -1;
      }
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i, b = a + 1, cc = a + cols + 1, dd = a + cols;
        const cr = (wx[b] - wx[a]) * (wy[dd] - wy[a]) - (wy[b] - wy[a]) * (wx[dd] - wx[a]);
        const alpha = (cr * turn >= 0 ? 0.5 : 0.22) * cl(A0c / max(1e-3, abs(cr)), 0.1, 1);
        tri(rgb, wx, wy, col, a, b, cc, alpha);
        tri(rgb, wx, wy, col, a, cc, dd, alpha);
      }
  }
  // The lattice's threads: a line from each node to its right and lower
  // neighbours, so a sheet reads as woven and a chain as a curve.
  const seg = (k0, k1, a) => {
    const x0 = wx[k0], y0 = wy[k0], x1 = wx[k1], y1 = wy[k1], o0 = 3 * k0, o1 = 3 * k1;
    const m = max(1, ceil(max(abs(x1 - x0), abs(y1 - y0)) * 1.5));
    for (let e = 0; e < m; e++) {
      const t = e / m;
      top(floor(x0 + (x1 - x0) * t), floor(y0 + (y1 - y0) * t), col[o0] + (col[o1] - col[o0]) * t, col[o0 + 1] + (col[o1 + 1] - col[o0 + 1]) * t, col[o0 + 2] + (col[o1 + 2] - col[o0 + 2]) * t, a);
    }
  };
  const thread = cols > 1 ? 0.85 : 0.95;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i + 1 < cols) seg(k, k + 1, thread);
      if (j + 1 < rows) seg(k, k + cols, thread);
    }
  // The data, the samples of this frame, faint.
  for (let k = 0; k < S.ns; k++) add(floor(S.samp[2 * k]), floor(S.samp[2 * k + 1]), 1, 1, 1, 0.22);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 1] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 2] * fade, 0, 1)) | 0);
}

// A triangle of three nodes, its colour mixed by barycentric weights at
// each LED centre inside it. Overlapping cells keep the brighter, so a
// crumpled map does not burn white.
function tri(rgb, wx, wy, col, a, b, c, alpha) {
  const ax = wx[a], ay = wy[a], bx = wx[b], by = wy[b], cx = wx[c], cy = wy[c];
  const det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(det) < 1e-6) return;
  const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, ceil(max(ax, bx, cx)));
  const y0 = max(0, floor(min(ay, by, cy))), y1 = min(H - 1, ceil(max(ay, by, cy)));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const l1 = ((px - ax) * (cy - ay) - (py - ay) * (cx - ax)) / det;
      const l2 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / det;
      const l0 = 1 - l1 - l2;
      if (l0 < 0 || l1 < 0 || l2 < 0) continue;
      const o = (y * W + x) * 3;
      rgb[o] = max(rgb[o], (l0 * col[3 * a] + l1 * col[3 * b] + l2 * col[3 * c]) * alpha);
      rgb[o + 1] = max(rgb[o + 1], (l0 * col[3 * a + 1] + l1 * col[3 * b + 1] + l2 * col[3 * c + 1]) * alpha);
      rgb[o + 2] = max(rgb[o + 2], (l0 * col[3 * a + 2] + l1 * col[3 * b + 2] + l2 * col[3 * c + 2]) * alpha);
    }
  }
}
