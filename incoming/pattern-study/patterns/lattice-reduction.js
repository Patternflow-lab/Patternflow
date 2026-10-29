// ===== Patternflow pattern =====
// Title:   Lattice Reduction
// Family:  geometry
// Idea:    The points of a plane lattice stand still as white dots over the whole panel while the plane is tiled by the parallelogram of its current basis, which starts as long thin slivers, and Lagrange-Gauss reduction takes the basis apart one step at a time: b2 shears along b1 by the whole number of b1 nearest its projection, the tiles sliding until their corners land back on dots, the arrows trade colours when b2 has become the shorter and the two swap names, and when the projection is half of b1 or less the tiles are compact, flash, hold, and a new lattice starts skewed.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: reduction of binary quadratic forms, the two-dimensional lattice basis reduction (Joseph-Louis Lagrange, 1773; Carl Friedrich Gauss, Disquisitiones Arithmeticae, 1801), whose heir in any dimension is the LLL algorithm (Arjen Lenstra, Hendrik Lenstra and László Lovász, 1982), pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Skew=3..7, Spacing=11..22
//
// Knob 1: Hue. Turns the tiles and the arrows round the wheel together. At 0 the tiles are teal, blue and violet, the cell at the centre green, b1 amber and b2 pink; at 0.5 the tiles go red, ochre and lime, the centre cell magenta, b1 blue and b2 spring green.
// Knob 2: Speed. At 2 a shear takes 0.55 s, a swap 0.4 s and a pause of 0.2 s follows each, so a basis from 3 shears is reduced in 2.2 to 4.2 s and a new lattice comes every 6 to 8 s. Every time but the 2.6 s hold and the 0.5 s cross-fade scales as 2 / Speed: at 0.2 a shear takes 5.5 s, at 3 0.37 s.
// Knob 3: Skew. How many shears, b2 += b1 and b1 += b2 by turns, each with the sign that lengthens, turn the reduced basis into the starting one. At the opening spacing: at 3 the longer vector is 3.5 to 4.9 spacings and the tiles 2.3 to 3.2 LEDs wide; at 5 about 10 spacings and one LED wide; at 7 up to 25 spacings, where a cap stops the word, and the tiles under a LED, a moire until the first shear. Gauss takes 2 or 3 shears at 3 and 4 at 7, each by 1 to 3 times b1, with a swap between most of them.
// Knob 4: Spacing. The square root of one cell's area, 11 to 22 LEDs: 68 dots at 11, 17 at 22. The lattices come square, hexagonal, rectangular (sides 1.6 to 1) and random (60 to 90 degrees, sides up to 1.7 to 1) in turn, all of that area and turned at random.
// Buttons: K1 tap starts a new lattice.

// A lattice is every whole combination of two vectors. Many bases give the
// same lattice: b1, b2 and b1, b2 - q b1 for any whole q, or the two swapped.
// Lagrange (1773) and Gauss (1801) reduced a basis by alternating the two:
// keep b1 the shorter, subtract from b2 the multiple of b1 nearest its
// projection, and stop when that multiple is 0. Then |b1| <= |b2| and
// |b1 . b2| <= |b1|^2 / 2, so the angle between them is 60 to 120 degrees
// and b1 is a shortest vector of the lattice.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const smooth = (u) => u * u * (3 - 2 * u);
// The lattice point everything turns about, at the panel's middle.
const OX = 31.5, OY = 63.5;
const HOLD = 2.6, FADE = 0.5, LOOK = 0.8, CAP = 26;

function hsv(h, s, v, out) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The basis is R U: R the reduced basis the lattice was made from, U whole
// numbers with determinant +-1, kept exactly so the basis never drifts off
// the lattice.
function basis(S) {
  const R = S.R, U = S.U, b = S.b;
  b[0] = R[0] * U[0] + R[2] * U[2];
  b[1] = R[1] * U[0] + R[3] * U[2];
  b[2] = R[0] * U[1] + R[2] * U[3];
  b[3] = R[1] * U[1] + R[3] * U[3];
}
const len2 = (x, y) => x * x + y * y;

