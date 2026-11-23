// ===== Patternflow pattern =====
// Title:   Loop Extrusion
// Family:  genome
// Idea:    A Hi-C contact map of a simulated chromosome built live from the cohesin rings drawn as arcs beneath it, where rings land, slide outward, stall at convergent CTCF sites and fall off, and the time average of their loops makes squares along the diagonal, a bright dot in a square's corner and stripes where one leg is held and the other still slides.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: loop extrusion model (Alipour and Marko, 2012; Sanborn and colleagues, 2015; Fudenberg and colleagues, 2016), Hi-C (Lieberman-Aiden and colleagues, 2009), topologically associating domains (Dixon and colleagues, 2012; Nora and colleagues, 2012), the convergent CTCF rule (Rao and colleagues, 2014), all from memory, pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Processivity=0..3, CTCF=-1..1, Extruders=-1..1
//
// Knob 1: Hue. Turns the contact map, the arcs and the track round the wheel together. At 0 the map runs from near black through wine, red and orange to yellow-white at the brightest contacts and the arcs are cyan; at 0.5 the map is teal to ice blue and the arcs are orange.
// Knob 2: Processivity. How long a ring stays on the chromatin: 0.9 s at 0, 3.7 s at 1, 14.7 s at 2 where it opens and 59 s at 3, with each leg sliding 3 LEDs a second. At 0 the loops are 2 to 7 LEDs wide and come and go, so the map is a bright diagonal and little else; at 2 they reach the CTCF sites and hold there, which makes the squares, dots and stripes; at 3 they hold for a minute and the loops that read through a site grow long.
// Knob 3: CTCF. How often a site facing a leg stops it, as a share of the site's own strength. At -1 no site stops anything, the loops run to 30 LEDs and more until they slide off the end, and the squares dissolve into one bright haze; at 0 where it opens a site stops a leg 0.9 times its strength, so some legs read through; at +1 it is every time its strength allows and the squares are sharp with dots in their corners. The ticks above the baseline grow and shrink with it.
// Knob 4: Extruders. How many rings are on the chromosome at once: 1 at -1, 10 at 0 where it opens and 20 at +1. With one ring the map is the diagonal and one loop; with twenty the loops are 2 to 6 LEDs wide, nested in stacks, and the dots and stripes crowd the diagonal.

