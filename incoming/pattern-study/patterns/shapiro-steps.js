// ===== Patternflow pattern =====
// Title:   Shapiro Steps
// Family:  josephson
// Idea:    A Josephson junction driven by a microwave current has an average voltage that locks onto plateaus at whole multiples of the drive frequency, so the panel draws the map of that locking with the bias current up the panel and time scrolling left, and as the drive amplitude wanders the plateaus swell and pinch off one after another at the zeros of the Bessel functions, like a string of beads.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sidney Shapiro, steps in the current-voltage curve of a junction under microwaves, 1963 (from memory); Brian Josephson, the tunnelling supercurrent, 1962; the resistively shunted junction model (Stewart and McCumber, 1968, from memory); pattern round 273
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.6..3, Amplitude=-1..1, Scroll=-1..1
//
// Knob 1: Hue. x.
// Knob 2: Drive. x.
// Knob 3: Amplitude. x.
// Knob 4: Scroll. x.
//
// x.

const W = 64, H = 128, NR = 64, NCOL = 68;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const IMAX = 6.0;                 // bias current at the top and bottom edge, in units of the critical current
const DI = IMAX / NR;             // current per row
const BURN = 4, MEAS = 6;         // drive periods integrated before and while averaging

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- the model
export function setup(params) {
  params.s = {
    t: 0, acc: 0, head: -1, k: null,
    col: new Float32Array(NCOL * H * 3),
    phi: new Float32Array(NCOL * NR),
    ct: new Float32Array(NCOL), cOm: new Float32Array(NCOL), cA0: new Float32Array(NCOL),
    rho: new Float32Array(NR),
    drv: new Float32Array(4096),
  };
}

// the wander of the drive amplitude, between -1 and 1: sines whose periods do not divide each other
function wander(t) {
  return 0.40 * sin(TAU * t / 17.3 + 1.1) + 0.27 * sin(TAU * t / 29.1 + 2.3) + 0.19 * sin(TAU * t / 11.9 + 0.4) + 0.14 * sin(TAU * t / 47.7 + 4.0);
}
const a0Of = (k) => 3.8 + 2.4 * cl(k, -1, 1);
const ampOf = (a0) => min(1.9, a0 - 0.7);
const omOf = (om, t) => om * (1 + 0.035 * sin(TAU * t / 37.3 + 0.7));

// one column: the rotation number of the junction for each bias row
function integrate(S, slot, om, a, nburn) {
  const T = TAU / om, spp = max(20, ceil(T / 0.12)), dt = T / spp, hd = 0.5 * dt, drv = S.drv;
  const n2 = 2 * spp;
  for (let i = 0; i <= n2; i++) drv[i] = a * cos(om * i * hd);
  const phi = S.phi, base = slot * NR;
  for (let k = 0; k < NR; k++) {
    const I = (k + 0.5) * DI;
    let p = phi[base + k], p0 = 0;
    const tot = (nburn + MEAS) * spp, st = nburn * spp;
    for (let n = 0; n < tot; n++) {
      if (n === st) p0 = p;
      const j = (n % spp) * 2;
      const pm = p + hd * (I + drv[j] - sin(p));
      p += dt * (I + drv[j + 1] - sin(pm));
    }
    S.rho[k] = (p - p0) / (TAU * MEAS);
    phi[base + k] = p - TAU * round((p) / TAU);
  }
}

const NEU = [0, 0, 0], BC = [0, 0, 0];
const RR = new Float32Array(NR), RG = new Float32Array(NR), RB = new Float32Array(NR), TR = new Float32Array(NR), TG = new Float32Array(NR), TB = new Float32Array(NR);

