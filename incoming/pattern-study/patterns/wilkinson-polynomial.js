// ===== Patternflow pattern =====
// Title:   Wilkinson's Polynomial
// Family:  algo
// Idea:    The twenty roots of (x - 1)(x - 2)...(x - 20) stand up the panel as beads, and as a change in the x^19 coefficient sweeps on a log scale up past Wilkinson's 2^-23 and back, the upper ten meet in pairs and fly apart sideways into the complex plane leaving arcs, inside a sparkling nebula of everywhere a root can be pushed by nudging every coefficient a little, whose bright core fills a fifth of the panel while the roots sit on the integers and shrinks to specks once they have split.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wilkinson's polynomial (James H. Wilkinson, 1959; "The perfidious polynomial", 1984), the Ehrlich-Aberth simultaneous root iteration (Louis W. Ehrlich, 1967; Oliver Aberth, 1973), pseudozero sets (Ronald G. Mosier, 1986; Kim-Chuan Toh and Lloyd N. Trefethen, 1994), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phase=0..1, Cloud=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the arcs and cloud dots run from purple at root 1 to rose at root 20 and the nebula is blue at its edge and cyan in its core; at 0.33 the arcs are yellow to green on a red and magenta nebula, at 0.66 cyan to blue on green and amber.
// Knob 2: Speed. At 2 the change climbs from 2^-35 to 2^-21 in 6 seconds and comes back down in 6, lingering at both ends; at 0.2 a round takes two minutes, at 3 eight seconds.
// Knob 3: Phase. Which way the change pushes, as a turn of the complex plane: a_19 becomes -210 - eps e^(2 pi i Phase). At 0 it is Wilkinson's: roots 16 and 17 meet first, at eps = 1.42e-10, then 14 and 15, 18 and 19, 12 and 13, and 10 and 11 at 1.91e-8, so at 2^-23 there are five pairs, the widest 16.73 +- 2.81i. At 0.5 eps pushes the other way and the neighbours change partners: 15 and 16 meet first, then 17-18, 13-14, 19-20, 11-12, and 9-10 just past 2^-23. At 0.25 and 0.75 eps is imaginary, there are no conjugate pairs, and no two roots come closer than 0.91: they peel off the axis one by one, alternately to the left and to the right.
// Knob 4: Cloud. delta, the size of the random relative nudges given to every coefficient below the top one, from 2^-45 at 0 to 2^-39 at 1; at the start 2^-44.6, about 330 times the rounding error of a double. There, with the roots on the integers, the dots of roots 13 to 16 land up to 1.7 away while root 5 moves 1e-4 and root 1 1e-11, and the delta set the clouds stay inside covers 19% of the panel; at 2^-23 it covers 2.4%. At 1 it covers 46% at the bottom of the sweep and still 45% at 2^-23.
// Buttons: K1 tap eases the change to exactly 2^-23 and holds it there for three seconds. K3 tap moves the change one power down, x^19, x^18 and on to the constant term 20!, then x^19 again: the roots first go home, then the sweep starts over on the new coefficient, scaled so that it pushes its most sensitive root as hard as 2^-23 pushes root 16; at x^0 the pairs run from 3-4 to 17-18.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, exp, log2, cos, sin, hypot, PI } = Math;
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

// The coefficients a_j of p(x) = (x - 1)...(x - 20), lowest first: a_19 =
// -210, a_0 = 20!. In doubles a_3 to a_7 are already rounded, which is
// harmless here: they only scale the nudges and the level below.
const A = new Float64Array(21);
A[0] = 1;
for (let k = 1; k <= 20; k++) for (let j = k; j >= 0; j--) A[j] = (j ? A[j - 1] : 0) - k * A[j];
const AB = A.map(abs);
// SENS[k]: the largest first-order shift a relative change of a_k gives any
// root, |a_k| r^k / |p'(r)| at its worst r (root 16 for a_19, root 10 for
// a_0). A K3 tap moves the change to another power, scaled by these.
const SENS = new Float64Array(20);
for (let k = 0; k < 20; k++)
  for (let r = 1; r <= 20; r++) {
    let d = 1;
    for (let j = 1; j <= 20; j++) if (j !== r) d *= abs(r - j);
    SENS[k] = max(SENS[k], (AB[k] * r ** k) / d);
  }

