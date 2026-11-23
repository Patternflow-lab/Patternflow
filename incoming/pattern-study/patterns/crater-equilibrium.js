// ===== Patternflow pattern =====
// Title:   Crater Equilibrium
// Family:  cratering
// Idea:    A bare airless surface seen from straight above under a low sun that goes round it, where meteoroids keep arriving at random, many small and few large, each throwing a flash and a ring of dust and then cutting a sharp bowl with a raised rim, bright rays and a blanket of ejecta over whatever lay there, while ash and creep slowly fill and round the old bowls, so that craters pile up until they wear out as fast as they are made and the count stops growing.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the saturation equilibrium of a crater population, where N(>D) stops growing along D^-2 (Donald Gault, 1970, from memory), crater degradation as slope-dependent diffusion (Lawrence Soderblom, 1970; Caleb Fassett and Bradley Thomson, 2014, from memory), ejecta thickness falling as r^-3 from the rim (Thomas McGetchin and colleagues, 1973, from memory), hill shading under a raking sun (Berthold Horn, 1981, from memory), simple and complex crater shapes with terraced walls and a central peak (Henry Melosh, 1989, from memory), pattern round 226
// Round:   226
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Rate=0..4, Sun=-1..1, Giants=-1..1
//
// Knob 1: Tint. The colour of the ground, which goes round once and comes back at 1: grey-blue regolith where the knob opens, steel blue at 0.25, ochre at 0.5, the rust of Mars at 0.75. The sun and the shaded fill turn with it.
// Knob 2: Rate. How fast new craters arrive, doubling every 1.25 steps of the knob: 0.33 of the opening rate at 0, one impact on the panel every 6.6 seconds, where the ground is smooth and holds a few big bowls; the opening rate at 2, one every 2.4 seconds, with bowls of every age; 3 times that at 4, one every 0.7 seconds, a packed field of overlapping bowls.
// Knob 3: Sun. How high the sun stands: 7 degrees at -1, where a rim 3 LEDs high throws a shadow 24 LEDs long and the flat ground is dim, 22 degrees at 0 where it opens, a shadow of 7, and 55 at +1, a shadow of 2, where the relief goes flat and the ground is bright. Whatever the knob says, the sun goes round once in about 140 seconds.
// Knob 4: Giants. The share of the impacts that are large, as the slope b of the size law, cumulative count falling as D^-b with D from 12 to 56 LEDs: b is 2.75 at -1, where the median crater is 17 LEDs across and 12 percent are 30 or more; 1.9 where it opens, 19 across and 23 percent; and 1.15 at +1, 24 across and 27 percent, with basins of 40 to 56 LEDs taking the panel.

