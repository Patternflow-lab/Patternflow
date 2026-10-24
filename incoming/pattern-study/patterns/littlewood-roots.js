// ===== Patternflow pattern =====
// Title:   Littlewood Roots
// Family:  fractal
// Idea:    Every root of every polynomial of one degree whose coefficients are all +1 or -1 glows as a soft lace round the unit circle, with holes at the roots of unity, knotted fringes at its edges and a line of real roots, while the polynomials are walked one sign flip at a time and the roots of the current one hop over the lace as sparks that relight it where they land.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: roots of Littlewood polynomials (John Edensor Littlewood, 1966), pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Degree=13..16, Glow=0..1
//
// Knob 1: Hue. Turns the lace and the sparks round the colour wheel together; at 0 the lace is sea green, paler where it is dense, and the sparks nearly white.
// Knob 2: Speed. How many sign flips a second: eight at 2, twelve at 3 and under one at 0.2, where the light piles up under sparks that hardly move; each flip moves a spark a few LEDs.
// Knob 3: Degree. The degree n of the polynomials, 13 to 16: at 13 the lace holds the 106,496 roots of all 8192 polynomials with leading coefficient 1, at 16 nearly ten times as many, and the band grows narrower and smoother. Each change computes the lace afresh, and it draws itself in, in a fifth of a second at 13 and about two seconds at 16.
// Knob 4: Glow. How long a place stays lit after a spark lands on it, from just over a second near 0 to ten seconds at 1; the sparks and the patches they light grow wider with it, until at 1 most of the band is lit.
// Buttons: K1 tap flashes the unit circle the lace hugs.

const W = 64, H = 128, N = W * H;
const { min, max, floor, exp, abs, sqrt, cos, sin, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// 44 LEDs per unit: Re z from 0 to 1.45 across, Im z from 1.45 down to
// -1.45, so the unit circle runs from row 20 to row 108. The set is the same
// under z -> -z and z -> conj z, so the left half folds onto the right; all
// roots lie in 1/2 < |z| < 2, and those beyond 1.45 are few.
const S = 44;
// Widths in LEDs of the fine blur, the wide blur the lace is compared with,
// the sparks and the light they leave.
const FINE = 0.6, WIDE = 2.5, SPARK = 1.8, DEP = 1.4;
const px = (re) => abs(re) * S - 0.5, py = (im) => H / 2 - 0.5 - im * S;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Normalised Gaussian kernels, three widths each side.
function kernel(sg) {
  const R = Math.ceil(sg * 3), k = new Float32Array(2 * R + 1);
  let s = 0;
  for (let i = -R; i <= R; i++) s += k[i + R] = exp((-i * i) / (2 * sg * sg));
  for (let i = 0; i <= 2 * R; i++) k[i] /= s;
  return k;
}
const KF = kernel(FINE), KW = kernel(WIDE);

export function setup(params) {
  params.s = {
    n: 0, M: 0, i: 0, c: null, re: null, im: null, pr: null, pi: null, built: 0,
    dens: new Float32Array(N), lace: new Float32Array(N), tmp: new Float32Array(N), wide: new Float32Array(N), glow: new Float32Array(N),
    step: 0, hue: 0, sp: 2, tau: 1, ring: 0, glw: 0.06, col: new Float32Array(12), colHue: -1,
  };
}

// The polynomial z^n + z^(n-1) + c(n-2) z^(n-2) + ... + c0 with every c = +-1.
// Fixing the top two coefficients loses nothing: -p(-z) has the other sign
// of z^(n-1), and its roots are -z, which fold onto the conjugates of the
// roots of p. The walk starts at all +1, whose roots are the (n+1)th roots
// of unity other than 1.
function start(P, n) {
  P.n = n;
  P.M = 1 << (n - 1);
  P.i = 0;
  P.built = 0;
  P.c = new Float64Array(n + 1).fill(1);
  P.re = new Float64Array(n);
  P.im = new Float64Array(n);
  P.pr = new Float64Array(n);
  P.pi = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (2 * PI * (k + 1)) / (n + 1);
    P.re[k] = P.pr[k] = cos(a);
    P.im[k] = P.pi[k] = sin(a);
  }
  P.dens.fill(0);
  P.lace.fill(0);
}

