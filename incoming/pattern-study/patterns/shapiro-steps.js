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
const { floor, ceil, exp, sin, cos, min, max, abs, round, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const IMAX = 6.4;                 // bias current at the top and bottom edge, in units of the critical current
const DI = IMAX / NR;             // current per row
const BURN = 4, MEAS = 6;
const H0 = 0.13;                  // hue of the zero step when the Hue knob is at 0
const DH = -0.075;                  // hue step between one plateau and the next         // drive periods integrated before and while averaging

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
    ct: new Float32Array(NCOL), cOm: new Float32Array(NCOL), cB0: new Float32Array(NCOL), cH: new Float32Array(NCOL),
    rho: new Float32Array(NR), dro: new Float32Array(NR), cr: new Float32Array(NCOL * NR), cd: new Float32Array(NCOL * NR),
    drv: new Float32Array(4096),
  };
}

// the wander of the drive amplitude, between -1 and 1: sines whose periods do not divide each other
function wander(t) {
  return 0.5 * sin(TAU * t / 17.3 + 2.65) + 0.28 * sin(TAU * t / 29.1 + 1.36) + 0.14 * sin(TAU * t / 11.9 + 0.56) + 0.08 * sin(TAU * t / 47.7 + 1.06);
}
const b0Of = (k) => 3.9 + 2.3 * cl(k, -1, 1);
const ampOf = (b0) => min(2.4, b0 - 0.7);
const omOf = (om, t) => om * (1 + 0.035 * sin(TAU * t / 37.3 + 0.7));

// one column: the rotation number of the junction for each bias row
function integrate(S, slot, om, a, nburn) {
  const T = TAU / om, spp = max(20, ceil(T / 0.12)), dt = T / spp, hd = 0.5 * dt, drv = S.drv;
  const n2 = 2 * spp;
  for (let i = 0; i <= n2; i++) drv[i] = a * cos(om * i * hd);
  const phi = S.phi, base = slot * NR;
  for (let k = 0; k < NR; k++) {
    const I = (k + 0.5) * DI;
    let p = phi[base + k], p0 = 0, p1 = 0;
    const tot = (nburn + 2 * MEAS) * spp, st = nburn * spp, mid = (nburn + MEAS) * spp;
    for (let n = 0; n < tot; n++) {
      if (n === st) p0 = p;
      else if (n === mid) p1 = p;
      const j = (n % spp) * 2;
      const pm = p + hd * (I + drv[j] - sin(p));
      p += dt * (I + drv[j + 1] - sin(pm));
    }
    S.cr[base + k] = (p - p0) / (TAU * 2 * MEAS);
    S.cd[base + k] = ((p - p1) - (p1 - p0)) / (TAU * 2 * MEAS);
    phi[base + k] = p - TAU * round((p) / TAU);
  }
}

const NEU = [0, 0, 0], BC = [0, 0, 0];
const BR = new Float32Array(NR), BG = new Float32Array(NR), BB = new Float32Array(NR);
const WT = new Float32Array(NR), MM = new Int16Array(NR);
// a Gaussian of 3.4 rows for the halo, a narrow one of 0.85 for the edge of a band
const HK = 9, GH = new Float32Array(2 * HK + 1), GE = new Float32Array(5);
{
  let a = 0, b = 0;
  for (let i = -HK; i <= HK; i++) a += (GH[i + HK] = exp(-(i * i) / (2 * 3.4 * 3.4)));
  for (let i = 0; i < GH.length; i++) GH[i] /= a;
  for (let i = -2; i <= 2; i++) b += (GE[i + 2] = exp(-(i * i) / (2 * 0.85 * 0.85)));
  for (let i = 0; i < 5; i++) GE[i] /= b;
}