function newLattice(S) {
  // The last frame stays to cross-fade from, black at the very start.
  S.old.set(S.acc);
  S.xf = 1;
  const kind = S.kind++ % 4, a = S.spacing, th = Math.random() * PI;
  let u, v, ang;
  if (kind === 0) (u = a), (v = a), (ang = PI / 2);
  else if (kind === 1) (u = v = a * sqrt(2 / sqrt(3))), (ang = PI / 3);
  else if (kind === 2) (u = a / sqrt(1.6)), (v = a * sqrt(1.6)), (ang = PI / 2);
  else {
    ang = PI / 3 + Math.random() * (PI / 6);
    const r = 1 + Math.random() * 0.7;
    u = a / sqrt(r * sin(ang));
    v = u * r;
  }
  const R = S.R;
  R[0] = u * cos(th);
  R[1] = u * sin(th);
  R[2] = v * cos(th + ang);
  R[3] = v * sin(th + ang);
  // The word: shears of b2 along b1 and of b1 along b2 by turns, from a
  // random first one, each with the sign that lengthens the vector it
  // moves, stopping early if the longer vector would pass CAP spacings.
  const U = S.U;
  U.splice(0, 4, 1, 0, 0, 1);
  basis(S);
  for (let k = 0, w = Math.random() < 0.5 ? 1 : 0; k < S.skew; k++, w ^= 1) {
    const b = S.b, d = b[0] * b[2] + b[1] * b[3], sg = d > 1e-9 ? 1 : d < -1e-9 ? -1 : Math.random() < 0.5 ? 1 : -1;
    const V = U.slice();
    if (w) (V[1] += sg * V[0]), (V[3] += sg * V[2]);
    else (V[0] += sg * V[1]), (V[2] += sg * V[3]);
    const nx = w ? R[0] * V[1] + R[2] * V[3] : R[0] * V[0] + R[2] * V[2], ny = w ? R[1] * V[1] + R[3] * V[3] : R[1] * V[0] + R[3] * V[2];
    if (len2(nx, ny) > (CAP * a) ** 2) break;
    U.splice(0, 4, ...V);
    basis(S);
  }
  Object.assign(S, { phase: 0, pt: 0, op: null, steps: 0, ca: 1, cb: 2 });
}

// The next operation: a swap when b2 is the shorter, else the shear by q,
// else none (reduced).
function nextOp(S) {
  const b = S.b, l1 = len2(b[0], b[1]), l2 = len2(b[2], b[3]);
  if (l2 < l1 * (1 - 1e-9)) return { swap: true };
  // A projection of half of b1 or less is already reduced; testing that
  // and not q = 0 keeps a tie, as in the hexagonal lattice, from flipping
  // between q = 1 and q = -1 for ever.
  const mu = (b[0] * b[2] + b[1] * b[3]) / l1;
  return abs(mu) > 0.5 + 1e-7 ? { q: round(mu) } : null;
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, skew: 3, spacing: 11, kind: 0, phase: 0, pt: 0, op: null, steps: 0, flash: 0, btn: false,
    R: [9, 0, 0, 9], U: [1, 0, 0, 1], b: [9, 0, 0, 9], ca: 1, cb: 2, c: [0, 0, 0],
    tile: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], acc: new Float32Array(W * H * 3), old: new Float32Array(W * H * 3), xf: 1,
  };
  return params.s;
}

// Phases: 0 cross-fading in and showing the skewed basis, 1 reducing, 2
// the reduced basis held, then the next lattice.
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 11], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  const skew = round(cl(k[2], 3, 7)), spacing = cl(k[3], 11, 22), btn = !!(input.btnPressed && input.btnPressed[0]);
  if (skew !== S.skew || abs(spacing - S.spacing) > 0.05 || !S.started || (btn && !S.btn))
    (S.skew = skew), (S.spacing = spacing), (S.started = true), newLattice(S);
  S.btn = btn;
  const sc = 2 / S.speed;
  S.t += d;
  S.pt += d;
  S.flash = max(0, S.flash - d / 0.7);
  S.xf = max(0, S.xf - d / FADE);
  if (S.phase === 0) {
    if (S.pt >= FADE + LOOK * sc) (S.phase = 1), (S.pt = 0), (S.op = nextOp(S));
  } else if (S.phase === 1) {
    if (!S.op) return void ((S.phase = 2), (S.pt = 0), (S.flash = 1));
    const dur = (S.op.swap ? 0.4 : 0.55) * sc;
    if (S.pt >= dur + 0.2 * sc) {
      const U = S.U;
      if (S.op.swap) {
        [U[0], U[1]] = [U[1], U[0]];
        [U[2], U[3]] = [U[3], U[2]];
        [S.ca, S.cb] = [S.cb, S.ca];
      } else (U[1] -= S.op.q * U[0]), (U[3] -= S.op.q * U[2]);
      basis(S);
      S.steps++;
      S.pt = 0;
      S.op = nextOp(S);
    }
  } else if (S.pt >= HOLD) newLattice(S);
}

