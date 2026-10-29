// ===== Patternflow pattern =====
// Title:   Wilkinson's Polynomial
// Family:  algo
// Idea:    The twenty roots of (x - 1)(x - 2)...(x - 20) stand up the panel as beads on the real axis, and as a perturbation of the x^19 coefficient sweeps up past Wilkinson's 2^-23 and back the upper ten slide together in pairs and fly apart sideways into the complex plane, leaving arcs, while clouds of roots of randomly nudged copies show how far each root can be pushed and a faint dust maps the smallest nudge that would put a root anywhere.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wilkinson's polynomial (James H. Wilkinson, 1959; "The perfidious polynomial", 1984), Aberth's simultaneous root iteration (Oliver Aberth, 1973), pseudozero sets (Ronald G. Mosier, 1986; Kim-Chuan Toh and Lloyd N. Trefethen, 1994), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phase=0..1, Cloud=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together.
// Knob 2: Speed. How fast the perturbation sweeps.
// Knob 3: Phase. The direction of the perturbation in the complex plane.
// Knob 4: Cloud. The size of the random nudges whose roots make the clouds.
// Buttons: K1 tap holds the perturbation at 2^-23. K3 tap moves the perturbation down one power of x.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, exp, log2, cos, sin, sqrt, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The plane: the real axis runs up the panel, RY rows to a unit, with
// Re = RE0 at the bottom edge, so root k sits on the middle of row
// 123 - 6 (k - 1); the imaginary axis runs across, CX columns to a unit,
// with Im = 0 on the middle of column 31.
const RY = 6, RE0 = 0.25, CX = 9, XC = 31.5;
const toX = (im) => XC + im * CX, toY = (re) => H - (re - RE0) * RY;

// The coefficients a_j of p(x) = (x - 1)...(x - 20), lowest first. Doubles
// are enough here: they only scale the perturbations.
const A = new Float64Array(21);
A[0] = 1;
for (let k = 1; k <= 20; k++) for (let j = k; j >= 0; j--) A[j] = (j ? A[j - 1] : 0) - k * A[j];
const AB = A.map(abs);
// SENS[k]: the largest first-order shift a relative change of a_k can give any
// root, |a_k| r^k / |p'(r)| at its worst r. Every coefficient's sweep is
// scaled so that it pushes that root as hard as Wilkinson's 2^-23 on x^19.
const SENS = new Float64Array(20);
for (let k = 0; k < 20; k++)
  for (let r = 1; r <= 20; r++) {
    let d = 1;
    for (let j = 1; j <= 20; j++) if (j !== r) d *= abs(r - j);
    SENS[k] = max(SENS[k], (AB[k] * r ** k) / d);
  }

// The sweep runs log2 of the perturbation from LO to HI and back, easing at
// both ends; at LO the roots sit on the integers to within 0.001.
const LO = -35, HI = -21, WILK = -23;

