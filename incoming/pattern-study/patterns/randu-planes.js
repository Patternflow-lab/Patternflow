// ===== Patternflow pattern =====
// Title:   RANDU Planes
// Family:  number
// Idea:    Consecutive triples of IBM's RANDU generator tumble as a cloud of points in a unit cube, and each time the view passes along the planes 9x - 6y + z = n the cloud snaps into the 15 parallel lines it always lay on, one colour per plane.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: multiplicative congruential generator (D. H. Lehmer, 1949), RANDU (IBM, 1960s), the spectral test (R. R. Coveyou and R. D. MacPherson, 1967), random numbers fall mainly in the planes (George Marsaglia, 1968), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Generator=0..3, Points=1.8..8
//
// Knob 1: Hue. Turns the plane colours round the wheel. At 0 the 15 planes run from azure through violet, red and orange to green, top to bottom at one alignment and bottom to top at the next, as the cube turns over; the cube's edges stay a faint grey.
// Knob 2: Speed. How fast the cube tumbles. At 2 the view lines up with the planes every 3.2 s, first at 2.5 s, and lingers there: it turns at a tenth of its mean pace while the planes stand edge on, so the lines hold for about 0.4 s, and at 1.9 times it while they face the viewer. At 0.2 the alignments come 32 s apart, at 3 every 2.1 s.
// Knob 3: Generator. Picks the multiplier a of x -> a x mod m, and the view always passes along that generator's own widest planes. At 0 RANDU's 65539 = 2^16 + 3 puts the triples on 15 planes 5.2 LEDs apart; at 1 65541 = 2^16 + 5 on 35 planes 2.1 LEDs apart, the same trick one step on; at 2 George Marsaglia's 69069 mod 2^32 (1972) on 394 planes 0.16 LEDs apart, and at 3 the minimal standard 16807 mod 2^31 - 1 of Stephen Park and Keith Miller (1988) on 764 planes 0.09 LEDs apart, so for these two the cloud never lines up.
// Knob 4: Points. How many triples, in thousands: 1800 at the opening, 8000 at the top, where every line at an alignment is solid.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, sin, cos, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The generators: multiplier, modulus, and the shortest integer u with
// u1 + a u2 + a^2 u3 = 0 mod m/g, found by lattice reduction, where g is
// the gcd of the differences between outputs: 2 for RANDU, 4 for the
// multipliers 5 mod 8 that keep x mod 4, 1 for the prime modulus. Every
// triple p = (x, a x mod m, a^2 x mod m) / m then has u . p in Z + c for
// one fixed c, so it lies on one of the planes u . p = n + c, 1/|u|
// apart. All products stay below 2^53, so the doubles are exact.
const GENS = [
  { a: 65539, m: 2 ** 31, u: [9, -6, 1] },
  { a: 65541, m: 2 ** 31, u: [25, -10, 1] },
  { a: 69069, m: 2 ** 32, u: [22, 13, -359] },
  { a: 16807, m: 2 ** 31 - 1, u: [90, -44, 631] },
];
const MAXP = 8000;
const LING = 0.9;
const mulmod = (a, x, m) => {
  const y = a * x;
  return y - floor(y / m) * m;
};

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, gen: -9, count: 1800, psi: 0.687,
    qh: new Float64Array(MAXP), qn: new Float64Array(MAXP), qw: new Float64Array(MAXP), col: new Uint8Array(MAXP),
    ncol: 15, sc: 56, h: [1, 0, 0], n: [0, 1, 0], w: [0, 0, 1],
    R: new Uint8Array(N), G: new Uint8Array(N), B: new Uint8Array(N), Z: new Float32Array(N), c: [0, 0, 0],
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = sqrt(dot(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};
const l1 = (a) => abs(a[0]) + abs(a[1]) + abs(a[2]);

// The view: the cube tumbles about a screen-horizontal axis h that lies in
// the planes, so twice a turn the view looks along them and they stand
// edge on as horizontal lines stacked down the panel. Of all such axes, h
// is the one along which the cube is narrowest, so it fits the 64 LEDs.
function aim(S, g) {
  const n = unit(g.u);
  const e1 = unit(cross(n, abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(n, e1);
  let best = null;
  for (let i = 0; i < 360; i++) {
    const t = (i * PI) / 360, h = [0, 1, 2].map((j) => e1[j] * cos(t) + e2[j] * sin(t));
    if (!best || l1(h) < l1(best)) best = h;
  }
  S.n = n;
  S.h = best;
  S.w = cross(n, best);
  S.sc = min(56, 62 / l1(best));
}

function build(S) {
  const g = GENS[S.gen], m = g.m, u = g.u;
  aim(S, g);
  // Overlapping triples of consecutive outputs from the odd seed 12345.
  let x = 12345, y = mulmod(g.a, x, m), z = mulmod(g.a, y, m);
  const pl = new Int32Array(MAXP);
  let lo = 1e9, hi = -1e9;
  for (let k = 0; k < MAXP; k++) {
    const p = [x / m - 0.5, y / m - 0.5, z / m - 0.5];
    S.qh[k] = dot(p, S.h);
    S.qn[k] = dot(p, S.n);
    S.qw[k] = dot(p, S.w);
    pl[k] = floor((u[0] * x + u[1] * y + u[2] * z) / m + 0.125);
    lo = min(lo, pl[k]);
    hi = max(hi, pl[k]);
    x = y;
    y = z;
    z = mulmod(g.a, z, m);
  }
  // One colour per plane where there are at most 15; past that the plane
  // index mod 15, so neighbouring planes never share a colour.
  const count = hi - lo + 1;
  S.ncol = min(15, count);
  for (let k = 0; k < MAXP; k++) S.col[k] = (pl[k] - lo) % 15;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const gen = round(cl(k[2], 0, 3));
  if (gen !== S.gen) {
    S.gen = gen;
    build(S);
  }
  S.count = round(1000 * cl(k[3], 1.8, 8));
  // psi runs at a constant rate, pi every 3.2 s at Speed 2; the tumble
  // angle phi = psi - LING sin(2 psi) / 2 is psi itself at each alignment
  // (psi a multiple of pi) but moves there at a tenth of the pace, so the
  // lines hold for about 0.4 s.
  S.psi += (d * S.speed * PI) / 6.4;
}

function put(S, x, y, z, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  if (z < S.Z[p]) return;
  S.Z[p] = z;
  S.R[p] = r;
  S.G[p] = g;
  S.B[p] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const phi = S.psi - (LING * sin(2 * S.psi)) / 2, cp = cos(phi), sp = sin(phi), sc = S.sc, c = S.c;
  S.R.fill(0);
  S.G.fill(0);
  S.B.fill(0);
  S.Z.fill(-9);
  // The cube's edges, faint, behind everything.
  const corner = (i) => {
    const q = [(i & 1) - 0.5, ((i >> 1) & 1) - 0.5, ((i >> 2) & 1) - 0.5];
    const a = dot(q, S.n), b = dot(q, S.w);
    return [31.5 + sc * dot(q, S.h), 63.5 - sc * (a * cp + b * sp)];
  };
  for (let i = 0; i < 8; i++)
    for (const bit of [1, 2, 4]) {
      if (i & bit) continue;
      const [x0, y0] = corner(i), [x1, y1] = corner(i | bit);
      const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)));
      for (let t = 0; t <= n; t++) put(S, round(x0 + ((x1 - x0) * t) / n), round(y0 + ((y1 - y0) * t) / n), -5, 34, 36, 44);
    }
  const pal = [];
  for (let j = 0; j < 15; j++) {
    hsv(S.hue + 0.55 + (0.8 * j) / max(1, S.ncol - 1), 0.85, 1, c);
    pal.push([c[0], c[1], c[2]]);
  }
  for (let k = 0; k < S.count; k++) {
    const a = S.qn[k], b = S.qw[k];
    // Screen right is h and up is n cos phi + w sin phi, so the depth
    // toward the viewer, h x up, is n sin phi - w cos phi.
    const y = 63.5 - sc * (a * cp + b * sp), z = a * sp - b * cp;
    // Nearer points brighter: 0.5 at the back of the cube, 1 at the front.
    const v = 255 * (0.75 + 0.29 * z), col = pal[S.col[k]];
    put(S, round(31.5 + sc * S.qh[k]), round(y), z, round(col[0] * v), round(col[1] * v), round(col[2] * v));
  }
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, S.R[p], S.G[p], S.B[p]);
}