// Durand-Kerner (Weierstrass) iteration: every root at once moves by
// p(z_r) / prod (z_r - z_s). Started from the roots of the polynomial one
// sign flip back, it settles in about eight rounds. Returns false if it has
// not settled.
function solve(P, rounds) {
  const n = P.n, c = P.c, re = P.re, im = P.im;
  for (let it = 0; it < rounds; it++) {
    let mx = 0;
    for (let r = 0; r < n; r++) {
      const x = re[r], y = im[r];
      let pr = 1, pi = 0;
      for (let k = n - 1; k >= 0; k--) {
        const t = pr * x - pi * y + c[k];
        pi = pr * y + pi * x;
        pr = t;
      }
      let dr = 1, di = 0;
      for (let s = 0; s < n; s++) {
        if (s === r) continue;
        const ux = x - re[s], uy = y - im[s], t = dr * ux - di * uy;
        di = dr * uy + di * ux;
        dr = t;
      }
      let dd = dr * dr + di * di;
      if (!(dd > 1e-30)) dd = 1e-30;
      const qr = (pr * dr + pi * di) / dd, qi = (pi * dr - pr * di) / dd;
      re[r] = x - qr;
      im[r] = y - qi;
      const m = qr * qr + qi * qi;
      if (m > mx) mx = m;
    }
    if (mx < 1e-13) return true;
  }
  return false;
}

// One step along the Gray code: flip the coefficient its index says, then
// find the new roots. If the warm start fails (two roots nearly meeting),
// start again from a circle.
function advance(P) {
  P.i = (P.i + 1) % P.M;
  let b = P.n - 2;
  if (P.i) for (b = 0; !((P.i >> b) & 1); b++);
  P.c[b] = -P.c[b];
  if (solve(P, 24)) return;
  for (let k = 0; k < P.n; k++) {
    P.re[k] = 1.1 * cos((2 * PI * k) / P.n + 0.4);
    P.im[k] = 1.1 * sin((2 * PI * k) / P.n + 0.4);
  }
  solve(P, 80);
}

// Bilinear splat of the folded roots into the density. The fold puts the
// mirror line Re z = 0 half a LED left of column 0, so weight that falls
// into column -1 belongs to column 0.
function splat(P) {
  const re = P.re, im = P.im, d = P.dens;
  for (let r = 0; r < P.n; r++) {
    const X = px(re[r]), Y = py(im[r]);
    const x0 = floor(X), y0 = floor(Y), fx = X - x0, fy = Y - y0;
    if (!(x0 >= -1 && x0 < W && y0 >= 0 && y0 < H - 1)) continue;
    const xa = x0 < 0 ? 0 : x0, xb = x0 + 1;
    d[y0 * W + xa] += (1 - fx) * (1 - fy);
    d[(y0 + 1) * W + xa] += (1 - fx) * fy;
    if (xb < W) {
      d[y0 * W + xb] += fx * (1 - fy);
      d[(y0 + 1) * W + xb] += fx * fy;
    }
  }
}

// Separable blur of src into out with kernel k; the column left of 0 is the
// mirror of column 0, as the fold makes it.
function blur(src, out, tmp, k) {
  const R = (k.length - 1) / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -R; i <= R; i++) {
        let xx = x + i;
        if (xx < 0) xx = -1 - xx;
        else if (xx >= W) continue;
        a += src[y * W + xx] * k[i + R];
      }
      tmp[y * W + x] = a;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -R; i <= R; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < H) a += tmp[yy * W + x] * k[i + R];
      }
      out[y * W + x] = a;
    }
}

// The lace level, 0..1: the finely blurred density, normalised by the number
// of roots expected in all so the lace fades in while it builds, and
// sharpened against its own wide blur, so the holes round the roots of unity
// go dark and the knots of the fringe stand out of the band.
function tone(P) {
  const L = P.lace, Wd = P.wide;
  blur(P.dens, L, P.tmp, KF);
  blur(P.dens, Wd, P.tmp, KW);
  // About 3600 LEDs of band at this scale, so this makes its mean density 1.
  const norm = 3600 / (P.M * P.n);
  for (let p = 0; p < N; p++) {
    const a = L[p], q = a / (Wd[p] + 1e-9);
    L[p] = min(1, min(1, (a * norm) / 2.5) ** 1.2 * min(1.6, q * q));
  }
}