const W = 64, H = 128;
const NB = 64;               // bins along the chromosome: one LED each, in the map and along the baseline
const NN = NB * NB;
const { floor, ceil, sqrt, exp, log, sin, cos, abs, pow, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const tanh = (x) => {
  const e = exp(2 * x);
  return (e - 1) / (e + 1);
};

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

function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// The simulation. A leg slides V bins a second, with a random factor on every step. A ring is two
// legs, left and right, that start one bin apart and move outward.
const V = 3.0;
const STEP = 1 / 30;
const GAP = 1.8;             // a leg stops this many bins short of the next leg
const NS = 48;               // slots: 20 rings alive and the ones fading out
const PRE = 45;              // seconds run before the first frame, so that it opens as a picture
// CTCF sites: bin, the way the motif faces (+1 forward, which stops a left leg coming from the
// right; -1 reverse, which stops a right leg), and the strength it opens with. Forward on the
// left and reverse on the right is a convergent pair, and a TAD lies between.
const SITES = [
  [3, 1, 0.92], [10, 1, 0.12], [14, 1, 0.5], [20, -1, 0.55], [26, -1, 0.95], [29, 1, 0.9], [35, 1, 0.2], [37, -1, 0.3],
  [44, -1, 0.92], [47, 1, 0.88], [53, 1, 0.1], [57, -1, 0.2], [61, -1, 0.9],
];
const NSITE = SITES.length;
// Each site's strength wanders around its opening value on two slow sines, with periods in seconds
// that are prime or close to it, so one site fades while another rises and the squares merge and split.
const SPER_A = [97, 131, 163, 113, 149, 181, 127, 107, 139, 173, 89, 157, 119];
const SPER_B = [311, 257, 389, 283, 347, 421, 269, 331, 367, 293, 401, 241, 317];
const sprng = rng(225001);
const SPHASE = SITES.map(() => [sprng() * TAU, sprng() * TAU]);
const wander = (k, t) => 0.6 * sin((TAU * t) / SPER_A[k] + SPHASE[k][0]) + 0.4 * sin((TAU * t) / SPER_B[k] + SPHASE[k][1]);
const SW0 = SITES.map((_, k) => wander(k, 0));
const strength = (k, t) => cl(SITES[k][2] + 0.95 * (wander(k, t) - SW0[k]), 0, 1);

// The map. Contact falls as 1/(1+0.8 s) with the distance s between two bins; each ring adds a
// bright blob at the pair its two legs hold, and a plateau over the pairs inside its loop. Two
// running averages of that, 2.6 s and 14 s, are the population: the short one keeps the dots
// and the trail a sliding leg leaves, the long one keeps the squares steady.
const TF = 2.6, TS = 14;
const WF = 0.55, WS = 0.45;
const WD = 0.34, WM = 0.32, WL = 0.15;
const SIGD = 0.85;
const INV2S = 1 / (2 * SIGD * SIGD);
const PLAID = 0.5;
const HAZE = 0.026;          // contact that does not fall with distance: what the compartments modulate
const BETA = 0.7;           // how much of the contact across a site, at full strength, a site takes away
const BG = new Float32Array(NB), DOM = new Float32Array(NB);
for (let s = 0; s < NB; s++) {
  BG[s] = 0.75 / (1 + 0.8 * s);
  DOM[s] = pow(1 + s, -0.3);
}
const LN_LO = log(0.022), INV_R = 1 / (log(1.4) - LN_LO);

// Arc diagram geometry: ticks above the baseline, arcs hanging below it.
const YB = 73;               // top edge of the arcs; the baseline fills rows 71 and 72
const ARC_ROWS = H - YB;
const TRACK = 26;            // rows the cohesin track may fill at the bottom

function load(P) {
  const { L, R, ls, rs, st, tm, rand } = P;
  let e = -1;
  for (let i = 0; i < NS; i++) if (st[i] === 0) { e = i; break; }
  if (e < 0) return;
  for (let tries = 0; tries < 8; tries++) {
    const c = 2.5 + rand() * 59;
    let ok = true;
    for (let f = 0; f < NS; f++) {
      if (st[f] !== 1) continue;
      if (abs(L[f] - c) < 2.3 || abs(R[f] - c) < 2.3) { ok = false; break; }
    }
    if (!ok) continue;
    L[e] = c - 0.5;
    R[e] = c + 0.5;
    ls[e] = 0;
    rs[e] = 0;
    st[e] = 1;
    tm[e] = 0;
    return;
  }
}

function unload(P, e) {
  P.st[e] = 2;
  P.tm[e] = 0.45;
}

// Move one leg of ring e by one step. dir is -1 for the left leg and +1 for the right.
function moveLeg(P, e, dir, h) {
  const { L, R, ls, rs, st, rand, ss } = P;
  if ((dir < 0 ? ls[e] : rs[e]) === 1) return;
  const x = dir < 0 ? L[e] : R[e];
  let nx = x + dir * V * h * (0.35 + 1.3 * rand());
  // Another ring's leg in the way: stop GAP bins short of the nearest one ahead.
  let lim = dir < 0 ? -1e9 : 1e9;
  for (let f = 0; f < NS; f++) {
    if (f === e || st[f] !== 1) continue;
    const a = L[f], b = R[f];
    if (dir < 0) {
      if (a < x && a > lim) lim = a;
      if (b < x && b > lim) lim = b;
    } else {
      if (a > x && a < lim) lim = a;
      if (b > x && b < lim) lim = b;
    }
  }
  if (dir < 0) {
    lim += GAP;
    nx = nx < lim ? (lim < x ? lim : x) : nx;
  } else {
    lim -= GAP;
    nx = nx > lim ? (lim > x ? lim : x) : nx;
  }
  // A site facing this leg on the way: it holds the leg with probability q times its strength.
  let hit = -1, best = 1e9;
  for (let k = 0; k < NSITE; k++) {
    if (SITES[k][1] !== -dir) continue;
    const pos = SITES[k][0] + 0.5;
    const d = dir < 0 ? x - pos : pos - x;
    if (d > 1e-4 && d <= abs(nx - x) + 1e-6 && d < best) {
      best = d;
      hit = k;
    }
  }
  let stuck = 0;
  if (hit >= 0 && rand() < P.q * ss[hit]) {
    nx = SITES[hit][0] + 0.5;
    stuck = 1;
  }
  if (dir < 0) {
    L[e] = nx;
    ls[e] = stuck;
  } else {
    R[e] = nx;
    rs[e] = stuck;
  }
  if (nx < 0.6 || nx > NB - 0.6) unload(P, e);
}

function addLoop(X, a, b, held) {
  const ia = floor(a), ib = floor(b);
  for (let i = ia; i <= ib; i++) {
    const ci = cl(i + 1 - a, 0, 1);
    for (let j = i + 1; j <= ib; j++) X[i * NB + j] += WM * ci * cl(b - j, 0, 1) * DOM[j - i];
  }
  for (let i = ia - 2; i <= ia + 2; i++) {
    if (i < 0 || i >= NB) continue;
    const dx = i + 0.5 - a, gx = exp(-dx * dx * INV2S);
    for (let j = ib - 2; j <= ib + 2; j++) {
      if (j < 0 || j >= NB) continue;
      const dy = j + 0.5 - b;
      X[i * NB + j] += WD * gx * exp(-dy * dy * INV2S);
    }
  }
  // One leg held and the other still sliding: the held anchor keeps touching every bin the
  // other leg has swept, a stripe from the anchor along its row or column.
  if (held === 1) {
    for (let i = ia - 1; i <= ia + 1; i++) {
      if (i < 0) continue;
      const dx = i + 0.5 - a, gx = exp(-dx * dx * INV2S);
      for (let j = ia + 2; j <= ib; j++) X[i * NB + j] += WL * gx * cl(b - j, 0, 1);
    }
  } else if (held === 2) {
    for (let j = ib - 1; j <= ib + 1; j++) {
      if (j >= NB) continue;
      const dy = j + 0.5 - b, gy = exp(-dy * dy * INV2S);
      for (let i = ia; i <= ib - 2; i++) X[i * NB + j] += WL * gy * cl(i + 1 - a, 0, 1);
    }
  }
}

function step(P, h) {
  const { st, tm, rand, ss, X, F, S } = P;
  P.simT += h;
  for (let k = 0; k < NSITE; k++) ss[k] = strength(k, P.simT);
  const pu = 1 - exp(-h / P.T);
  let alive = 0;
  for (let e = 0; e < NS; e++) {
    if (st[e] === 2) {
      tm[e] -= h;
      if (tm[e] <= 0) st[e] = 0;
    } else if (st[e] === 1) {
      tm[e] += h;
      if (rand() < pu) unload(P, e);
      else alive++;
    }
  }
  if (alive > P.n && rand() < 1 - exp(-4 * h)) {
    const s0 = floor(rand() * NS);
    for (let i = 0; i < NS; i++) {
      const e = (s0 + i) % NS;
      if (st[e] === 1) {
        unload(P, e);
        break;
      }
    }
  }
  if (alive < P.n && rand() < 1 - exp(-4 * h * (P.n - alive))) load(P);
  P.flip = !P.flip;
  for (let i = 0; i < NS; i++) {
    const e = P.flip ? i : NS - 1 - i;
    if (st[e] !== 1) continue;
    moveLeg(P, e, -1, h);
    if (st[e] === 1) moveLeg(P, e, 1, h);
  }
  // The instantaneous map of the rings that are alive, folded into the two averages.
  X.fill(0);
  for (let e = 0; e < NS; e++)
    if (st[e] === 1) addLoop(X, P.L[e], P.R[e], P.ls[e] === 1 && P.rs[e] === 0 ? 1 : P.rs[e] === 1 && P.ls[e] === 0 ? 2 : 0);
  // Where the legs are, kept for a few seconds: what a ChIP track of cohesin would show.
  const { O, Z } = P;
  Z.fill(0);
  for (let e = 0; e < NS; e++) {
    if (st[e] !== 1) continue;
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? P.L[e] : P.R[e], w = (side === 0 ? P.ls[e] : P.rs[e]) === 1 ? 1 : 0.3;
      const i0 = floor(x);
      for (let i = i0 - 2; i <= i0 + 2; i++) {
        if (i < 0 || i >= NB) continue;
        const dx = i + 0.5 - x;
        Z[i] += w * exp(-dx * dx * 0.9);
      }
    }
  }
  const ao = 1 - exp(-h / 9);
  let mx = 0;
  for (let i = 0; i < NB; i++) {
    O[i] += (Z[i] - O[i]) * ao;
    if (O[i] > mx) mx = O[i];
  }
  P.omax += (Math.max(mx, 0.5) - P.omax) * (1 - exp(-h / 20));
  const af = 1 - exp(-h / TF), as = 1 - exp(-h / TS);
  for (let i = 0; i < NN; i++) {
    const x = X[i];
    F[i] += (x - F[i]) * af;
    S[i] += (x - S[i]) * as;
  }
}

