// ===== Patternflow pattern =====
// Title:   Hydrogen Orbital
// Family:  physics
// Idea:    Thousands of points drawn at random from the probability density of one hydrogen eigenstate stand as a cloud with its z axis up the panel and turn slowly about it, each point one LED that never touches another lit LED, coloured by the sign of the real wavefunction so the nodal planes, cones and spheres stay dark between the lobes.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hydrogen atom eigenfunctions (Erwin Schrödinger, 1926), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Orbital=1..12, Slab=0..1
//
// Knob 1: Hue. Turns the two sign colours round the wheel together, always opposite each other. At 0 the positive lobes are amber and the negative ones azure.
// Knob 2: Speed. How fast the cloud turns about its vertical axis: at 2 once in 16 s, at 0.2 once in 160 s, at 3 once in 11 s.
// Knob 3: Orbital. Walks twelve real orbitals (n, l, m): 5g xz3 (5,4,1), 3d z2 (3,2,0), 4f xz2 (4,3,1), 5g z4 (5,4,0), 4d z2 (4,2,0), 6g z4 (6,4,0), 4f z3 (4,3,0), 6h xz4 (6,5,1), 5f z3 (5,3,0), 5p z (5,1,0), 7i z6 (7,6,0) and 6f xz2 (6,3,1). The ones with m = 0 look the same from every side, so only their points stream round as they turn; the xz ones open into a flower of 2l lobes when their xz plane faces us and close into a stack of lobes and rings a quarter turn later.
// Knob 4: Slab. How deep a slab of the cloud is kept, through the nucleus and facing us, so the near side of a ring does not hide the lobes inside it. For 5g xz3 the cloud is 107 LEDs deep: at 0 a slice 9 LEDs thick, where each of the n - l - 1 radial nodes shows as a dark ring and each nodal cone or plane as dark lines through the centre; at 0.06 a slab 33 LEDs thick; at 1 the whole cloud.

const W = 64, H = 128;
// n, l, m of each orbital; m > 0 takes cos(m phi), m < 0 sin(|m| phi).
const ORB = [
  [5, 4, 1], [3, 2, 0], [4, 3, 1], [5, 4, 0], [4, 2, 0], [6, 4, 0],
  [4, 3, 0], [6, 5, 1], [5, 3, 0], [5, 1, 0], [7, 6, 0], [6, 3, 1],
];
const MAXP = 16000, NR = 2048, NU = 1024;
// The share of LEDs the cloud keeps lit: the number of points follows it.
const LIT = 0.2;
// The points fill the boundary surface that holds this share of the
// probability; the faint halo outside it is left out.
const KEEP = 0.97;
// Opening hue of the positive lobes: amber.
const H0 = 0.09;
const { floor, min, max, abs, sqrt, exp, sin, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Generalized Laguerre polynomial L_k^a(x) by its three-term recurrence.
function laguerre(k, a, x) {
  if (k === 0) return 1;
  let l0 = 1, l1 = 1 + a - x;
  for (let j = 1; j < k; j++) {
    const l2 = ((2 * j + 1 + a - x) * l1 - (j + a) * l0) / (j + 1);
    l0 = l1;
    l1 = l2;
  }
  return l1;
}

// Associated Legendre function P_l^m(u), m >= 0, by the recurrence in l.
function legendre(l, m, u) {
  let pmm = 1;
  const s = sqrt(max(0, 1 - u * u));
  for (let j = 1; j <= m; j++) pmm *= -(2 * j - 1) * s;
  if (l === m) return pmm;
  let p1 = u * (2 * m + 1) * pmm;
  if (l === m + 1) return p1;
  let p0 = pmm;
  for (let k = m + 2; k <= l; k++) {
    const p2 = ((2 * k - 1) * u * p1 - (k + m - 1) * p0) / (k - m);
    p0 = p1;
    p1 = p2;
  }
  return p1;
}

// The radial part R_nl up to a constant: rho^l e^(-rho/2) L_(n-l-1)^(2l+1)(rho),
// rho = 2r/n, with r in Bohr radii.
function radial(n, l, r) {
  const rho = (2 * r) / n;
  return rho ** l * exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
}

// Invert a cumulative table of N bins on [a, b] at a uniform draw q.
function invert(c, N, a, b, q) {
  let lo = 0, hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid] <= q) lo = mid;
    else hi = mid;
  }
  const f = (q - c[lo]) / max(1e-12, c[hi] - c[lo]);
  return a + ((lo + f) / N) * (b - a);
}

