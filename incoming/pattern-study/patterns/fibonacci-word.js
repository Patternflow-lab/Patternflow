// ===== Patternflow pattern =====
// Title:   Fibonacci Word
// Family:  fractal
// Idea:    A pen reads the Fibonacci word 0100101001001... and takes one step for every digit, turning a quarter turn at every 0, left in an even place and right in an odd one, so 144 crisp steps of 4 LEDs draw a self-avoiding curve of squares nested in squares over the coarse curve of the first 34 digits, each coarse step giving way to the 5 or 3 fine steps that 0 -> 01001 and 1 -> 010 make of it; the three copies of those 34 digits inside the 144 then light in turn, and the panel dives into the first with a quarter turn and a 1 + sqrt 2 zoom until it stands where the whole stood, mirrored, and the pen draws the whole over it again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Fibonacci word fractal and its odd-even drawing rule (Alexis Monnerot-Dumaine, 2009), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Order=12..15, Angle=-1..1
//
// Knob 1: Hue. Turns the colour that runs half the wheel along the word, first digit to last: at 0 sea green through blue and violet to rose, at 0.25 blue through magenta and orange to yellow, at 0.5 rose through amber and lime to sea green, at 0.75 yellow through green and cyan to blue. The coarse curve and the tape of digits on the right edge take the same colours.
// Knob 2: Speed. The pen draws 70 LEDs of line a second for every unit, 140 at the opening 2, so the 144 steps of order 12 take 4.1 s and a whole cycle of drawing, the 1.8 s look at the three copies and the 2.2 s dive takes 8.1 s; at 0.2 the drawing alone takes 41 s, at 3 it takes 2.7 s and the look and the dive shorten by a fifth.
// Knob 3: Order. How many digits the pen reads, the Fibonacci number F(n): 12 for 144 steps of 4 LEDs (48 by 112 LEDs), 13 for 233 steps of 2 LEDs in a square 56 by 58, 14 for 377 steps of 2 LEDs (56 by 82), 15 for 610 steps of 2 LEDs, 58 by 138, so 6 rows at the top and 5 at the bottom run off the panel. The coarse curve under the pen is always order n - 3, and the order keeps its shape every three: 12 and 15 are long, 13 square, 14 one and a half times as long as wide.
// Knob 4: Angle. The turn at each 0. From -0.1 to 0.1 it is exactly 90 degrees and the line stays on the LED grid; it goes down to 60 degrees at -1, where the squares open into a wiggling line that still never touches itself, and up to 120 degrees at 1, where the curve folds over itself into a lattice of triangles and 36 of the 144 steps retrace an earlier one. Off 90 degrees the line is antialiased and the whole is turned and scaled to fit the panel.

// The rule. The Fibonacci word is the limit of S(0) = 0, S(1) = 01,
// S(n) = S(n-1) S(n-2); its k-th digit, k from 1, is 2 + floor(k phi) -
// floor((k + 1) phi). Read it from k = 1: step forward, and on a 0 turn
// left when k is even and right when k is odd. Counting k from 0 instead
// gives the mirror image. At 90 degrees the first F(n) digits draw the
// curve of order n; a scratch walk to 28,657 steps found no point visited
// twice and no two points one lattice step apart unless they are
// consecutive, which is why even a 1-LED step would stay a clean line.
// Of the F(n) steps, F(n-1) turn and F(n-2) go straight.
//
// Self-similarity. The word is fixed by 0 -> 01, 1 -> 0, so three orders
// up each digit becomes a block, 0 -> 01001 and 1 -> 010, and the curve of
// order n is the curve of order n - 3 with every step replaced by its block.
// It follows the coarse curve mirrored and 1 + sqrt 2 = 2.414 times larger:
// a least-squares fit of the block ends to the coarse corners is a mirror
// map of scale 2.420 at 2,584 -> 10,946 steps. Length grows by phi^3 =
// 4.236 for that, so the dimension of the limit is 3 log phi /
// log(1 + sqrt 2) = 1.6379. With a turn angle a the
// fitted ratio follows 1 + cos a + sqrt((1 + cos a)^2 + 1): 3.30 at 60
// degrees, 1.64 against 1.618 at 120, where 3 log phi / log of it would be
// 3, more than a plane curve can hold, and the curve overlaps itself.
//
// Also S(n) = S(n-3) S(n-4) S(n-3) S(n-3) S(n-4): the first F(n-3) digits
// come back at F(n-2) and F(n-1), mirrored where that offset is odd. Those
// are the three copies the panel lights before the dive.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sign, sin, cos, pow, atan2, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The word to 987 digits, and the Fibonacci numbers with F(1) = F(2) = 1.
const WORD = (() => {
  let a = [0], b = [0, 1];
  while (b.length < 987) [a, b] = [b, b.concat(a)];
  return b;
})();
const FIB = [0, 1];
while (FIB.length < 20) FIB.push(FIB[FIB.length - 1] + FIB[FIB.length - 2]);
// Coarse step j becomes fine steps BLK[j] .. BLK[j + 1] - 1 three orders up.
const BLK = new Int32Array(WORD.length + 1);
for (let j = 0; j < WORD.length; j++) BLK[j + 1] = BLK[j] + (WORD[j] ? 3 : 5);

