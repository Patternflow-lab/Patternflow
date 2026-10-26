// ===== Patternflow pattern =====
// Title:   Berggren Tree
// Family:  number
// Idea:    Berggren's ternary tree of primitive Pythagorean triples grows from (3, 4, 5) one generation at a time over the plane of the legs, odd leg up and even leg across, its A and C branches running along the parabolas c - b = k^2 and c - a = 2n^2 on whose crossings every primitive triple sits, its B branches jumping between them, while the window widens to keep the newest generation at the edge and the crossings that are multiples never light.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euclid's formula for Pythagorean triples (Euclid, c. 300 BC), tree of primitive Pythagorean triples (B. Berggren, 1934), rediscovered (F. J. M. Barning, 1963; A. Hall, 1970), the count N / 2 pi of primitive triples with c below N (D. N. Lehmer, 1900), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Reach=-1..1, Root=0..1
//
// Knob 1: Hue. Turns the three matrices' colours round the wheel, skipping orange and yellow. At 0 the A branches and the triples A made are azure, C's rose and B's pale violet, with (3, 4, 5) white; at 0.25 violet, green and pink, at 0.5 red, cyan and pale green, at 0.75 green, blue and pale azure. The faint parabolas take the colour of their branches.
// Knob 2: Speed. At 2 the first tree opens three generations grown, the window reaching odd legs of 173 and even legs of 86, and takes the rest of a 12 s run to grow to the full Reach: at Reach 0 one generation every 1.1 s, full at 8.7 s. It holds 4 s while a pulse runs out from the root a generation at a time, then fades and starts again from (3, 4, 5) alone, every 16 s. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Reach. How far the window has widened when the run ends: odd legs up to 128 u and even legs up to 64 u, u = 4 x 2^Reach. At 0 the legs reach 512 and 256 and the window holds 61 triples down to the 10th generation, on 71 crossings of the two families, 10 of them multiples like 9 (3, 4, 5) that stay dark; at -1, 30 triples to the 6th generation, at 1, 124 to the 14th. The window starts at 0.18 of its last size at Reach 0 (0.28 at -1, 0.12 at 1) and widens as (G + 8)^2 with the generation G.
// Knob 4: Root. Bends the plane from the legs, z^2 for z = m + i n, at 0.06 and below, to z itself at 1, the plane of Euclid's (m, n): the parabolas straighten, the C branches stand upright with n fixed, the A branches run at 45 degrees with m - n fixed, and the triples sit on the lattice of coprime m > n of opposite parity.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, abs, sqrt, atan2, cos, sin, pow, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
// The wheel without its orange and yellow, 0.03 to 0.17.
const wheel = (h) => 0.17 + (h - floor(h)) * 0.86;

// Every primitive triple is (m^2 - n^2, 2mn, m^2 + n^2) for one pair m > n
// > 0, coprime and of opposite parity, and Berggren's matrices A, B and C on
// (a, b, c) are, on (m, n):
//   A: (m, n) -> (2m - n, m)   keeps m - n, so c - b = (m - n)^2
//   B: (m, n) -> (2m + n, m)
//   C: (m, n) -> (m + 2n, n)   keeps n, so c - a = 2 n^2
// from (2, 1), which is (3, 4, 5). A child's c is always larger than its
// parent's, so cutting the tree at c <= CB keeps every triple up to CB.
const UMAX = 8, CB = 170 * UMAX;
const NM = [2], NN = [1], ND = [0], NX = [-1], NPAR = [-1];
for (let i = 0; i < NM.length; i++) {
  const m = NM[i], n = NN[i], kids = [[2 * m - n, m], [2 * m + n, m], [m + 2 * n, n]];
  for (let k = 0; k < 3; k++) {
    const M = kids[k][0], N = kids[k][1];
    if (M * M + N * N > CB) continue;
    NM.push(M);
    NN.push(N);
    ND.push(ND[i] + 1);
    NX.push(k);
    NPAR.push(i);
  }
}
const NNODE = NM.length;
const RUN = 12, HOLD = 4, G0 = 8;