const W = 64, H = 128, N = W * H;
const { floor, ceil, sqrt, exp, log, sin, cos, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// What the picture is. A height field on the LED grid, in LED lengths, and a second field for fresh bright material.
// Impacts are a Poisson stream. Diameters follow a truncated power law from DMIN to DMAX LEDs, and the stream is set
// by the area of ground the craters cover each second, RHO0 panels a second at Rate 2, so the number of impacts
// follows from the size law. Centres may lie MARG diameters off the panel, so craters and rays come in over the edge.
const DMIN = 12, DMAX = 56, MARG = 1.4;
const AREF = (W + 2 * MARG * DMAX) * (H + 2 * MARG * DMAX);
const RHO0 = 0.0075;
// Creep: the flux down a slope is KAP times the slope, nearly three times that where the slope is 0.8, so a rim goes from a
// sharp crest to a ridge 3 LEDs wide in a few minutes. KMAX stays under 1/4 for the step of 1 s.
const KAP = 0.015, KMAX = 0.23, ISC2 = 1 / (0.6 * 0.6);
const T_FILL = 200;     // s, in which the relief of a crater falls by a factor of e: ash, small falls and gardening fill it
const FR = exp(-1 / T_FILL);
const T_ALB = 180;      // s, in which fresh bright material matures to the ground's own tone
const AD = exp(-1 / T_ALB);
const PREMIN = 600, PREMAX = 1300; // s of impacts and creep run in the first update
const SEED = 226226;
const TF = 0.4;         // s, the time constant of the shock front that cuts a crater
const RAYV = 45;        // LEDs a second, the speed of a ray
// Distances a shadow ray looks at, in LEDs; they grow so that a 7 degree sun still has a reach of 84.
const STEPD = [1, 1.8, 2.6, 3.5, 4.5, 5.7, 7, 8.5, 10.2, 12.2, 14.5, 17, 20, 23.5, 27.5, 32, 37, 43, 50, 58, 67, 78, 90];
const AMB = 0.36;
// Ground tone by Tint: albedo, sun, shaded fill.
const TONES = [
  [[0.64, 0.66, 0.72], [1.0, 0.89, 0.72], [0.62, 0.68, 0.84]],
  [[0.5, 0.64, 0.86], [0.92, 0.96, 1.0], [0.4, 0.58, 1.0]],
  [[0.82, 0.66, 0.4], [1.0, 0.88, 0.64], [0.52, 0.52, 0.8]],
  [[0.8, 0.46, 0.32], [1.0, 0.8, 0.6], [0.6, 0.48, 0.74]],
];
const FLASH = [1.0, 0.86, 0.64];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = floor(x), yi = floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function setup(P) {
  P.rand = rng(SEED);
  P.ready = false;
  P.T = 0;
  P.acc = 0;
  P.h = new Float32Array(N);
  P.hn = new Float32Array(N);
  P.al = new Float32Array(N);
  P.lit = new Float32Array(N);
  P.add = new Float32Array(N);
  P.bg = new Float32Array(N);
  P.ev = [];
  P.hmax = 1;
  P.dirty = true;
  P.laz = 9;
  P.lel = 9;
  P.b = -1;
  P.q = 0;
  P.d2 = 100;
  P.work = -log(1 - P.rand());
  P.elev = 0.35;
  P.is = 1.2;
  P.k1 = 0;
  P.tint = new Float32Array(9);
  // The ground's own tone is not even: broad darker and lighter patches.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      P.bg[y * W + x] = 0.84 + 0.34 * (0.6 * vnoise(x / 34 + 5, y / 34 + 9) + 0.4 * vnoise(x / 15 + 20, y / 15 + 3));
}

// The size law: cumulative count falls as D^-b between DMIN and DMAX. d2 is the mean of D^2 over it.
function setSize(P, b) {
  P.b = b;
  P.q = pow(DMIN / DMAX, b);
  let s = 0;
  for (let i = 0; i < 128; i++) {
    const D = DMIN * pow(1 - ((i + 0.5) / 128) * (1 - P.q), -1 / b);
    s += D * D;
  }
  P.d2 = s / 128;
}

// One impact. In the first update it is cut at once; later it is cut by a front that runs out from the centre.
function impact(P, instant) {
  const rand = P.rand;
  const D = DMIN * pow(1 - rand() * (1 - P.q), -1 / P.b);
  const m = MARG * D;
  if (rand() * AREF > (W + 2 * m) * (H + 2 * m)) return;
  const x = -m + rand() * (W + 2 * m), y = -m + rand() * (H + 2 * m);
  const R = D / 2;
  const cx = D >= 24;
  const e = {
    x, y, R, D, age: 0, front: 0, rinf: 2.2 * R,
    d: D * (0.2 - 0.07 * smooth((D - 14) / 50)) * (0.85 + 0.3 * rand()),
    hr: D * 0.042 * (0.8 + 0.4 * rand()),
    hRef: 0, cx,
    p1: TAU * rand(), p2: TAU * rand(),
    pk: cx ? 0.05 * D * (0.7 + 0.6 * rand()) : 0,
    amp: 0.85 + 0.45 * rand(),
    rays: [],
  };
  e.c1 = cos(2 * e.p1); e.s1 = sin(2 * e.p1);
  e.c2 = cos(2 * e.p2); e.s2 = sin(2 * e.p2);
  // The ground level the bowl is cut from: the mean height under the crater.
  const h = P.h;
  const x0 = max(0, floor(x - 1.1 * R)), x1 = min(W - 1, ceil(x + 1.1 * R));
  const y0 = max(0, floor(y - 1.1 * R)), y1 = min(H - 1, ceil(y + 1.1 * R));
  let s = 0, n = 0;
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y;
      if (dx * dx + dy * dy < 1.21 * R * R) { s += h[j * W + i]; n++; }
    }
  e.hRef = n ? s / n : 0;
  if (D >= 9) {
    const nr = min(26, 8 + floor(D / 3));
    for (let k = 0; k < nr; k++)
      e.rays.push({
        a: TAU * rand(), L: R * (2.4 + 4.6 * rand() * rand()), amp: e.amp * (0.45 + 0.6 * rand()),
        ph: TAU * rand(), s: 1.3 * R, sg: 1.2 + 0.4 * rand(),
      });
  }
  if (instant) {
    stampRing(P, e, 0, e.rinf + 1);
    for (const r of e.rays) rayRun(P, e, r, r.L);
  } else P.ev.push(e);
  P.dirty = true;
}