// The walk in world coordinates. At exactly 90 degrees the turns are done
// on integers so the points land exactly on the LED grid.
function walk(N, deg, P) {
  if (deg === 90) {
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    let x = 0, y = 0, d = 0;
    P[0] = 0, P[1] = 0;
    for (let i = 0; i < N; i++) {
      x += DX[d], y += DY[d];
      P[2 * i + 2] = x, P[2 * i + 3] = y;
      if (WORD[i] === 0) d = (d + ((i + 1) % 2 === 0 ? 1 : 3)) % 4;
    }
    return;
  }
  const th = (deg * PI) / 180;
  let x = 0, y = 0, a = 0;
  P[0] = 0, P[1] = 0;
  for (let i = 0; i < N; i++) {
    x += cos(a), y += sin(a);
    P[2 * i + 2] = x, P[2 * i + 3] = y;
    if (WORD[i] === 0) a += (i + 1) % 2 === 0 ? th : -th;
  }
}

// A camera is screen = a * w' + b in complex numbers, w' the world point
// with y times mir. On the grid a is s or i s with s whole and b whole; off
// it, the rotation that lets the curve stand largest, kept unless another
// beats it by 3%.
function camera(P, N, mir, grid, keep) {
  const tryRot = (c, s) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i <= N; i++) {
      const x = P[2 * i], y = mir * P[2 * i + 1], X = c * x - s * y, Y = s * x + c * y;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    return [x0, x1 - x0, y0, y1 - y0];
  };
  if (grid) {
    let [x0, bw, y0, bh] = tryRot(1, 0), c = 1, s = 0;
    if (bw > bh) ([x0, bw, y0, bh] = tryRot(0, 1)), (c = 0), (s = 1);
    // 138.5 rows lets order 15 take 2 LEDs a step and run 5 rows off each end.
    const k = max(1, floor(min(60 / max(1, bw), 138.5 / max(1, bh))));
    return { ar: k * c, ai: k * s, br: floor((60 - k * bw) / 2) - k * x0, bi: floor((127 - k * bh) / 2) - k * y0, mir, psi: s ? 90 : 0 };
  }
  let best = null;
  for (let d = 0; d < 180; d += 3) {
    const r = (d * PI) / 180, c = cos(r), s = sin(r), [x0, bw, y0, bh] = tryRot(c, s);
    const k = min(58 / max(1e-6, bw), 125 / max(1e-6, bh));
    const cand = { k, c, s, x0, bw, y0, bh, psi: d };
    if (!best || k > best.k) best = cand;
    if (keep === d) keep = cand;
  }
  if (keep && typeof keep === "object" && keep.k >= best.k * 0.97) best = keep;
  const { k, c, s, x0, bw, y0, bh, psi } = best;
  return { ar: k * c, ai: k * s, br: 1 + (58 - k * bw) / 2 - k * x0, bi: (127 - k * bh) / 2 - k * y0, mir, psi };
}

function project(P, N, cam, X, Y) {
  for (let i = 0; i <= N; i++) {
    const x = P[2 * i], y = cam.mir * P[2 * i + 1];
    X[i] = cam.ar * x - cam.ai * y + cam.br;
    Y[i] = cam.ai * x + cam.ar * y + cam.bi;
  }
}