function paint(S, slot, h0) {
  const rho = S.rho;
  for (let k = 0; k < NR; k++) {
    const r = rho[k], n = round(r), d = abs(r - n);
    hsv(h0 + 0.62, 0.35, 0.05 + 0.1 * k / NR, NEU);
    let w = 1 - sm(0.02, 0.08, d), hue = h0 + 0.11 * n, sat = 0.85, val = 0.95;
    if (w < 0.01) {
      // the fractional steps, halves and thirds
      const m2 = round(r * 2), d2 = abs(r - m2 / 2), m3 = round(r * 3), d3 = abs(r - m3 / 3);
      if (m2 % 2 !== 0 && d2 < 0.06) {
        w = 1 - sm(0.015, 0.05, d2);
        hue = h0 + 0.11 * (m2 / 2) + 0.5;
        sat = 0.6;
        val = 0.8;
      } else if (m3 % 3 !== 0 && d3 < 0.06) {
        w = 1 - sm(0.015, 0.05, d3);
        hue = h0 + 0.11 * (m3 / 3) + 0.5;
        sat = 0.6;
        val = 0.7;
      }
    }
    hsv(hue, sat, val, BC);
    RR[k] = NEU[0] + (BC[0] - NEU[0]) * w;
    RG[k] = NEU[1] + (BC[1] - NEU[1]) * w;
    RB[k] = NEU[2] + (BC[2] - NEU[2]) * w;
  }
  // soft edges: one pass of 1 2 1 along the current, reflected at the middle row
  for (let k = 0; k < NR; k++) {
    const a = k > 0 ? k - 1 : 0, b = k < NR - 1 ? k + 1 : k;
    TR[k] = 0.25 * RR[a] + 0.5 * RR[k] + 0.25 * RR[b];
    TG[k] = 0.25 * RG[a] + 0.5 * RG[k] + 0.25 * RG[b];
    TB[k] = 0.25 * RB[a] + 0.5 * RB[k] + 0.25 * RB[b];
  }
  const col = S.col, o = slot * H * 3;
  for (let k = 0; k < NR; k++) {
    const u = o + (NR + k) * 3, v = o + (NR - 1 - k) * 3;
    col[u] = col[v] = TR[k];
    col[u + 1] = col[v + 1] = TG[k];
    col[u + 2] = col[v + 2] = TB[k];
  }
}

function compute(S, slot, t, nburn) {
  const a0 = a0Of(S.k[2]), a = max(0.3, a0 + ampOf(a0) * wander(t)), om = omOf(S.k[1], t);
  integrate(S, slot, om, a, nburn);
  paint(S, slot, S.k[0] + 0.02);
  S.ct[slot] = t;
  S.cOm[slot] = S.k[1];
  S.cA0[slot] = S.k[2];
}

const speedOf = (k) => 4.5 * exp(0.85 * cl(k, -1, 1));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    const sp = speedOf(S.k[3]);
    for (let i = 0; i < NCOL; i++) {
      S.head = i;
      compute(S, i, (i - (NCOL - 1)) / sp, i === 0 ? 12 : BURN);
    }
    return;
  }
  const al = 1 - exp(-d / 0.12);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const sp = speedOf(S.k[3]);
  S.t += d;
  S.acc += d * sp;
  while (S.acc >= 1) {
    S.acc -= 1;
    S.head = (S.head + 1) % NCOL;
    compute(S, S.head, S.t - S.acc / sp, BURN);
  }
}

// ------------------------------------------------------------------ drawing
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const f = S.acc, col = S.col;
  for (let x = 0; x < W; x++) {
    // the column position of this pixel: the right edge shows the interval before the newest column
    const c = x - (W - 1) - 1 + f, c0 = floor(c), fr = c - c0;
    const i0 = (((S.head + c0) % NCOL) + NCOL) % NCOL, i1 = (i0 + 1) % NCOL;
    const o0 = i0 * H * 3, o1 = i1 * H * 3;
    for (let y = 0; y < H; y++) {
      const p = y * 3;
      const r = col[o0 + p] + (col[o1 + p] - col[o0 + p]) * fr;
      const g = col[o0 + p + 1] + (col[o1 + p + 1] - col[o0 + p + 1]) * fr;
      const b = col[o0 + p + 2] + (col[o1 + p + 2] - col[o0 + p + 2]) * fr;
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (b * 255) | 0));
    }
  }
}