export function setup(params) {
  params.s = {
    rgb: new Float32Array(NP * 3), old: new Float32Array(NP * 3), c: new Float32Array(3), cols: [0, 1, 2].map(() => new Float32Array(3)),
    o: [0, 0], key: "", deep: 1, tau: 0, hold: 0, fade: 0, G: 0, started: false,
    hue: 0, speed: 2, uf: 4, u: 1, p: 2, sc: 1,
  };
}

// Where (m, n) lands: z = m + i n raised to the power p and scaled so that
// |z|^2 = 128 u reaches the top row. At p = 2 that is the odd leg a up and
// the even leg b across, u legs to an LED; at p = 1 the lattice of (m, n).
function proj(S, m, n, out) {
  if (S.p === 2) {
    out[0] = 2 * m * n * S.sc;
    out[1] = H - 1 - (m * m - n * n) * S.sc;
    return;
  }
  const r2 = m * m + n * n, th = atan2(n, m) * S.p, rp = pow(r2, S.p / 2) * S.sc;
  out[0] = rp * sin(th);
  out[1] = H - 1 - rp * cos(th);
}
const inside = (x, y) => x >= -0.5 && x < W - 0.5 && y >= -0.5 && y < H - 0.5;
function scale(S, u) {
  S.u = u;
  S.sc = 128 / pow(128 * u, S.p / 2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.uf = 4 * pow(2, cl(k[2], -1, 1));
  S.p = 2 - cl((k[3] - 0.06) / 0.94, 0, 1);
  // The deepest generation with a triple inside the window at full reach.
  const key = S.uf.toFixed(4) + "," + S.p.toFixed(4);
  if (key !== S.key) {
    S.key = key;
    scale(S, S.uf);
    S.deep = 1;
    for (let i = 0; i < NNODE; i++) {
      proj(S, NM[i], NN[i], S.o);
      if (inside(S.o[0], S.o[1])) S.deep = max(S.deep, ND[i]);
    }
  }
  // The first tree opens three generations grown; the later ones start
  // from (3, 4, 5) alone.
  if (!S.started) {
    S.started = true;
    S.tau = (3 * RUN) / (S.deep + 1);
  }
  const g = d * (S.speed / 2);
  S.fade = max(0, S.fade - d / 0.6);
  if (S.tau < RUN) S.tau = min(RUN, S.tau + g);
  else {
    S.hold += g;
    if (S.hold > HOLD) {
      S.old.set(S.rgb);
      S.tau = S.hold = 0;
      S.fade = 1;
    }
  }
  // One generation after another, each in the same share of the run, and
  // the window widening as (G + G0)^2, the way the reach of a generation
  // along A or C grows, so the newest one always spans the panel.
  const D = S.deep + 1;
  S.G = (D * S.tau) / RUN;
  scale(S, S.uf * ((S.G + G0) / (D + G0)) ** 2);
}

// While the grown tree holds, a pulse runs out from the root through the
// generations, one generation every RUN / (deep + 1) at Speed 2.
function wave(S, d) {
  if (S.tau < RUN) return 0;
  const at = (S.hold / HOLD) * (S.deep + 2) - 0.5, e = (d - at) / 0.6;
  return exp(-e * e);
}

function put(rgb, x, y, r, g, b) {
  x = round(x);
  y = round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  if (r > rgb[o]) rgb[o] = r;
  if (g > rgb[o + 1]) rgb[o + 1] = g;
  if (b > rgb[o + 2]) rgb[o + 2] = b;
}

// A straight run in (m, n) from its start to t1 of the way, through the
// projection: for A and C the run lies on m - n = k or n = const, so the
// branch is drawn along its parabola.
function branch(S, rgb, m0, n0, m1, n1, t1, col, w) {
  const o = S.o;
  proj(S, m0, n0, o);
  const x0 = o[0], y0 = o[1];
  proj(S, m0 + (m1 - m0) * t1, n0 + (n1 - n0) * t1, o);
  const steps = max(2, min(300, floor((abs(o[0] - x0) + abs(o[1] - y0)) * 1.5)));
  const r = col[0] * w, g = col[1] * w, b = col[2] * w;
  for (let i = 0; i <= steps; i++) {
    const t = (t1 * i) / steps;
    proj(S, m0 + (m1 - m0) * t, n0 + (n1 - n0) * t, o);
    if (o[1] < -1 || o[0] > W) return;
    put(rgb, o[0], o[1], r, g, b);
  }
  // A branch still growing carries a white spark at its tip.
  if (t1 < 1) put(rgb, o[0], o[1], 255, 255, 255);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, cols, o } = S;
  rgb.fill(0);
  const h = S.hue, G = S.G;
  hsv(wheel(0.452 + h), 0.75, 1, cols[0]); // A
  hsv(wheel(0.72 + h), 0.3, 1, cols[1]); // B
  hsv(wheel(0.88 + h), 0.6, 1, cols[2]); // C
  // The two families the branches run along, faint: m - n = k for odd k,
  // c - b = k^2, starting up the left edge at a = k^2, and n = 1, 2, ...,
  // c - a = 2 n^2, starting along the foot at b = 2 n^2. Every primitive
  // triple sits on a crossing, but not every crossing is primitive: (6, 3)
  // is 9 (3, 4, 5), and the tree never lights it.
  const top = sqrt(200 * S.u) + 2;
  hsv(wheel(0.452 + h), 0.5, 0.19, S.c);
  for (let k = 1; k < top; k += 2) branch(S, rgb, k, 0, k + top, top, 1, S.c, 1);
  hsv(wheel(0.88 + h), 0.45, 0.19, S.c);
  for (let n = 1; n < top; n++) branch(S, rgb, n, n, n + 2 * top, n, 1, S.c, 1);
  // The branches: growing for a generation, then A and C stay as the
  // parabolas they lie on and B, which jumps between them, fades.
  for (let i = 1; i < NNODE; i++) {
    const f = G - (ND[i] - 1);
    if (f <= 0) continue;
    const j = NPAR[i], k = NX[i];
    proj(S, NM[j], NN[j], o);
    if (!inside(o[0], o[1])) continue;
    const w = (k === 1 ? (f < 1 ? 0.5 : 0) : f < 1 ? 1 : max(0.55, 1 - (f - 1) * 0.45)) + wave(S, ND[i]) * 0.5;
    if (w > 0) branch(S, rgb, NM[j], NN[j], NM[i], NN[i], min(1, f), cols[k], w);
  }
  // The triples, five-LED crosses in the colour of the matrix that made
  // them, white as they arrive and the root (3, 4, 5) white for good.
  for (let i = 0; i < NNODE; i++) {
    const age = G - ND[i];
    if (age < 0) continue;
    proj(S, NM[i], NN[i], o);
    const x = round(o[0]), y = round(o[1]);
    if (x < -1 || y < -1 || x > W || y > H) continue;
    const k = NX[i], fl = k < 0 ? 1 : max(0, 1 - age, wave(S, ND[i])), col = cols[max(0, k)];
    const R = col[0] + (255 - col[0]) * fl, Gg = col[1] + (255 - col[1]) * fl, B = col[2] + (255 - col[2]) * fl;
    put(rgb, x, y, 160 + R * 0.4, 160 + Gg * 0.4, 160 + B * 0.4);
    put(rgb, x + 1, y, R * 0.8, Gg * 0.8, B * 0.8);
    put(rgb, x - 1, y, R * 0.8, Gg * 0.8, B * 0.8);
    put(rgb, x, y + 1, R * 0.8, Gg * 0.8, B * 0.8);
    put(rgb, x, y - 1, R * 0.8, Gg * 0.8, B * 0.8);
  }
  const fd = S.fade, old = S.old;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      let r = min(255, rgb[p]), gg = min(255, rgb[p + 1]), b = min(255, rgb[p + 2]);
      if (fd > 0) (r = max(r, old[p] * fd)), (gg = max(gg, old[p + 1] * fd)), (b = max(b, old[p + 2] * fd));
      (rgb[p] = r), (rgb[p + 1] = gg), (rgb[p + 2] = b);
      display.setPixel(x, y, r, gg, b);
    }
}