// Cut the part of the crater between radii r0 and r1 (LEDs from the centre) into the height and the bright material.
function stampRing(P, e, r0, r1) {
  const { h, al } = P;
  const R = e.R, iR = 1 / R, cx = e.cx, hRef = e.hRef, hr = e.hr, d = e.d, dd = d + hr;
  const x0 = max(0, floor(e.x - r1)), x1 = min(W - 1, ceil(e.x + r1));
  const y0 = max(0, floor(e.y - r1)), y1 = min(H - 1, ceil(e.y + r1));
  const a2 = r0 * r0, b2 = r1 * r1;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - e.y;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - e.x;
      const r2 = dx * dx + dy * dy;
      if (r2 < a2 || r2 >= b2) continue;
      const u = sqrt(r2) * iR;
      if (u >= 2.2) continue;
      const i = y * W + x;
      // cos and sin of twice the azimuth
      const cc = r2 > 1e-6 ? (dx * dx - dy * dy) / r2 : 1, ss = r2 > 1e-6 ? (2 * dx * dy) / r2 : 0;
      let z, w, a;
      if (u < 1) {
        let uu = u * u;
        // Big craters have terraced walls, a stair that wanders round the bowl, and a central peak.
        if (cx) uu -= (0.55 * sin(TAU * 3 * uu + 0.45 * (cc * e.c1 + ss * e.s1))) / (TAU * 3);
        z = -d + dd * uu;
        if (cx) z += e.pk * exp(-uu * 39);
        w = 1;
        a = e.amp * (0.25 + 0.5 * smooth(u));
        h[i] = hRef + z;
        al[i] = a;
      } else {
        // Ejecta thins as the cube of the distance, a little thicker in two opposite directions.
        const ej = (hr / (u * u * u)) * (u < 1.5 ? 1 : 1 - smooth((u - 1.5) / 0.7)) * (1 + 0.3 * (cc * e.c2 + ss * e.s2));
        w = u < 1.25 ? 1 - smooth((u - 1) / 0.25) : 0;
        h[i] = ej + (1 - w) * h[i] + w * hRef;
        // The blanket is bright and thins outward.
        a = e.amp * 0.75 * pow(u, -1.3) * (u < 1.5 ? 1 : 1 - smooth((u - 1.5) / 0.7));
        const old = al[i] * (1 - w);
        al[i] = old > a ? old : a;
      }
    }
  }
}

// One ray from s up to `to`, as a chain of round blobs that fade along its length.
function rayRun(P, e, r, to) {
  const { al } = P;
  const ca = cos(r.a), sa = sin(r.a), sg = r.sg, inv = 1 / (2 * sg * sg), rad = ceil(3 * sg);
  for (let s = r.s; s < to; s += 0.8) {
    const px = e.x + ca * s, py = e.y + sa * s;
    if (px < -6 || py < -6 || px > W + 6 || py > H + 6) continue;
    const t = 1 - s / r.L;
    if (t <= 0) break;
    const v = r.amp * pow(t, 1.3) * (0.7 + 0.3 * sin(0.3 * s + r.ph));
    const ix = floor(px), iy = floor(py);
    for (let j = max(0, iy - rad); j <= min(H - 1, iy + rad); j++)
      for (let i = max(0, ix - rad); i <= min(W - 1, ix + rad); i++) {
        const dx = i + 0.5 - px, dy = j + 0.5 - py;
        const g = v * exp(-(dx * dx + dy * dy) * inv);
        if (g > al[j * W + i]) al[j * W + i] = g;
      }
  }
  r.s = to;
}