// The sweep runs log2 of the change from LO to HI and back, easing at both
// ends. At LO every root is within 0.07 of home (root 16 the farthest, under
// half a row); at HI root 20 is at 21.39 and the widest pair at
// 16.77 +- 3.49i, inside the panel's 31 columns either side.
const LO = -35, HI = -21, WILK = -23;

// The Ehrlich-Aberth iteration for all roots of p(z) + sum C_j z^j, j < 20,
// at once, from the starting points in Z (re, im pairs), at most `iters`
// sweeps, roots with index below `from` held where they are. p and p' come
// from the product form, which stays accurate next to the roots where the
// expanded coefficients would cancel to nothing. Run from rest with eps =
// 2^-23 it gives Wilkinson's table to nine places: 1 to 4 to the last
// digit, 4.999999928, 6.000006944, 6.999697234, 8.007267603, 8.917250249,
// 10.095266145 +- 0.643500904i, 11.793633881 +- 1.652329728i,
// 13.992358137 +- 2.518830070i, 16.730737466 +- 2.812624894i,
// 19.502439400 +- 1.940330347i and 20.846908101. STEP[i] keeps each root's
// last step squared.
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
    ph: 0.17, e2: LO, pow: 19, pk: 19, hold: 0, warm: 0,
    Z, Zo: new Float64Array(40), Zw: new Float64Array(40),
    Cr: new Float64Array(20), Ci: new Float64Array(20), Br: new Float64Array(20), Bi: new Float64Array(20),
    TI: F(N), TC: new Uint8Array(N), CR: F(N), CG: F(N), CB: F(N), DR: F(N), DG: F(N), DB: F(N),
    R: F(N), G: F(N), B: F(N), pal: F(60), col: F(3), hue: 0, ld: -45, th: 0,
  };
}

// Trails: each root draws the segment it moved along this frame into TI as
// a line about three LEDs wide, each LED it touches at its own brightness
// between 0.6 and 1 of the line's, keeping the brighter of that and what
// is there. Trails fade over three and a half seconds.
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

// The change: a_k, k = S.pk, becomes a_k + sign(a_k) eps e^(2 pi i th),
// so with k = 19 and th = 0 it is Wilkinson's -210 - eps, eps = 2^e2. For
// another k, eps is scaled by |a_k| SENS[19] / (210 SENS[k]).
function perturb(S) {
  const k = S.pk, a = 2 * PI * S.th, e = 2 ** S.e2 * (AB[k] / 210) * (SENS[19] / SENS[k]) * Math.sign(A[k]);
  S.Cr.fill(0), S.Ci.fill(0);
  S.Cr[k] = e * cos(a);
  S.Ci[k] = e * sin(a);
}

function step(S, d, sp, clouds) {
  // A K3 tap first takes the change back down to LO, where every root is
  // home, then moves it to the next power and starts the sweep again from
  // the bottom. K1's hold stops the sweep and eases the change to 2^-23.
  // Either way the change moves at most ten octaves a second.
  let to;
  if (S.pk !== S.pow) {
    to = LO;
    if (S.e2 < LO + 0.3) (S.pk = S.pow), (S.ph = 0);
  } else if (S.hold > 0) (S.hold -= d), (to = WILK);
  else {
    S.ph += (d * sp) / 24;
    to = LO + ((HI - LO) * (1 - cos(2 * PI * S.ph))) / 2;
  }
  S.e2 += cl(to - S.e2, -10 * d, 10 * d);
  perturb(S);
  const { Z, Zo } = S;
  Zo.set(Z);
  seed(Z);
  aberth(Z, S.Cr, S.Ci, 40, 0);
  for (let i = 0; i < 40; i++) if (!Number.isFinite(Z[i])) Z.set(Zo), (i = 40);
  for (let i = 0; i < 20; i++) trail(S, toX(Zo[2 * i + 1]), toY(Zo[2 * i]), toX(Z[2 * i + 1]), toY(Z[2 * i]), i);
  if (clouds) cloud(S, clouds);
}