// The two colour maps. The contact map is a table of 256 colours from black through wine,
// red and orange to yellow-white; the hue knob moves every entry round the wheel.
const HEAT = [
  [0.0, 0, 0, 0], [0.1, 70, 0, 28], [0.3, 150, 4, 28], [0.5, 235, 28, 10],
  [0.68, 255, 112, 0], [0.84, 255, 200, 20], [1.0, 255, 248, 205],
];
function palettes(P, h0) {
  P.hc = h0;
  const t = new Float32Array(3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < HEAT.length - 2 && v > HEAT[k + 1][0]) k++;
    const a = HEAT[k], b = HEAT[k + 1];
    const u = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    const r = (a[1] + (b[1] - a[1]) * u) / 255, g = (a[2] + (b[2] - a[2]) * u) / 255, bl = (a[3] + (b[3] - a[3]) * u) / 255;
    // To hue, saturation and value, and back with the hue moved.
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
    let hh = 0;
    if (d > 1e-6) {
      if (mx === r) hh = ((g - bl) / d + 6) % 6;
      else if (mx === g) hh = (bl - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh /= 6;
    }
    hsv(hh + h0, mx > 0 ? d / mx : 0, mx, t, 0);
    P.heat[i * 3] = t[0];
    P.heat[i * 3 + 1] = t[1];
    P.heat[i * 3 + 2] = t[2];
  }
  // Arcs: azure when both legs are held, cyan-white while a leg slides. Ticks: gold.
  hsv(h0 + 0.58, 0.9, 1, P.cool, 0);
  hsv(h0 + 0.5, 0.45, 1, P.cool, 3);
  hsv(h0 + 0.12, 0.8, 1, P.tick, 0);
  hsv(h0 + 0.66, 0.6, 1, P.track, 0);
}