// Creep, one step of dt seconds, and the slow maturing of the bright material. The mean height is held at zero.
function diffuse(P, dt) {
  const h = P.h, o = P.hn, al = P.al;
  o.set(h);
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const i = r + x, v = h[i];
      if (x < W - 1) {
        const g = h[i + 1] - v;
        let k = KAP * (1 + g * g * ISC2);
        if (k > KMAX) k = KMAX;
        const f = k * dt * g;
        o[i] += f;
        o[i + 1] -= f;
      }
      if (y < H - 1) {
        const g = h[i + W] - v;
        let k = KAP * (1 + g * g * ISC2);
        if (k > KMAX) k = KMAX;
        const f = k * dt * g;
        o[i] += f;
        o[i + W] -= f;
      }
    }
  }
  let s = 0;
  for (let i = 0; i < N; i++) s += o[i];
  const mean = s / N;
  let mx = -1e9;
  for (let i = 0; i < N; i++) {
    const v = (o[i] - mean) * FR;
    o[i] = v;
    if (v > mx) mx = v;
    al[i] *= AD;
  }
  P.hmax = mx;
  P.h = o;
  P.hn = h;
  P.dirty = true;
}

function rate(P, k) {
  return pow(2, 0.8 * (cl(k[1], 0, 4) - 2));
}

// Impacts a second that the size law and the rate come to.
function lambda(P, rt) {
  return (rt * RHO0 * AREF) / (0.785 * P.d2);
}

function prerun(P, rt) {
  const steps = cl(ceil(3.2 / (rt * RHO0)), PREMIN, PREMAX);
  const lam = lambda(P, rt);
  for (let s = 0; s < steps; s++) {
    P.work -= lam;
    while (P.work <= 0) {
      impact(P, true);
      P.work -= log(1 - P.rand());
    }
    diffuse(P, 1);
  }
}

export function update(dt, input, P) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const b = 1.95 - 0.8 * cl(k[3], -1, 1);
  if (b !== P.b) setSize(P, b);
  const rt = rate(P, k);
  P.k1 = cl(k[0], 0, 1);
  const u = cl(k[2], -1, 1);
  P.elev = ((u < 0 ? 22 + 15 * u : 22 + 33 * u) * PI) / 180;
  const se = sin(P.elev);
  P.is = (0.14 + 0.38 * se) / se;
  if (!P.ready) {
    P.ready = true;
    prerun(P, rt);
  }
  P.T += dt;
  const lam = lambda(P, rt);
  P.work -= lam * dt;
  while (P.work <= 0) {
    impact(P, false);
    P.work -= log(1 - P.rand());
  }
  P.acc += dt;
  while (P.acc >= 1) {
    P.acc -= 1;
    diffuse(P, 1);
  }
  // The impacts being cut: the front runs out, the rays shoot after it.
  for (let n = P.ev.length - 1; n >= 0; n--) {
    const e = P.ev[n];
    e.age += dt;
    const f = e.rinf * (1 - exp(-e.age / TF));
    const to = f > e.rinf - 0.4 ? e.rinf + 1 : f;
    if (to > e.front) {
      stampRing(P, e, e.front, to);
      e.front = to;
      P.dirty = true;
    }
    for (const r of e.rays) if (r.s < r.L) {
      rayRun(P, e, r, min(r.L, r.s + RAYV * dt));
    }
    if (e.age > 5) P.ev.splice(n, 1);
  }
}

// Light and shadow on the height field: Lambert on the slope, and a shadow found by walking toward the sun.
function shade(P, az, elev) {
  const h = P.h, lit = P.lit, hmax = P.hmax + 0.5;
  const cx = cos(az), cy = sin(az), ce = cos(elev), se = sin(elev), te = se / ce;
  const lx = cx * ce, ly = cy * ce;
  const NS = STEPD.length;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xm = x > 0 ? i - 1 : i, xp = x < W - 1 ? i + 1 : i;
      const ym = y > 0 ? i - W : i, yp = y < H - 1 ? i + W : i;
      const hx = (h[xp] - h[xm]) / (xp - xm), hy = (h[yp] - h[ym]) / ((yp - ym) / W);
      const face = (se - hx * lx - hy * ly) / sqrt(1 + hx * hx + hy * hy);
      if (face <= 0) {
        lit[i] = 0;
        continue;
      }
      let light = 1;
      const hp = h[i] + 0.2;
      for (let s = 0; s < NS; s++) {
        const dd = STEPD[s];
        const px = x + cx * dd, py = y + cy * dd;
        if (px < 0 || py < 0 || px > W - 1 || py > H - 1) break;
        const ray = hp + dd * te;
        if (ray > hmax) break;
        const ix = px | 0, iy = py | 0, fx = px - ix, fy = py - iy;
        const j = iy * W + ix;
        const jx = ix < W - 1 ? 1 : 0, jy = iy < H - 1 ? W : 0;
        const ht = (h[j] * (1 - fx) + h[j + jx] * fx) * (1 - fy) + (h[j + jy] * (1 - fx) + h[j + jy + jx] * fx) * fy;
        const c = (ray - ht) / (0.2 * dd + 0.5);
        if (c < light) {
          light = c;
          if (light <= 0) break;
        }
      }
      lit[i] = light <= 0 ? 0 : face * smooth(light);
    }
}

