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

const W = 64, H = 128, NR = 64, NS = 2 * NR, NCOL = 66;
const { floor, ceil, exp, sin, cos, min, max, abs, round, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const IMAX = 6.4;                 // bias current at the top and bottom edge, in units of the critical current
const DS = IMAX / NS;             // current between two integrated rows: two of them to a row of LEDs
const BURN = 4, MEAS = 6;         // drive periods integrated before the average, and in each of its two halves
const H0 = 0.1;                  // hue of the zero step when the Hue knob is at 0
const DH = -0.075;                // hue step from one plateau to the next

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
    col: new Float32Array(NCOL * H * 3),                    // the picture of each column, ready to draw
    phi: new Float32Array(NCOL * NS),                       // the phase each row of each column ended on
    cr: new Float32Array(NCOL * NS), cd: new Float32Array(NCOL * NS),
    ct: new Float32Array(NCOL), cOm: new Float32Array(NCOL), cB0: new Float32Array(NCOL), cH: new Float32Array(NCOL),
    drv: new Float32Array(256),
    o0: new Int32Array(3), o1: new Int32Array(3), fr: new Float32Array(3), fw: new Float32Array(3),
  };
}

// the swing b of the drive, as a number between -1 and 1 about its centre: sines whose periods do not divide each other
function wander(t) {
  return 0.36 * sin(TAU * t / 14 + 3.08) + 0.22 * sin(TAU * t / 23.5 + 2.34) + 0.13 * sin(TAU * t / 9.6 + 6.22) + 0.1 * sin(TAU * t / 38 + 2.15) + 0.1 * sin(TAU * t / 61.7 + 1.08) + 0.09 * sin(TAU * t / 6.1 + 5.44);
}
// the centre of the swing, the drive frequency and the hue each drift on sines of their own, slower still
const b0Of = (k, t) => 3.9 + 2.3 * cl(k, -1, 1) + 0.7 * sin(TAU * t / 97 + 0.27) + 0.4 * sin(TAU * t / 151 + 1.06);
const ampOf = (b0, t) => min(2.4, b0 - 0.7) * (0.85 + 0.15 * sin(TAU * t / 53 + 2.53));
const omOf = (om, t) => om * (1 + 0.08 * sin(TAU * t / 37.3 + 0.7) + 0.05 * sin(TAU * t / 83 + 2.9));
const hueOf = (h, t) => h + H0 + t / 330 + 0.05 * sin(TAU * t / 71 + 3.4) + 0.04 * sin(TAU * t / 43 + 1.1);
const speedOf = (k) => 4.2 * exp(0.6 * cl(k, -1, 1));   // columns a second

// one column: the overdamped junction, d phi / dt = I + a cos(Omega t) - sin(phi), for every bias row
function integrate(S, slot, om, a, ds, nburn) {
  const T = TAU / om, spp = max(14, ceil(T / 0.25)), dt = T / spp, hd = 0.5 * dt, drv = S.drv;
  for (let i = 0; i <= 2 * spp; i++) drv[i] = a * cos(om * i * hd);
  const base = slot * NS, tot = (nburn + 2 * MEAS) * spp, st = nburn * spp, mid = (nburn + MEAS) * spp;
  for (let k = 0; k < NS; k++) {
    const I = (k + 0.5) * ds;
    let p = S.phi[base + k], p0 = 0, p1 = 0;
    for (let n = 0; n < tot; n++) {
      if (n === st) p0 = p;
      else if (n === mid) p1 = p;
      const j = (n % spp) * 2;
      const pm = p + hd * (I + drv[j] - sin(p));
      p += dt * (I + drv[j + 1] - sin(pm));
    }
    S.cr[base + k] = (p - p0) / (TAU * 2 * MEAS);                  // the rotation number V / Omega
    S.cd[base + k] = ((p - p1) - (p1 - p0)) / (TAU * 2 * MEAS);    // how far the two halves disagree: 0 on a plateau
    S.phi[base + k] = p - TAU * round(p / TAU);
  }
}