function paint(S, slot, h0) {
  const rho = S.rho, dro = S.dro, o0 = slot * NR;
  for (let k = 0; k < NR; k++) {
    rho[k] = S.cr[o0 + k];
    dro[k] = S.cd[o0 + k];
  }
  for (let k = 0; k < NR; k++) {
    const r = rho[k], n = round(r), d = abs(r - n), dd = abs(dro[k]);
    WT[k] = (1 - sm(0.02, 0.08, d)) * (1 - sm(0.006, 0.03, dd));
    MM[k] = n;
  }
  // each plateau is shaded like a bead, darker toward its two edges, so that plateaus that touch stay apart
  for (let k = 0; k < NR; k++) {
    let sh = 1;
    if (WT[k] > 0.5) {
      let a = k, e = k;
      while (a > 0 && MM[a - 1] === MM[k] && WT[a - 1] > 0.5) a--;
      while (e < NR - 1 && MM[e + 1] === MM[k] && WT[e + 1] > 0.5) e++;
      const len = e - a + 1, dist = min(a === 0 ? 99 : k - a + 0.5, e === NR - 1 ? 99 : e - k + 0.5);
      sh = 0.55 + 0.45 * sm(0, 1, dist / min(2.6, 0.5 * len + 0.01));
    }
    hsv(h0 + DH * MM[k], 0.88, 1, BC);
    BR[k] = BC[0] * WT[k] * sh;
    BG[k] = BC[1] * WT[k] * sh;
    BB[k] = BC[2] * WT[k] * sh;
  }
  const col = S.col, o = slot * H * 3;
  for (let k = 0; k < NR; k++) {
    let er = 0, eg = 0, eb = 0, hr = 0, hg = 0, hb = 0;
    for (let j = -2; j <= 2; j++) {
      let q = k + j;
      q = q < 0 ? -q - 1 : q >= NR ? NR - 1 : q;
      const g = GE[j + 2];
      er += g * BR[q];
      eg += g * BG[q];
      eb += g * BB[q];
    }
    for (let j = -HK; j <= HK; j++) {
      let q = k + j;
      q = q < 0 ? -q - 1 : q >= NR ? NR - 1 : q;
      const g = GH[j + HK];
      hr += g * BR[q];
      hg += g * BG[q];
      hb += g * BB[q];
    }
    hsv(h0 + 0.62, 0.4, 0.04 + 0.07 * k / NR, NEU);
    const r = min(1, NEU[0] + 0.92 * er + 0.62 * pow(hr, 0.72)), g = min(1, NEU[1] + 0.92 * eg + 0.62 * pow(hg, 0.72)), b = min(1, NEU[2] + 0.92 * eb + 0.62 * pow(hb, 0.72));
    const u = o + (NR + k) * 3, v = o + (NR - 1 - k) * 3;
    col[u] = col[v] = r;
    col[u + 1] = col[v + 1] = g;
    col[u + 2] = col[v + 2] = b;
  }
}

function compute(S, slot, t, nburn) {
  const b0 = b0Of(S.k[2]), b = max(0.4, b0 + ampOf(b0) * wander(t)), om = omOf(S.k[1], t);
  integrate(S, slot, om, b * om, nburn);
  paint(S, slot, S.k[0] + H0);
  S.ct[slot] = t;
  S.cOm[slot] = S.k[1];
  S.cB0[slot] = S.k[2];
  S.cH[slot] = S.k[0];
}

const speedOf = (k) => 4.5 * exp(0.85 * cl(k, -1, 1));   // columns a second

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    const sp = speedOf(S.k[3]);
    for (let i = 0; i < NCOL; i++) {
      S.head = i;
      if (i > 0) S.phi.copyWithin(i * NR, (i - 1) * NR, i * NR);
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
    const prev = S.head;
    S.head = (S.head + 1) % NCOL;
    S.phi.copyWithin(S.head * NR, prev * NR, prev * NR + NR);
    compute(S, S.head, S.t - S.acc / sp, BURN);
  }
  // columns made under other knobs are worked out again, the newest first, two a frame; a new hue only repaints
  let left = 2, paints = 16;
  for (let j = 0; j < NCOL - 1; j++) {
    const i = (S.head - j + NCOL) % NCOL;
    if (left > 0 && (abs(S.cOm[i] - S.k[1]) > 0.01 || abs(S.cB0[i] - S.k[2]) > 0.02)) {
      compute(S, i, S.ct[i], BURN);
      left--;
    } else if (paints > 0 && abs(S.cH[i] - S.k[0]) > 0.004) {
      paint(S, i, S.k[0] + H0);
      S.cH[i] = S.k[0];
      paints--;
    }
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