// The sun goes round once in about 140 seconds, a little faster and slower on two periods that do not divide one another.
function azimuth(T) {
  return -2.35 + 0.045 * T + 0.22 * sin((TAU * T) / 137 + 1.3) + 0.08 * sin((TAU * T) / 59.3 + 0.4);
}

function paintEvents(P) {
  const add = P.add;
  add.fill(0);
  for (const e of P.ev) {
    const a = e.age;
    const fa = exp(-a / 0.3) * min(1, 0.5 + e.D / 40);
    if (fa > 0.02) {
      const sg = 1.4 + 0.16 * e.R, inv = 1 / (2 * sg * sg), rr = ceil(3 * sg);
      for (let y = max(0, floor(e.y - rr)); y <= min(H - 1, ceil(e.y + rr)); y++)
        for (let x = max(0, floor(e.x - rr)); x <= min(W - 1, ceil(e.x + rr)); x++) {
          const dx = x + 0.5 - e.x, dy = y + 0.5 - e.y;
          add[y * W + x] += fa * exp(-(dx * dx + dy * dy) * inv);
        }
    }
    const ra = exp(-a / 1.2) * 0.75;
    if (ra > 0.02 && e.front > 1) {
      const sg = 1.3 + 0.02 * e.R, inv = 1 / (2 * sg * sg), rf = e.front, ext = rf + 3 * sg;
      for (let y = max(0, floor(e.y - ext)); y <= min(H - 1, ceil(e.y + ext)); y++)
        for (let x = max(0, floor(e.x - ext)); x <= min(W - 1, ceil(e.x + ext)); x++) {
          const dx = x + 0.5 - e.x, dy = y + 0.5 - e.y;
          const dr = sqrt(dx * dx + dy * dy) - rf;
          if (dr * dr < 9 * sg * sg) add[y * W + x] += ra * exp(-dr * dr * inv);
        }
    }
  }
}

function tint(P) {
  const t = P.k1 * 4, i = floor(t) % 4, f = smooth(t - floor(t));
  const a = TONES[i], b = TONES[(i + 1) % 4], o = P.tint;
  for (let g = 0; g < 3; g++) for (let c = 0; c < 3; c++) o[g * 3 + c] = a[g][c] + (b[g][c] - a[g][c]) * f;
}

const tone = (v) => (v < 0.72 ? v : 0.72 + 0.28 * (1 - exp(-(v - 0.72) / 0.28)));

export function draw(display, P) {
  if (!P.ready) return;
  const az = azimuth(P.T);
  if (P.dirty || abs(az - P.laz) > 0.012 || abs(P.elev - P.lel) > 0.004) {
    shade(P, az, P.elev);
    P.dirty = false;
    P.laz = az;
    P.lel = P.elev;
  }
  paintEvents(P);
  tint(P);
  const { lit, al, bg, add, tint: tn, is } = P;
  const A0 = tn[0], A1 = tn[1], A2 = tn[2], S0 = tn[3], S1 = tn[4], S2 = tn[5], F0 = tn[6] * AMB, F1 = tn[7] * AMB, F2 = tn[8] * AMB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const alb = (1 + 0.9 * al[p]) * bg[p];
      const sun = lit[p] * is, fl = add[p];
      const r = A0 * alb * (S0 * sun + F0) + fl * FLASH[0];
      const g = A1 * alb * (S1 * sun + F1) + fl * FLASH[1];
      const b = A2 * alb * (S2 * sun + F2) + fl * FLASH[2];
      display.setPixel(x, y, 255 * tone(r), 255 * tone(g), 255 * tone(b));
    }
}