function blob(G, X, Y, sg, amp) {
  const R = Math.ceil(sg * 2.6), k = 1 / (2 * sg * sg);
  const xa = max(0, floor(X - R)), xb = min(W - 1, floor(X + R) + 1), ya = max(0, floor(Y - R)), yb = min(H - 1, floor(Y + R) + 1);
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const dx = x - X, dy = y - Y;
      // The mirror image across Re z = 0 for blobs near the left edge.
      const dm = x + 1 + X;
      G[y * W + x] += amp * (exp(-(dx * dx + dy * dy) * k) + (X < R ? exp(-(dm * dm + dy * dy) * k) : 0));
    }
}

function colours(P) {
  const h = P.hue + 0.42, c = P.col;
  // The lace deep where it is thin and paler where it is dense, the light
  // the sparks leave a little bluer, and the sparks nearly white.
  hsv(h, 0.85, 1, c, 0);
  hsv(h + 0.03, 0.4, 1, c, 9);
  hsv(h + 0.07, 0.5, 1, c, 3);
  hsv(h + 0.03, 0.18, 1, c, 6);
  P.colHue = P.hue;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 13, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.sp = cl(k[1], 0.2, 3);
  // About a second at Glow 0, eight at 1.
  P.glw = cl(k[3], 0, 1);
  P.tau = 1.2 * 8 ** P.glw;
  const n = round(cl(k[2], 13, 16));
  if (n !== P.n) start(P, n);
  if (P.built < P.M) {
    // Build the lace: about 1.3 million root updates a frame, so degree 13
    // takes six frames and degree 16 about two seconds.
    const per = max(64, floor(1.3e6 / (9 * n * n)));
    for (let j = 0; j < per && P.built < P.M; j++, P.built++) {
      advance(P);
      splat(P);
    }
    tone(P);
    if (P.built >= P.M) {
      P.step = 0;
      P.pr.set(P.re);
      P.pi.set(P.im);
    }
  } else {
    // The walk: 4 x Speed flips a second. A spark glides from where it was
    // to its new root over the first half of the step and lights the lace
    // where it lands.
    P.step += d * 4 * P.sp;
    while (P.step >= 1) {
      P.step -= 1;
      for (let r = 0; r < P.n; r++) blob(P.glow, px(P.re[r]), py(P.im[r]), DEP + 2.2 * P.glw, 0.55);
      P.pr.set(P.re);
      P.pi.set(P.im);
      advance(P);
    }
  }
  const g = P.glow, f = exp(-d / P.tau);
  for (let p = 0; p < N; p++) g[p] *= f;
  const b = input.btnPressed || [];
  if (b[0]) P.ring = 1;
  P.ring = max(0, P.ring - d * 0.6);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.colHue !== P.hue) colours(P);
  const L = P.lace, G = P.glow, T = P.tmp, c = P.col;
  // The sparks into the scratch buffer, eased between their old and new
  // roots.
  T.fill(0);
  if (P.built >= P.M) {
    let e = cl(P.step * 2, 0, 1);
    e = e * e * (3 - 2 * e);
    for (let r = 0; r < P.n; r++) {
      const x = P.pr[r] + (P.re[r] - P.pr[r]) * e, y = P.pi[r] + (P.im[r] - P.pi[r]) * e;
      blob(T, px(x), py(y), SPARK + 1.4 * P.glw, 0.36);
    }
  }
  const ring = P.ring * P.ring;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const l = L[p], lace = l > 0.09 ? (0.6 * (l - 0.09)) / 0.91 : 0, sp0 = T[p], m = 0.5 * l * l;
      // The glow saturates softly and only lights the lace, so a place lit
      // again and again shows the lace's own grain.
      const gl = 0.4 * l * (1 - exp(-G[p] * 1.2));
      let sp = sp0;
      if (ring > 0) {
        const re = (x + 0.5) / S, im = (H / 2 - 0.5 - y) / S, dr = (sqrt(re * re + im * im) - 1) * S;
        sp += 0.45 * ring * exp(-dr * dr * 0.18);
      }
      const v1 = lace, v2 = gl, v3 = min(0.5, sp);
      const lr = c[0] + (c[9] - c[0]) * m, lg = c[1] + (c[10] - c[1]) * m, lb = c[2] + (c[11] - c[2]) * m;
      const r = lr * v1 + c[3] * v2 + c[6] * v3, g = lg * v1 + c[4] * v2 + c[7] * v3, b = lb * v1 + c[5] * v2 + c[8] * v3;
      display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
}