// Clouds: eight times a frame, every coefficient below the top one of the
// current polynomial is also multiplied by 1 + delta u_j, u_j uniform in
// [-1, 1], and all twenty roots are solved again from the current ones.
// Each root whose last step was under 1e-4 lands as a dot of its root's
// colour and its own brightness, and fades over two seconds. With 24
// sweeps 99.9% land even with the roots on the integers, where the
// nudged copies are hardest.
function cloud(S, n) {
  const { Z, Zw, Br, Bi, Cr, Ci, CR, CG, CB, pal } = S, dl = 2 ** S.ld;
  for (let m = 0; m < n; m++) {
    for (let j = 0; j < 20; j++) (Br[j] = Cr[j] + dl * (2 * rnd() - 1) * A[j]), (Bi[j] = Ci[j]);
    Zw.set(Z);
    seed(Zw);
    aberth(Zw, Br, Bi, 24, 0);
    for (let i = 0; i < 20; i++) {
      if (!(STEP[i] <= 1e-8)) continue;
      const w = 0.25 + 0.75 * rnd();
      const x = floor(toX(Zw[2 * i + 1])), y = floor(toY(Zw[2 * i]));
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q = y * W + x;
      (CR[q] = w * pal[3 * i]), (CG[q] = w * pal[3 * i + 1]), (CB[q] = w * pal[3 * i + 2]);
    }
  }
}

// The nebula. z is a root of some polynomial whose coefficients below the
// top one differ from the current ones by at most a share delta each
// exactly when |p(z) + C(z)| <= delta sum |a_j| |z|^j (Mosier 1986), so
// L = log2 of the ratio is the smallest such delta, in octaves. Each frame
// 1200 LEDs picked at random take a grain for a random point inside them:
// in the delta set (L < ld) a grain lights with a chance up to 70% and up
// to full brightness, in the 16 delta and 256 delta sets around it the
// chance and the brightness fall off to 20% and 65, and the colour runs
// from cyan in the core to blue at the edge. Beyond 256 delta the grains
// stay under 25, the LEDs' threshold, and take any colour. Grains fade over
// three seconds.
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
    } else (DR[p] = 24.99 * rnd()), (DG[p] = 24.99 * rnd()), (DB[p] = 24.99 * rnd());
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
  if (p[2]) S.pow = S.pow ? S.pow - 1 : 19;
  // The roots are walked up from home to the sweep's opening place, 2^-31.4,
  // and the first second and a half is run before the first frame, so the
  // first pairs have left the axis and drawn their arcs; at Speed 2, 2^-23
  // then comes at 1 s and the top at 2.5 s.
  if (!S.warm) {
    S.warm = 1;
    const u = (1 - cos(2 * PI * S.ph)) / 2, e0 = LO + (HI - LO) * u;
    for (let e = LO; e < e0; e += 0.25) (S.e2 = min(e, e0)), perturb(S), seed(S.Z), aberth(S.Z, S.Cr, S.Ci, 40, 0);
    S.e2 = e0;
    for (let i = 0; i < 45; i++) step(S, 1 / 30, sp, i > 30 ? 4 : 0), fade(S, 1 / 30), dust(S, 900);
  }
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
  const { TI, TC, CR, CG, CB, DR, DG, DB, R, G, B, pal, Z } = S;
  for (let p = 0; p < N; p++) {
    const ti = TI[p], c = 3 * TC[p], tv = ti > 0.02 ? 190 * ti : 0;
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