export function setup(params) {
  params.rand = rng(225225);
  params.simT = -PRE;
  params.T = 14.7;
  params.q = 0.9;
  params.n = 10;
  params.flip = false;
  params.L = new Float32Array(NS);
  params.R = new Float32Array(NS);
  params.ls = new Uint8Array(NS);
  params.rs = new Uint8Array(NS);
  params.st = new Uint8Array(NS);
  params.tm = new Float32Array(NS);
  params.ss = new Float32Array(NSITE);
  params.X = new Float32Array(NN);
  params.F = new Float32Array(NN);
  params.S = new Float32Array(NN);
  params.E = new Float32Array(NB);
  params.cum = new Float32Array(NB + 1);
  params.w = new Float32Array(NB);
  params.O = new Float32Array(NB);
  params.Z = new Float32Array(NB);
  params.omax = 0.5;
  params.heat = new Float32Array(256 * 3);
  params.cool = new Float32Array(6);
  params.tick = new Float32Array(3);
  params.track = new Float32Array(3);
  params.fr = new Float32Array(W * H * 3);
  params.ab = new Float32Array(W * (H - 64) * 3);
  params.hc = -9;
  params.acc = 0;
  params.warm = false;
  params.t = 0;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  const kp = cl(k[1], 0, 3), kq = cl(k[2], -1, 1), kn = cl(k[3], -1, 1);
  P.T = 0.9 * exp(1.4 * kp);
  P.q = kq < 0 ? 0.9 * (1 + kq) : 0.9 + 0.1 * kq;
  P.n = round(kn >= 0 ? 10 + 10 * kn : 10 + 9 * kn);
  if (abs(k[0] - P.hc) > 1e-4) palettes(P, k[0]);
  if (!P.warm) {
    // Run the chromosome forward at the knobs it was opened with, in steps of a tenth of a second.
    P.warm = true;
    for (let i = 0; i < PRE * 10; i++) step(P, 0.1);
    for (let e = 0; e < NS; e++) if (P.st[e] === 2) P.st[e] = 0;
  }
  const d = cl(dt, 0, 0.1);
  P.t += d;
  P.acc += d;
  while (P.acc >= STEP) {
    step(P, STEP);
    P.acc -= STEP;
  }
  // Insulation: the log of what each site takes from the contact across it, summed from the left.
  const w = P.w;
  w.fill(0);
  for (let q = 0; q < NSITE; q++) w[SITES[q][0]] += log(1 - BETA * cl(P.q * P.ss[q], 0, 1));
  P.cum[0] = 0;
  for (let x = 0; x < NB; x++) P.cum[x + 1] = P.cum[x] + w[x];
  // The compartments: a plaid that shifts along the chromosome a bin in a minute or so.
  const t = P.t, E = P.E;
  for (let i = 0; i < NB; i++)
    E[i] = tanh(1.5 * (0.55 * sin(i * 0.3 + 0.004 * t + 1) + 0.35 * sin(i * 0.47 - 0.0057 * t + 2.2) + 0.25 * sin(i * 0.19 + 0.0031 * t + 4)));
}