// Least-squares similarity z -> alpha z + beta (or alpha conj z + beta)
// taking the points (ax, ay) onto (bx, by). Returns [ar, ai, br, bi, err].
// With snap the turn of alpha is rounded to a quarter, so a curve on the
// grid stays on it.
function simFit(n, ax, ay, bx, by, conj, snap) {
  let mx = 0, my = 0, nx = 0, ny = 0;
  for (let j = 0; j < n; j++) mx += ax(j), my += (conj ? -1 : 1) * ay(j), nx += bx(j), ny += by(j);
  mx /= n, my /= n, nx /= n, ny /= n;
  let sr = 0, si = 0, ss = 0;
  for (let j = 0; j < n; j++) {
    const u = ax(j) - mx, v = (conj ? -1 : 1) * ay(j) - my, p = bx(j) - nx, q = by(j) - ny;
    sr += u * p + v * q, si += u * q - v * p, ss += u * u + v * v;
  }
  let ar = sr / max(1e-9, ss), ai = si / max(1e-9, ss);
  if (snap) {
    const r = hypot(ar, ai), q = (((round(atan2(ai, ar) / (PI / 2)) % 4) + 4) % 4);
    (ar = r * [1, 0, -1, 0][q]), (ai = r * [0, 1, 0, -1][q]);
  }
  const br = nx - (ar * mx - ai * my), bi = ny - (ai * mx + ar * my);
  let err = 0;
  for (let j = 0; j < n; j++) {
    const u = ax(j), v = (conj ? -1 : 1) * ay(j);
    err += hypot(ar * u - ai * v + br - bx(j), ai * u + ar * v + bi - by(j));
  }
  return [ar, ai, br, bi, err];
}

// Everything the panel needs for one order, angle and mirror: the fine
// curve on screen and the coarse curve of order n - 3 placed by the
// similarity that best lays its corners on the ends of their blocks.
function geometry(n, deg, mir, keepPsi) {
  const N = FIB[n], Nc = FIB[n - 3], grid = deg === 90;
  const P = new Float64Array(2 * N + 2);
  walk(N, deg, P);
  const cam = camera(P, N, mir, grid, keepPsi);
  const X = new Float64Array(N + 1), Y = new Float64Array(N + 1);
  project(P, N, cam, X, Y);
  const fits = [false, true].map((cj) =>
    simFit(Nc + 1, (j) => P[2 * j], (j) => P[2 * j + 1], (j) => X[BLK[j]], (j) => Y[BLK[j]], cj, grid));
  const f = fits[0][4] < fits[1][4] ? fits[0] : fits[1], cj = f === fits[1];
  const GX = new Float64Array(Nc + 1), GY = new Float64Array(Nc + 1);
  for (let j = 0; j <= Nc; j++) {
    const u = P[2 * j], v = (cj ? -1 : 1) * P[2 * j + 1];
    GX[j] = f[0] * u - f[1] * v + f[2];
    GY[j] = f[1] * u + f[0] * v + f[3];
  }
  return { n, N, Nc, deg, mir, grid, cam, X, Y, GX, GY, step: hypot(cam.ar, cam.ai) };
}

// How bright the coarse curve waits under the pen.
const GHOST = 0.72;

const angleOf = (k) => {
  const a = abs(k);
  return a <= 0.1 ? 90 : 90 + (k > 0 ? 30 : -30) * min(1, (a - 0.1) / 0.9);
};

function startDraw(S, ghost) {
  S.phase = 0, S.pen = 0, S.pt = 0, S.gl = ghost;
}

export function setup(params) {
  const S = (params.s = { t: 0, hue: 0, speed: 2, phase: 0, pen: 0, pt: 0, gl: GHOST, zt: 0, acc: new Float32Array(W * H * 3), c: [0, 0, 0] });
  S.g = geometry(12, 90, 1, -1);
  startDraw(S, GHOST);
}