const NEU = [0, 0, 0], BC = [0, 0, 0];
const WS = new Float32Array(NS), SH = new Float32Array(NS), MS = new Int16Array(NS);
const SR = new Float32Array(NS), SG = new Float32Array(NS), SB = new Float32Array(NS);
const BR = new Float32Array(NR), BG = new Float32Array(NR), BB = new Float32Array(NR);
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
  const o0 = slot * NS;
  for (let s = 0; s < NS; s++) {
    const r = S.cr[o0 + s], n = round(r), d = abs(r - n), dd = abs(S.cd[o0 + s]);
    WS[s] = (1 - sm(0.02, 0.08, d)) * (1 - sm(0.006, 0.03, dd));
    MS[s] = n;
    SH[s] = 1;
  }
  // a plateau thinner than about two LEDs fades out, so a pinch ends in a soft point and not in dots;
  // the plateau of rotation number 0 on the middle row goes on through the mirror and is not thin
  for (let s = 0; s < NS; s++) {
    if (WS[s] <= 0.1) continue;
    let e = s, sum = WS[s];
    while (e + 1 < NS && MS[e + 1] === MS[s] && WS[e + 1] > 0.1) sum += WS[++e];
    const rows = sum / 2, mid = s === 0 && MS[0] === 0;
    const g = mid ? 1 : sm(1.0, 2.6, rows);
    for (let q = s; q <= e; q++) {
      WS[q] *= g;
      // darker toward its two edges, like a bead
      const dist = 0.5 * min(s === 0 ? 99 : q - s + 0.5, e === NS - 1 ? 99 : e - q + 0.5);
      SH[q] = 0.55 + 0.45 * sm(0, 1, dist / min(2.6, 0.5 * rows + 0.01));
    }
    s = e;
  }
  for (let s = 0; s < NS; s++) {
    hsv(h0 + DH * MS[s], 0.88, 1, BC);
    const w = WS[s] * SH[s];
    SR[s] = BC[0] * w;
    SG[s] = BC[1] * w;
    SB[s] = BC[2] * w;
  }
  for (let k = 0; k < NR; k++) {
    BR[k] = 0.5 * (SR[2 * k] + SR[2 * k + 1]);
    BG[k] = 0.5 * (SG[2 * k] + SG[2 * k + 1]);
    BB[k] = 0.5 * (SB[2 * k] + SB[2 * k + 1]);
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
    hsv(h0 + 0.62, 0.45, 0.07 + 0.2 * pow(k / NR, 0.8), NEU);
    const r = min(1, NEU[0] + 0.92 * er + 0.5 * pow(hr, 0.72)), g = min(1, NEU[1] + 0.92 * eg + 0.5 * pow(hg, 0.72)), b = min(1, NEU[2] + 0.92 * eb + 0.5 * pow(hb, 0.72));
    const u = o + (NR + k) * 3, v = o + (NR - 1 - k) * 3;
    col[u] = col[v] = r;
    col[u + 1] = col[v + 1] = g;
    col[u + 2] = col[v + 2] = b;
  }
}

function compute(S, slot, t, nburn) {
  const b0 = b0Of(S.k[2], t), b = max(0.4, b0 + ampOf(b0, t) * wander(t)), om = omOf(S.k[1], t);
  integrate(S, slot, om, b * om, DS * (1 + 0.07 * sin(TAU * t / 59 + 1.2) + 0.04 * sin(TAU * t / 101 + 4.4)), nburn);
  paint(S, slot, hueOf(S.k[0], t));
  S.ct[slot] = t;
  S.cOm[slot] = S.k[1];
  S.cB0[slot] = S.k[2];
  S.cH[slot] = S.k[0];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    // the whole history, oldest column first, each one starting from the phases the one before ended on
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    const sp = speedOf(S.k[3]);
    for (let i = 0; i < NCOL; i++) {
      S.head = i;
      if (i > 0) S.phi.copyWithin(i * NS, (i - 1) * NS, i * NS);
      compute(S, i, (i - (NCOL - 1)) / sp, i === 0 ? 12 : BURN);
    }
    return;
  }
  const al = 1 - exp(-d / 0.12);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const sp = speedOf(S.k[3]);
  S.t += d;
  S.acc += d * sp;
  let made = 0;
  while (S.acc >= 1) {
    S.acc -= 1;
    made++;
    const prev = S.head;
    S.head = (S.head + 1) % NCOL;
    S.phi.copyWithin(S.head * NS, prev * NS, prev * NS + NS);
    compute(S, S.head, S.t - S.acc / sp, BURN);
  }
  // columns made under other knobs are worked out again, the newest first; a new hue only repaints
  let left = S.k[1] > 1.6 ? 2 - min(made, 1) : 1 - min(made, 1), paints = 16;
  for (let j = 0; j < NCOL - 1; j++) {
    const i = (S.head - j + NCOL) % NCOL;
    if (left > 0 && (abs(S.cOm[i] - S.k[1]) > 0.01 || abs(S.cB0[i] - S.k[2]) > 0.02)) {
      compute(S, i, S.ct[i], BURN);
      left--;
    } else if (paints > 0 && abs(S.cH[i] - S.k[0]) > 0.004) {
      paint(S, i, hueOf(S.k[0], S.ct[i]));
      S.cH[i] = S.k[0];
      paints--;
    }
  }
}

// ------------------------------------------------------------------ drawing
const TAPS = [-0.9, 0, 0.9], TW = [0.25, 0.5, 0.25];
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const f = S.acc, col = S.col, HH = H * 3;
  for (let x = 0; x < W; x++) {
    // the column position of this pixel: the right edge shows the interval before the newest column;
    // three taps 0.9 of a column apart average out a plateau's edge that moves by a row from one column to the next
    let r = 0, g = 0, b = 0;
    for (let t = 0; t < 3; t++) {
      const c = min(0, x - (W - 1) - 1 + f + TAPS[t]), c0 = floor(c), fr = c - c0, w = TW[t];
      const i0 = (((S.head + c0) % NCOL) + NCOL) % NCOL, i1 = (i0 + 1) % NCOL;
      S.o0[t] = i0 * HH;
      S.o1[t] = i1 * HH;
      S.fr[t] = fr * w;
      S.fw[t] = w - fr * w;
    }
    for (let y = 0; y < H; y++) {
      const p = y * 3;
      r = g = b = 0;
      for (let t = 0; t < 3; t++) {
        const a0 = S.o0[t] + p, a1 = S.o1[t] + p, u = S.fw[t], v = S.fr[t];
        r += col[a0] * u + col[a1] * v;
        g += col[a0 + 1] * u + col[a1 + 1] * v;
        b += col[a0 + 2] * u + col[a1 + 2] * v;
      }
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (b * 255) | 0));
    }
  }
}