// Aberth's iteration for the roots of p(z) + sum C_j z^j, j < 20, from the
// starting points in Z (re, im pairs), at most `iters` sweeps, roots with
// index below `from` held where they are. p and p' come from the product
// form, which stays accurate next to the roots where the expanded
// coefficients would cancel. Returns the largest last step squared.
const STEP = new Float64Array(20);
function aberth(Z, Cr, Ci, iters, from) {
  let big = 0;
  for (let it = 0; it < iters; it++) {
    big = 0;
    for (let i = from; i < 20; i++) {
      const zr = Z[2 * i], zi = Z[2 * i + 1];
      let pr = 1, pi = 0, dr = 0, di = 0;
      for (let k = 1; k <= 20; k++) {
        const ur = zr - k;
        const t = dr * ur - di * zi + pr;
        di = dr * zi + di * ur + pi;
        dr = t;
        const s = pr * ur - pi * zi;
        pi = pr * zi + pi * ur;
        pr = s;
      }
      let qr = 0, qi = 0, er = 0, ei = 0;
      for (let j = 19; j >= 0; j--) {
        const t = er * zr - ei * zi + qr;
        ei = er * zi + ei * zr + qi;
        er = t;
        const s = qr * zr - qi * zi + Cr[j];
        qi = qr * zi + qi * zr + Ci[j];
        qr = s;
      }
      const fr = pr + qr, fi = pi + qi, gr = dr + er, gi = di + ei;
      let m = gr * gr + gi * gi;
      if (!(m > 0)) continue;
      const wr = (fr * gr + fi * gi) / m, wi = (fi * gr - fr * gi) / m;
      let ar = 0, ai = 0;
      for (let j = 0; j < 20; j++)
        if (j !== i) {
          const xr = zr - Z[2 * j], xi = zi - Z[2 * j + 1], mm = xr * xr + xi * xi;
          if (mm > 0) (ar += xr / mm), (ai -= xi / mm);
        }
      const br = 1 - (wr * ar - wi * ai), bi = -(wr * ai + wi * ar);
      m = br * br + bi * bi;
      if (!(m > 0)) continue;
      const sr = (wr * br + wi * bi) / m, si = (wi * br - wr * bi) / m;
      Z[2 * i] -= sr;
      Z[2 * i + 1] -= si;
      const st = sr * sr + si * si;
      STEP[i] = st;
      if (st > big) big = st;
    }
    if (big < 1e-24) break;
  }
  return big;
}

// A real polynomial keeps real iterates real, so a root that is on the
// axis gets a tiny imaginary part, alternating up the axis, before each
// solve: two roots that meet can then leave the axis in opposite ways.
const ORD = [];
function seed(Z) {
  ORD.length = 0;
  for (let i = 0; i < 20; i++) ORD.push(i);
  ORD.sort((a, b) => Z[2 * a] - Z[2 * b]);
  for (let k = 0; k < 20; k++) {
    const i = ORD[k];
    if (abs(Z[2 * i + 1]) < 1e-9) Z[2 * i + 1] = k & 1 ? 1e-9 : -1e-9;
  }
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const Z = new Float64Array(40);
  for (let i = 0; i < 20; i++) Z[2 * i] = i + 1;
  params.s = {
    t: 0, ph: 0.17, e2: LO, pow: 19, pow0: 19, mix: 1, hold: 0, warm: 0,
    Z, Zo: new Float64Array(40), W: new Float64Array(40),
    Cr: new Float64Array(20), Ci: new Float64Array(20), Br: new Float64Array(20), Bi: new Float64Array(20),
    TI: F(N), TC: new Uint8Array(N), CR: F(N), CG: F(N), CB: F(N), DR: F(N), DG: F(N), DB: F(N),
    pal: F(60), col: F(3), hue: 0, ld: -46, th: 0,
  };
}

// Trails: each root draws the segment it moved along this frame into TI as
// a line about three LEDs wide, keeping the brighter of what is there and
// the new line.
function trail(S, x0, y0, x1, y1, c) {
  const n = max(1, Math.ceil(2 * hypot(x1 - x0, y1 - y0)));
  if (n > 200) return;
  for (let s = 0; s <= n; s++) {
    const x = x0 + ((x1 - x0) * s) / n, y = y0 + ((y1 - y0) * s) / n;
    for (let yy = floor(y - 2); yy <= y + 1; yy++)
      for (let xx = floor(x - 2); xx <= x + 1; xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const w = (1 - hypot(xx + 0.5 - x, yy + 0.5 - y) / 1.7) * (0.6 + 0.4 * rnd()), p = yy * W + xx;
        if (w > S.TI[p]) (S.TI[p] = w), (S.TC[p] = c);
      }
  }
}

function splat(R, G, B, x, y, r, g, b) {
  const ix = floor(x - 0.5), iy = floor(y - 0.5), ax = x - 0.5 - ix, ay = y - 0.5 - iy;
  for (let q = 0; q < 4; q++) {
    const xx = ix + (q & 1), yy = iy + (q >> 1);
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const w = (q & 1 ? ax : 1 - ax) * (q >> 1 ? ay : 1 - ay), p = yy * W + xx;
    R[p] += w * r, G[p] += w * g, B[p] += w * b;
  }
}