// The dive: the screen similarity that takes the coarse prefix as drawn now
// onto where the next (mirrored) picture's coarse curve stands. A power of
// it, about its fixed point, is the zoom.
function startZoom(S) {
  const g = S.g, nx = geometry(g.n, g.deg, -g.mir, g.cam.psi);
  const f = simFit(g.Nc + 1, (j) => g.X[j], (j) => g.Y[j], (j) => nx.GX[j], (j) => nx.GY[j], false);
  const [ar, ai, br, bi] = f, dr = 1 - ar, di = -ai, dd = dr * dr + di * di;
  S.z = { next: nx, r: hypot(ar, ai), phi: atan2(ai, ar), cx: (br * dr + bi * di) / max(1e-9, dd), cy: (bi * dr - br * di) / max(1e-9, dd) };
  S.phase = 2, S.zt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 12, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const n = cl(round(k[2]), 12, 15), deg = angleOf(cl(k[3], -1, 1));
  const f = 0.55 + 0.225 * S.speed, g0 = S.g;
  if (n !== g0.n) {
    S.g = geometry(n, deg, g0.mir, -1);
    startDraw(S, GHOST);
  } else if (abs(deg - g0.deg) > 0.05 || (deg === 90) !== g0.grid) {
    S.g = geometry(n, deg, g0.mir, g0.cam.psi);
    if (S.phase === 2) startDraw(S, GHOST);
  }
  const g = S.g;
  if (S.phase === 0) {
    S.pen += (70 * S.speed * d) / max(0.05, g.step);
    S.gl += (GHOST - S.gl) * min(1, d * 2.5);
    if (S.pen >= g.N) (S.pen = g.N), (S.phase = 1), (S.pt = 0);
  } else if (S.phase === 1) {
    S.pt += (d * f) / 1.8;
    if (S.pt >= 1) startZoom(S);
  } else {
    S.zt += (d * f) / 2.2;
    if (S.zt >= 1) {
      S.g = S.z.next;
      startDraw(S, 1);
    }
  }
}