function drawMap(P, fr) {
  const { F, S, E, heat, st, L, R, tm, cum } = P;
  for (let y = 0; y < NB; y++) {
    for (let x = 0; x < NB; x++) {
      const s = x > y ? x - y : y - x;
      const lo = x < y ? x : y, hi = x < y ? y : x;
      const ins = s > 1 ? exp(cum[hi] - cum[lo + 1]) : 1;
      const a = F[y * NB + x], b = F[x * NB + y], c = S[y * NB + x], d = S[x * NB + y];
      const m = (BG[s] * ins + HAZE) * (1 + PLAID * E[x] * E[y]) + (x === y ? WF * a + WS * c : WF * (a + b) + WS * (c + d));
      const v = cl((log(m) - LN_LO) * INV_R, 0, 1);
      const ti = ((v * 255) | 0) * 3, o = (y * W + x) * 3;
      fr[o] = heat[ti];
      fr[o + 1] = heat[ti + 1];
      fr[o + 2] = heat[ti + 2];
    }
  }
  // Where each ring is right now: a cool spot at the pair its legs hold, above the diagonal.
  const { cool } = P;
  for (let e = 0; e < NS; e++) {
    if (st[e] !== 1) continue;
    const al = cl(tm[e] / 0.35, 0, 1);
    const cx = R[e], cy = L[e];
    const x0 = floor(cx), y0 = floor(cy);
    for (let j = y0 - 1; j <= y0 + 1; j++)
      for (let i = x0 - 1; i <= x0 + 1; i++) {
        if (i < 0 || i >= NB || j < 0 || j >= NB) continue;
        const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
        const w = 0.3 * al * exp(-(dx * dx + dy * dy) / 1.2);
        const o = (j * W + i) * 3;
        fr[o] += cool[3] * w;
        fr[o + 1] += cool[4] * w;
        fr[o + 2] += cool[5] * w;
      }
  }
}

// A thick line segment into the additive buffer, in LED coordinates, as distance to the segment.
function seg(buf, x0, y0, x1, y1, hw, c0, c1, c2, gain) {
  const minx = Math.max(0, floor(Math.min(x0, x1) - hw - 2)), maxx = Math.min(W - 1, ceil(Math.max(x0, x1) + hw + 2));
  const miny = Math.max(64, floor(Math.min(y0, y1) - hw - 2)), maxy = Math.min(H - 1, ceil(Math.max(y0, y1) + hw + 2));
  const ex = x1 - x0, ey = y1 - y0, l2 = ex * ex + ey * ey + 1e-9;
  for (let y = miny; y <= maxy; y++)
    for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const u = cl((px * ex + py * ey) / l2, 0, 1);
      const dx = px - u * ex, dy = py - u * ey;
      const dd = sqrt(dx * dx + dy * dy);
      const v = cl(hw + 0.5 - dd, 0, 1) + 0.18 * exp(-(dd * dd) / 3);
      const o = ((y - 64) * W + x) * 3;
      buf[o] += c0 * v * gain;
      buf[o + 1] += c1 * v * gain;
      buf[o + 2] += c2 * v * gain;
    }
}