// The perturbation: the coefficient of x^pow times 1 + eta e^(2 pi i th),
// with eta scaled so that 2^e2 on x^19 is Wilkinson's own change. After a
// K3 tap it slides from the old power to the new one over half a second.
function perturb(S) {
  const a = 2 * PI * S.th, m = S.mix;
  S.Cr.fill(0), S.Ci.fill(0);
  for (const [k, f] of [[S.pow0, 1 - m], [S.pow, m]]) {
    const e = f * 2 ** S.e2 * (AB[k] / 210) * (SENS[19] / SENS[k]) * Math.sign(A[k]);
    S.Cr[k] += e * cos(a);
    S.Ci[k] += e * sin(a);
  }
}

function step(S, d, sp, clouds) {
  // While K1's hold lasts the sweep waits and the perturbation eases to
  // 2^-23; at most ten octaves a second either way.
  if (S.hold > 0) S.hold -= d;
  else S.ph += (d * sp) / 24;
  S.mix = min(1, S.mix + d * 2);
  const u = (1 - cos(2 * PI * S.ph)) / 2, to = S.hold > 0 ? WILK : LO + (HI - LO) * u;
  S.e2 += cl(to - S.e2, -10 * d, 10 * d);
  perturb(S);
  const { Z, Zo } = S;
  Zo.set(Z);
  seed(Z);
  aberth(Z, S.Cr, S.Ci, 40, 0);
  for (let i = 0; i < 20; i++) trail(S, toX(Zo[2 * i + 1]), toY(Zo[2 * i]), toX(Z[2 * i + 1]), toY(Z[2 * i]), i);
  if (clouds) cloud(S, clouds);
}

// Clouds: the roots of p + C with every coefficient below the top one also
// multiplied by 1 + delta u_j, u_j uniform in [-1, 1], solved from the
// current roots. Each root lands as a dot of its root's colour and its own
// brightness.
function cloud(S, n) {
  const { Z, W: Zw, Br, Bi, Cr, Ci, CR, CG, CB, pal } = S, dl = 2 ** S.ld;
  for (let m = 0; m < n; m++) {
    for (let j = 0; j < 20; j++) (Br[j] = Cr[j] + dl * (2 * rnd() - 1) * A[j]), (Bi[j] = Ci[j]);
    Zw.set(Z);
    seed(Zw);
    aberth(Zw, Br, Bi, 12, 4);
    for (let i = 4; i < 20; i++) {
      if (STEP[i] > 1e-8) continue;
      const w = 0.25 + 0.75 * rnd();
      const x = floor(toX(Zw[2 * i + 1])), y = floor(toY(Zw[2 * i]));
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q = y * W + x;
      (CR[q] = w * pal[3 * i]), (CG[q] = w * pal[3 * i + 1]), (CB[q] = w * pal[3 * i + 2]);
    }
  }
}