// Additive light, one LED per unit of line.
function splat(acc, x, y, w, r, g, b) {
  const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
  for (let q = 0; q < 4; q++) {
    const ii = i + (q & 1), jj = j + (q >> 1);
    if (ii < 0 || ii >= W || jj < 0 || jj >= H) continue;
    const ww = w * (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy), o = (jj * W + ii) * 3;
    acc[o] += r * ww, acc[o + 1] += g * ww, acc[o + 2] += b * ww;
  }
}
function lineAA(acc, x0, y0, x1, y1, r, g, b, upto) {
  if ((x0 < -2 && x1 < -2) || (x0 > W + 1 && x1 > W + 1) || (y0 < -2 && y1 < -2) || (y0 > H + 1 && y1 > H + 1)) return;
  const L = hypot(x1 - x0, y1 - y0), m = max(1, ceil((L * upto) / 0.45)), w = (L * upto) / m;
  for (let u = 0; u < m; u++) {
    const t = ((u + 0.5) / m) * upto;
    splat(acc, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, r, g, b);
  }
}
// On the grid: the LEDs from (x0, y0) toward (x1, y1), the far end left to
// the next step, cut at the share upto.
function lineGrid(acc, x0, y0, x1, y1, r, g, b, upto) {
  const L = abs(x1 - x0) + abs(y1 - y0), sx = sign(x1 - x0), sy = sign(y1 - y0), m = upto >= 1 ? L : floor(L * upto + 1e-9) + 1;
  for (let u = 0; u < m; u++) {
    const x = x0 + sx * u, y = y0 + sy * u;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3;
    acc[o] += r, acc[o + 1] += g, acc[o + 2] += b;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.g) return;
  const acc = S.acc, c = S.c, h0 = 0.42 + S.hue;
  acc.fill(0);
  const g = S.g, N = g.N, Nc = g.Nc;
  const col = (u, v, white) => {
    hsv(h0 + 0.5 * u, 0.78 * (1 - white), v, c);
    return c;
  };
  if (S.phase === 2) {
    // The dive: every point of the curve under the similarity's power.
    const z = S.z, e = smooth(S.zt), rr = pow(z.r, e), ph = z.phi * e, er = rr * cos(ph), ei = rr * sin(ph);
    const out = 1 - smooth(S.zt / 0.6);
    let px = 0, py = 0;
    for (let i = 0; i <= N; i++) {
      const dx = g.X[i] - z.cx, dy = g.Y[i] - z.cy, x = z.cx + er * dx - ei * dy, y = z.cy + ei * dx + er * dy;
      if (i > 0) {
        const j = i - 1, pre = j < Nc;
        const u = pre ? ((j + 0.5) / N) * (1 - e) + ((BLK[j] + BLK[j + 1]) / (2 * N)) * e : (j + 0.5) / N;
        const v = pre ? 1 : 0.45 * out;
        if (v > 0.01) {
          const w = pre ? 0.55 * (1 - e) : 0;
          col(u, v, w);
          lineAA(acc, px, py, x, y, c[0], c[1], c[2], 1);
        }
      }
      px = x, py = y;
    }
  } else {
    // The coarse curve, each step fading as the pen finishes its block.
    const rate = max(0.5, 70 / max(0.05, g.step));
    for (let j = 0; j < Nc; j++) {
      const gone = (S.pen - BLK[j + 1]) / (0.3 * rate) + (S.phase === 1 ? 8 * S.pt : 0), a = S.gl * (1 - cl(gone, 0, 1));
      if (a <= 0.01) continue;
      col((BLK[j] + BLK[j + 1]) / (2 * N), a, 0.15);
      if (g.grid) lineGrid(acc, round(g.GX[j]), round(g.GY[j]), round(g.GX[j + 1]), round(g.GY[j + 1]), c[0], c[1], c[2], 1);
      else lineAA(acc, g.GX[j], g.GY[j], g.GX[j + 1], g.GY[j + 1], c[0], c[1], c[2], 1);
    }
    // The fine curve up to the pen. In the look (phase 1) the three copies
    // of the first F(n-3) digits light in turn and the rest dims.
    const offs = [0, FIB[g.n - 2], FIB[g.n - 1]];
    let spot = [0, 0, 0], dim = 1;
    if (S.phase === 1) {
      const p = S.pt;
      spot = [0.33, 0.52, 0.71].map((m0) => max(0, 1 - abs(p - m0) / 0.11));
      spot[0] = max(spot[0], smooth((p - 0.8) / 0.15));
      dim = 1 - 0.55 * smooth((p - 0.1) / 0.12);
    }
    const last = S.phase === 0 ? floor(S.pen) : N - 1, frac = S.phase === 0 ? S.pen - last : 1;
    for (let i = 0; i <= min(last, N - 1); i++) {
      let s = 0;
      for (let q = 0; q < 3; q++) if (i >= offs[q] && i < offs[q] + Nc) s = max(s, spot[q]);
      const v = dim + (1 - dim) * s;
      col((i + 0.5) / N, v, 0.6 * s);
      const up = i < last ? 1 : frac;
      if (up <= 0) continue;
      if (g.grid) lineGrid(acc, g.X[i], g.Y[i], g.X[i + 1], g.Y[i + 1], c[0], c[1], c[2], up);
      else lineAA(acc, g.X[i], g.Y[i], g.X[i + 1], g.Y[i + 1], c[0], c[1], c[2], up);
    }
    if (S.phase !== 0) {
      col(1, dim, 0);
      if (g.grid) lineGrid(acc, g.X[N], g.Y[N], g.X[N], g.Y[N], c[0], c[1], c[2], 1);
    } else {
      // The pen: a white point with a glow of the colour it is laying down.
      const i = min(last, N - 1), x = g.X[i] + (g.X[i + 1] - g.X[i]) * frac, y = g.Y[i] + (g.Y[i + 1] - g.Y[i]) * frac;
      col((i + 0.5) / N, 1, 0.3);
      const px = g.grid ? round(x) : x, py = g.grid ? round(y) : y;
      splat(acc, px, py, 1.6, 1, 1, 1);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) splat(acc, px + ox, py + oy, 0.45, c[0], c[1], c[2]);
    }
  }
  // The tape: the word itself down the right edge, two rows a digit, the
  // digit being read on row 64. A 0 is two LEDs wide, a 1 one. Read digits
  // are lit in their colour, the rest wait dim; in the dive it rewinds.
  const tape = S.phase === 0 ? S.pen : S.phase === 1 ? N : N * (1 - smooth(S.zt));
  for (let y = 0; y < H; y++) {
    const q = tape + (y - 64) / 2, k = floor(q);
    if (k < 0 || k >= N || q - k >= 0.5) continue;
    const now = k === floor(tape) && S.phase === 0;
    col((k + 0.5) / N, k < tape ? 1 : 0.32, now ? 1 : 0.1);
    for (let x = WORD[k] ? 63 : 62; x < 64; x++) {
      const o = (y * W + x) * 3;
      acc[o] += c[0], acc[o + 1] += c[1], acc[o + 2] += c[2];
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, (255 * min(1, acc[o])) | 0, (255 * min(1, acc[o + 1])) | 0, (255 * min(1, acc[o + 2])) | 0);
    }
}