// One point of |psi|^2, in Bohr radii: out = x, y, z, sign of psi, |psi|^2.
// |psi|^2 r^2 dr du dphi splits into r^2 R^2 in r, P_l^m(u)^2 in u = cos(theta)
// and cos^2(m phi) in phi, so each is drawn on its own.
function draw1(O, out) {
  const { n, l, m } = O;
  const r = invert(O.rc, NR, 0, O.rmax, random()), u = invert(O.uc, NU, -1, 1, random());
  let ph = random() * 2 * PI, tr = 1;
  if (m !== 0) {
    for (;;) {
      tr = m > 0 ? cos(m * ph) : sin(-m * ph);
      if (random() < tr * tr) break;
      ph = random() * 2 * PI;
    }
  }
  const s = sqrt(max(0, 1 - u * u)), psi = radial(n, l, r) * legendre(l, abs(m), u) * tr;
  out[0] = r * s * cos(ph);
  out[1] = r * s * sin(ph);
  out[2] = r * u;
  out[3] = psi >= 0 ? 1 : -1;
  out[4] = psi * psi;
}

// Tables of the cumulative distribution in r and in u, the boundary surface,
// and the scale that stands the cloud on the panel.
function build(o) {
  const [n, l, m] = ORB[o];
  const rmax = 2.5 * n * n + 8 * n + 10, rc = new Float64Array(NR + 1), uc = new Float64Array(NU + 1);
  for (let i = 0; i < NR; i++) {
    const r = ((i + 0.5) / NR) * rmax, R = radial(n, l, r);
    rc[i + 1] = rc[i] + r * r * R * R;
  }
  for (let i = 0; i < NU; i++) {
    const P = legendre(l, abs(m), -1 + (2 * (i + 0.5)) / NU);
    uc[i + 1] = uc[i] + P * P;
  }
  for (let i = 1; i <= NR; i++) rc[i] /= rc[NR];
  for (let i = 1; i <= NU; i++) uc[i] /= uc[NU];
  const O = { n, l, m, rmax, rc, uc, scale: 1, depth: 1, c: 0 };
  // Points come with density |psi|^2, so the share of them above a level c
  // is the probability inside the surface |psi|^2 = c.
  const p = [0, 0, 0, 0, 0], d2 = new Float64Array(8000), zs = [], hs = [], rs = [];
  for (let i = 0; i < d2.length; i++) {
    draw1(O, p);
    d2[i] = p[4];
  }
  d2.sort();
  O.c = d2[floor((1 - KEEP) * d2.length)];
  for (let i = 0; i < 3000; i++) {
    do draw1(O, p);
    while (p[4] < O.c);
    zs.push(abs(p[2]));
    hs.push(sqrt(p[0] * p[0] + p[1] * p[1]));
    rs.push(sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]));
  }
  // 199 points in 200 within 62 LEDs up or down, and within 48 either side:
  // a wide orbital runs a little past the edges rather than shrink.
  const q = (a) => a.sort((x, y) => x - y)[floor(0.995 * a.length)];
  O.scale = min(62 / q(zs), 48 / q(hs));
  O.depth = q(rs);
  return O;
}