function put(acc, x, y, c, w) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const k = (y * W + x) * 3;
  w = min(1, w);
  for (let i = 0; i < 3; i++) acc[k + i] += (c[i] - acc[k + i]) * w;
}
function line(acc, x0, y0, x1, y1, c, w) {
  const st = abs(x1 - x0) < abs(y1 - y0);
  if (st) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const s = x1 > x0 ? (y1 - y0) / (x1 - x0) : 0;
  for (let x = max(0, round(x0)); x <= min(st ? H - 1 : W - 1, round(x1)); x++) {
    const y = y0 + (x - x0) * s, iy = floor(y), f = y - iy;
    if (st) put(acc, iy, x, c, w * (1 - f)), put(acc, iy + 1, x, c, w * f);
    else put(acc, x, iy, c, w * (1 - f)), put(acc, x, iy + 1, c, w * f);
  }
}
// An arrow from the origin along x, y: a shaft 1.5 LEDs wide and a head 6
// long, in colour c over a dark rim 1 LED wide that keeps it off the tiles.
function arrow(acc, x, y, c) {
  const l = sqrt(x * x + y * y);
  if (l < 1) return;
  const ux = x / l, uy = y / l, hl = min(6, l * 0.5), hw = hl * 0.45, sl = l - hl, k = hl / sqrt(hl * hl + hw * hw);
  const x0 = max(0, floor(min(OX, OX + x) - 4)), x1 = min(W - 1, floor(max(OX, OX + x) + 5));
  const y0 = max(0, floor(min(OY, OY + y) - 4)), y1 = min(H - 1, floor(max(OY, OY + y) + 5));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px - OX, dy = py - OY, al = dx * ux + dy * uy, ac = abs(-dx * uy + dy * ux);
      const ds = (al < 0 ? sqrt(al * al + ac * ac) : al > sl ? sqrt((al - sl) ** 2 + ac * ac) : ac) - 0.75;
      const dh = max(sl - al, al - l, (ac - (hw * (l - al)) / hl) * k);
      const dd = min(ds, dh);
      if (dd > 1.6) continue;
      const kk = (py * W + px) * 3, w = cl(0.5 - dd, 0, 1), m = 1 - 0.6 * cl(1.6 - dd, 0, 1);
      for (let i = 0; i < 3; i++) acc[kk + i] = acc[kk + i] * m * (1 - w) + c[i] * w;
    }
}
function dot(acc, x, y, c, w) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  put(acc, ix, iy, c, w * min(1, 1.7 * (1 - fx) * (1 - fy)));
  put(acc, ix + 1, iy, c, w * min(1, 1.7 * fx * (1 - fy)));
  put(acc, ix, iy + 1, c, w * min(1, 1.7 * (1 - fx) * fy));
  put(acc, ix + 1, iy + 1, c, w * min(1, 1.7 * fx * fy));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc, b = S.b, c = S.c, tile = S.tile;
  // The basis on screen: during a shear b2 slides along b1 by q b1.
  let b1x = b[0], b1y = b[1], b2x = b[2], b2y = b[3], mix = 0;
  if (S.phase === 1 && S.op) {
    const sc = 2 / S.speed, u = smooth(cl(S.pt / ((S.op.swap ? 0.4 : 0.55) * sc), 0, 1));
    if (S.op.swap) mix = u;
    else (b2x -= u * S.op.q * b1x), (b2y -= u * S.op.q * b1y);
  }
  const det = b1x * b2y - b1y * b2x, l1 = sqrt(len2(b1x, b1y)), l2 = sqrt(len2(b2x, b2y));
  // Tile heights across each family of edges, and how much edge they carry.
  const h1 = abs(det) / l2, h2 = abs(det) / l1, e1 = cl((h1 - 1.2) / 2, 0, 1), e2 = cl((h2 - 1.2) / 2, 0, 1);
  const fl = S.flash * S.flash;
  for (let k = 0; k < 3; k++) hsv(S.hue + [0.5, 0.6, 0.73][k], 0.72 - 0.2 * fl, [0.56, 0.66, 0.76][k] + 0.12 * fl, tile[k]);
  hsv(S.hue + 0.38, 0.8 - 0.3 * fl, 0.85 + 0.15 * fl, tile[3]);
  // Each LED's place in the tiling: s along b1, t along b2. Tiles are
  // coloured by (ca i + cb j) mod 3, which keeps every tile's colour when
  // the arrows swap and never gives two tiles that share an edge one colour.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - OX, dy = y - OY, s = (dx * b2y - dy * b2x) / det, t = (b1x * dy - b1y * dx) / det;
      const i = floor(s), j = floor(t), fs = s - i, ft = t - j;
      const col = i === 0 && j === 0 ? tile[3] : tile[(((S.ca * i + S.cb * j) % 3) + 3) % 3];
      const ed = max(e1 * cl(1 - (min(fs, 1 - fs) * h1) / 0.7, 0, 1), e2 * cl(1 - (min(ft, 1 - ft) * h2) / 0.7, 0, 1));
      const m = 1 - 0.7 * ed, k = (y * W + x) * 3;
      acc[k] = col[0] * m;
      acc[k + 1] = col[1] * m;
      acc[k + 2] = col[2] * m;
    }
  // The lattice points, from the reduced basis R: they never move.
  const R = S.R, rd = R[0] * R[3] - R[1] * R[2], white = [1, 1, 1];
  let span = 0;
  for (const [x, y] of [[-OX, -OY], [W - OX, -OY], [-OX, H - OY], [W - OX, H - OY]]) {
    span = max(span, abs((x * R[3] - y * R[2]) / rd) + 1, abs((R[0] * y - R[1] * x) / rd) + 1);
  }
  span = min(60, ceilInt(span));
  for (let m = -span; m <= span; m++)
    for (let n = -span; n <= span; n++) {
      const x = OX + m * R[0] + n * R[2], y = OY + m * R[1] + n * R[3];
      if (x > -1 && x < W && y > -1 && y < H) dot(acc, x, y, white, 0.95);
    }
  // The arrows; during a swap their colours cross over.
  const a1 = [0, 0, 0], a2 = [0, 0, 0];
  hsv(S.hue + 0.1, 0.85, 1, a1);
  hsv(S.hue + 0.92, 0.6, 1, a2);
  const ma = [0, 1, 2].map((k) => a1[k] + (a2[k] - a1[k]) * mix), mb = [0, 1, 2].map((k) => a2[k] + (a1[k] - a2[k]) * mix);
  // During a shear, the path of b2's tip along b1, through the dots.
  if (S.phase === 1 && S.op && !S.op.swap) {
    const c2 = mb.map((v) => v * 0.8);
    line(acc, OX + b[2], OY + b[3], OX + b2x, OY + b2y, c2, 0.8);
  }
  arrow(acc, b2x, b2y, mb);
  arrow(acc, b1x, b1y, ma);
  dot(acc, OX, OY, white, 1);
  const xf = smooth(S.xf), old = S.old;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      for (let i = 0; i < 3; i++) acc[k + i] = min(1, acc[k + i]);
      const r = acc[k] + (old[k] - acc[k]) * xf, gr = acc[k + 1] + (old[k + 1] - acc[k + 1]) * xf, bl = acc[k + 2] + (old[k + 2] - acc[k + 2]) * xf;
      display.setPixel(x, y, (255 * r) | 0, (255 * gr) | 0, (255 * bl) | 0);
    }
}
const ceilInt = (v) => -floor(-v);