function drawArcs(P, fr) {
  const { ab, cool, tick, track, st, L, R, ls, rs, tm, ss } = P;
  ab.fill(0);
  // Baseline, rows 71 and 72.
  for (let y = 71; y <= 72; y++)
    for (let x = 0; x < W; x++) {
      const o = ((y - 64) * W + x) * 3;
      ab[o] += cool[0] * 0.2 / 255;
      ab[o + 1] += cool[1] * 0.2 / 255;
      ab[o + 2] += cool[2] * 0.2 / 255;
    }
  // The track: where legs have been held lately, blurred over five bins and filled up from the bottom edge.
  for (let x = 0; x < W; x++) {
    let o5 = 0;
    for (let d = -2; d <= 2; d++) o5 += (3 - abs(d)) * P.O[cl(x + d, 0, NB - 1)];
    const hgt = TRACK * pow(cl(o5 / 9 / P.omax, 0, 1), 0.85);
    for (let r = 0; r < ceil(hgt); r++) {
      const y = H - 1 - r;
      const top = cl(hgt - r, 0, 1);
      const lit = top * (hgt - r < 2.2 ? 0.85 : 0.17 + 0.3 * (1 - r / TRACK));
      const o = ((y - 64) * W + x) * 3;
      ab[o] += (track[0] / 255) * lit;
      ab[o + 1] += (track[1] / 255) * lit;
      ab[o + 2] += (track[2] / 255) * lit;
    }
  }
  // The CTCF sites: a tick leaning the way the motif faces, as tall as the site's chance of stopping a leg.
  for (let k = 0; k < NSITE; k++) {
    const e = cl(P.q * ss[k], 0, 1);
    if (e < 0.04) continue;
    const x = SITES[k][0] + 0.5, f = SITES[k][1];
    seg(ab, x, 70.6, x + f * (1.1 + 0.6 * e), 70.6 - (2.2 + 3 * e), 0.6, tick[0] / 255, tick[1] / 255, tick[2] / 255, 0.28 + 0.5 * e);
  }
  // The arcs.
  for (let e = 0; e < NS; e++) {
    if (st[e] === 0) continue;
    const al = st[e] === 1 ? cl(tm[e] / 0.35, 0, 1) : tm[e] / 0.45;
    const a = L[e], b = R[e];
    const A = Math.max(0.6, (b - a) / 2), cx = (a + b) / 2;
    const B = Math.min(ARC_ROWS - 4, 1.25 * (b - a) + 1.2);
    const act = st[e] === 1 ? ((ls[e] === 0 ? 1 : 0) + (rs[e] === 0 ? 1 : 0)) / 2 : 0;
    const c0 = (cool[0] + (cool[3] - cool[0]) * act) / 255, c1 = (cool[1] + (cool[4] - cool[1]) * act) / 255, c2 = (cool[2] + (cool[5] - cool[2]) * act) / 255;
    const g = al * (0.7 + 0.3 * act);
    const xmin = Math.max(0, floor(cx - A - 3)), xmax = Math.min(W - 1, ceil(cx + A + 3));
    const ymax = Math.min(H - 1, ceil(YB + B + 3));
    const iA = 1 / (A * A), iB = 1 / (B * B);
    for (let y = YB; y <= ymax; y++) {
      const dy = y + 0.5 - YB;
      for (let x = xmin; x <= xmax; x++) {
        const dx = x + 0.5 - cx;
        const f = dx * dx * iA + dy * dy * iB - 1;
        const gx = dx * iA, gy = dy * iB;
        const dd = abs(f) / (2 * sqrt(gx * gx + gy * gy) + 1e-6);
        if (dd > 3) continue;
        const v = cl(1.25 - dd, 0, 1) + 0.14 * exp(-(dd * dd) / 3);
        const o = ((y - 64) * W + x) * 3;
        ab[o] += c0 * v * g;
        ab[o + 1] += c1 * v * g;
        ab[o + 2] += c2 * v * g;
      }
    }
    // The feet: bright where a leg is held, dim where it slides.
    for (let side = 0; side < 2; side++) {
      const held = side === 0 ? ls[e] === 1 : rs[e] === 1;
      const fx = side === 0 ? a : b;
      const w = al * (held ? 0.9 : 0.4);
      for (let y = 71; y <= 74; y++)
        for (let x = floor(fx) - 1; x <= floor(fx) + 1; x++) {
          if (x < 0 || x >= W) continue;
          const dx = x + 0.5 - fx, dy = y + 0.5 - 73;
          const v = w * exp(-(dx * dx + dy * dy) / 1.4);
          const o = ((y - 64) * W + x) * 3;
          ab[o] += cool[3] / 255 * v;
          ab[o + 1] += cool[4] / 255 * v;
          ab[o + 2] += cool[5] / 255 * v;
        }
    }
  }
  for (let y = 64; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, p = ((y - 64) * W + x) * 3;
      fr[o] = 255 * (1 - exp(-1.25 * ab[p]));
      fr[o + 1] = 255 * (1 - exp(-1.25 * ab[p + 1]));
      fr[o + 2] = 255 * (1 - exp(-1.25 * ab[p + 2]));
    }
}

export function draw(display, params) {
  const fr = params.fr;
  fr.fill(0);
  drawMap(params, fr);
  drawArcs(params, fr);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(fr[o], 0, 255) | 0, cl(fr[o + 1], 0, 255) | 0, cl(fr[o + 2], 0, 255) | 0);
    }
}