// Dust: LEDs picked at random take a grain coloured by the pseudozero level
// at a random point inside them, L = log2 |p(z) + C(z)| / sum |a_j| |z|^j:
// the smallest relative change of the coefficients that makes z a root.
function dust(S, n) {
  const { Cr, Ci, DR, DG, DB, col } = S;
  for (let m = 0; m < n; m++) {
    const p = floor(rnd() * N), x = (p & 63) + rnd(), y = (p >> 6) + rnd();
    const zr = RE0 + (H - y) / RY, zi = (x - XC) / CX;
    let pr = 1, pi = 0;
    for (let j = 1; j <= 20; j++) {
      const ur = zr - j, s = pr * ur - pi * zi;
      pi = pr * zi + pi * ur;
      pr = s;
    }
    // Plus the perturbation, and sum |a_j| |z|^j.
    let qr = 0, qi = 0;
    for (let j = 19; j >= 0; j--) {
      const s = qr * zr - qi * zi + Cr[j];
      qi = qr * zi + qi * zr + Ci[j];
      qr = s;
    }
    (pr += qr), (pi += qi);
    const r = hypot(zr, zi);
    let sum = 0;
    for (let j = 19; j >= 0; j--) sum = sum * r + AB[j];
    const L = log2(hypot(pr, pi) / sum + 1e-300), depth = S.ld - L, q = cl((depth + 8) / 14, 0, 1);
    hsv(S.hue + 0.68 - 0.2 * q, 0.8, 1, col, 0);
    if (depth > -8) {
      const v = rnd() < 0.2 + 0.5 * q ? 25 + (40 + 190 * q) * rnd() : 24.9 * rnd(), w = 0.4 * rnd();
      DR[p] = v * (col[0] + w * (1 - col[0])), DG[p] = v * (col[1] + w * (1 - col[1])), DB[p] = v * (col[2] + w * (1 - col[2]));
    } else (DR[p] = 24.99 * (0.15 * col[0] + 0.85 * rnd())), (DG[p] = 24.99 * (0.15 * col[1] + 0.85 * rnd())), (DB[p] = 24.99 * (0.15 * col[2] + 0.85 * rnd()));
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const sp = cl(kv[1], 0.2, 3);
  S.th = cl(kv[2], 0, 1);
  S.ld = -45 + 6 * cl(kv[3], 0, 1);
  for (let i = 0; i < 20; i++) hsv(S.hue + 0.8 + (0.17 * i) / 19, 0.75, 1, S.pal, 3 * i);
  const p = input.btnPressed || [];
  if (p[0]) S.hold = 3;
  if (p[2]) (S.pow0 = S.pow), (S.pow = S.pow ? S.pow - 1 : 19), (S.mix = 0);
  // The first frame starts a second and a half into the sweep, so the
  // first pairs have left the axis and drawn their arcs.
  if (!S.warm) {
    S.warm = 1;
    const u = (1 - cos(2 * PI * S.ph)) / 2, e0 = LO + (HI - LO) * u;
    for (let e = LO; e < e0; e += 0.25) (S.e2 = min(e, e0)), perturb(S), seed(S.Z), aberth(S.Z, S.Cr, S.Ci, 40, 0);
    S.e2 = e0;
    for (let i = 0; i < 45; i++) step(S, 1 / 30, sp, i > 30 ? 4 : 0), fade(S, 1 / 30), dust(S, 900);
  }
  S.t += d;
  step(S, d, sp, 8);
  fade(S, d);
  dust(S, 1200);
}

function fade(S, d) {
  const ft = exp(-d / 3.5), fc = exp(-d / 2), fd = exp(-d / 3);
  const { TI, CR, CG, CB, DR, DG, DB } = S;
  for (let p = 0; p < N; p++) {
    TI[p] *= ft;
    CR[p] *= fc, CG[p] *= fc, CB[p] *= fc;
    DR[p] *= fd, DG[p] *= fd, DB[p] *= fd;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { TI, TC, CR, CG, CB, DR, DG, DB, pal, Z } = S;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const ti = TI[p], c = 3 * TC[p], tv = ti > 0.02 ? 190 * ti : 0, cg = 0.35;
    R[p] = DR[p] + tv * pal[c] + 235 * CR[p];
    G[p] = DG[p] + tv * pal[c + 1] + 235 * CG[p];
    B[p] = DB[p] + tv * pal[c + 2] + 235 * CB[p];
  }
  // The integers 1 to 20 marked on both edges, longer at every fifth.
  for (let k = 1; k <= 20; k++) {
    const y = 123 - 6 * (k - 1), l = k % 5 ? 2 : 3;
    for (let x = 0; x < l; x++) for (const xx of [x, 63 - x]) (R[y * W + xx] += 30), (G[y * W + xx] += 34), (B[y * W + xx] += 40);
  }
  for (let i = 0; i < 20; i++) {
    const x = toX(Z[2 * i + 1]), y = toY(Z[2 * i]), c = 3 * i;
    splat(R, G, B, x, y, 160 + 300 * pal[c], 160 + 300 * pal[c + 1], 160 + 300 * pal[c + 2]);
  }
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, cl(R[p], 0, 255) | 0, cl(G[p], 0, 255) | 0, cl(B[p], 0, 255) | 0);
}