export function setup(params) {
  params.s = {
    o: -1, O: null, np: 5000, ang: -0.6, ca: 1, sa: 0, slab: 1, begun: false,
    x: new Float32Array(MAXP), y: new Float32Array(MAXP), z: new Float32Array(MAXP), sg: new Int8Array(MAXP), life: new Float32Array(MAXP),
    sx: new Float32Array(MAXP), dz: new Float32Array(MAXP),
    zb: new Float32Array(W * H), site: new Int8Array(W * H), tmp: [0, 0, 0, 0, 0],
    pos: [0, 0, 0], neg: [0, 0, 0], hue: 0, speed: 2, lit: 0,
  };
}

// The view, turned by ang about z: screen x, and depth toward us.
function project(S, i) {
  const x = S.x[i], y = S.y[i];
  S.sx[i] = x * S.ca - y * S.sa;
  S.dz[i] = -(x * S.sa + y * S.ca);
}

// A fresh point inside the boundary surface, drawn again until it lies in the slab.
function renew(S, i) {
  const t = S.tmp, O = S.O;
  for (let k = 0; k < 80; k++) {
    draw1(O, t);
    if (t[4] < O.c) continue;
    S.x[i] = t[0];
    S.y[i] = t[1];
    S.z[i] = t[2];
    S.sg[i] = t[3];
    project(S, i);
    if (abs(S.dz[i]) < S.slab) break;
  }
  S.life[i] = 1.5 + 3 * random();
}

// Each point to the nearest LED with x + y even, so no two lit LEDs are side
// by side; where several land, the nearest to us shows.
function sites(S) {
  const { zb, site, sx, dz, z, sg, O } = S, np = round(S.np), k = O.scale;
  zb.fill(-1e9);
  site.fill(0);
  let lit = 0;
  for (let i = 0; i < np; i++) {
    const fx = 32 + sx[i] * k, fy = 64 - z[i] * k;
    let ix = round(fx), iy = round(fy);
    if ((ix + iy) & 1) {
      const ex = fx - ix, ey = fy - iy;
      if (abs(ex) > abs(ey)) ix += ex > 0 ? 1 : -1;
      else iy += ey > 0 ? 1 : -1;
    }
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
    const p = iy * W + ix;
    if (!site[p]) lit++;
    if (dz[i] > zb[p]) {
      zb[p] = dz[i];
      site[p] = sg[i];
    }
  }
  S.lit = lit;
  // The number of points follows the share of lit LEDs.
  S.np = cl(S.np * ((LIT * W * H) / max(1, lit)) ** 0.4, 400, MAXP);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const o = round(cl(k[2], 1, ORB.length)) - 1;
  if (o !== S.o) {
    S.o = o;
    S.O = build(o);
    S.begun = false;
  }
  S.slab = S.O.depth * (0.08 + 0.92 * sqrt(cl(k[3], 0, 1)));
  S.ang += (d * S.speed * PI) / 16;
  S.ca = cos(S.ang);
  S.sa = sin(S.ang);
  if (!S.begun) {
    for (let i = 0; i < MAXP; i++) renew(S, i);
    for (let j = 0; j < 8; j++) sites(S);
    S.begun = true;
  }
  for (let i = 0; i < MAXP; i++) {
    S.life[i] -= d;
    project(S, i);
    if (S.life[i] < 0 || abs(S.dz[i]) >= S.slab) renew(S, i);
  }
  sites(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.O) return;
  const { zb, site, pos, neg } = S;
  const h = S.hue + H0;
  hsv(h, 0.72, 1, pos);
  hsv(h + 0.5, 0.72, 1, neg);
  const D = S.slab;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, s = site[p];
      if (!s) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // Nearer points brighter, the back of the slab at 0.7.
      const v = 0.7 + 0.3 * cl((zb[p] / D + 1) / 2, 0, 1), c = s > 0 ? pos : neg;
      display.setPixel(x, y, round(255 * c[0] * v), round(255 * c[1] * v), round(255 * c[2] * v));
    }
}
