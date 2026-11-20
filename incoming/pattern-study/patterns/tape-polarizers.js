// ===== Patternflow pattern =====
// Title:   Tape Polarizers
// Family:  polarization
// Idea:    Four strips of clear tape lie across each other on a lightbox between two polarizers, each a birefringent layer that thickens along its length, so that every strip runs through bands of interference colour on the black ground, every overlap shows a colour of its own, and the strips slide and turn while the analyzer wanders.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: interference colours of birefringent layers between crossed polarizers (Michel-Lévy chart, Auguste Michel-Lévy, 1888), Jones calculus (R. Clark Jones, 1941), the multi-lobe fit of the CIE 1931 colour matching functions (Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013), cellophane-tape art on a lightbox
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Retard=0..1, Drift=0..3, Width=24..46, Analyzer=0..1
//
// Knob 1: Retard. How thick the tape is. It adds 170 Retard nm of retardation to every strip, so the colours run on along the interference chart: at 0 the strips go from yellow through orange and magenta to blue, at 1 they have moved on to cyan, pale pink and the yellows of the next order.
// Knob 2: Drift. How fast the strips slide, turn and thicken. At 0 they stand still and only the analyzer and the thickness breathe. At the opening 2 a strip's middle moves about 2 LEDs a second, now and then 4, and its angle turns about half a degree a second; at 3 it is one and a half times that.
// Knob 3: Width. How wide the widest strip is, in LEDs, from 24 where it opens to 46 at the top. The other three are 0.88, 0.8 and 0.7 of it, so at the top they cover almost the whole panel and most points have two or three of them on top.
// Knob 4: Analyzer. Turns the second polarizer away from crossed by 75 Analyzer squared degrees, and it wanders 5 to 19 degrees either side of that. Up to about 0.15 the ground stays black and only the strips shine; at 0.3 it breathes between black and a dim grey; at 0.5 it is a grey of about 90 in 255 and the colours have paled; at 1 the polarizers are nearly parallel, the ground is a bright 220 and every colour has turned to its complement.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;

// The white light is cut into NW wavelengths, in nm.
const NW = 8;
const LAM = [420, 455, 490, 525, 560, 595, 630, 665];
// Half a retardation, pi gam / lambda, as a turn of a 2048-step circle: gam / lambda * 1024.
const TS = 2048;
const COS = new Float32Array(TS);
const SIN = new Float32Array(TS);
for (let i = 0; i < TS; i++) {
  COS[i] = Math.cos((i * 2 * Math.PI) / TS);
  SIN[i] = Math.sin((i * 2 * Math.PI) / TS);
}
const KI = LAM.map((l) => 1024 / l);

// Linear light to an 8-bit level, 1024 steps.
const ENC = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) {
  const v = i / 1024;
  ENC[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}

// Each wavelength's share of red, green and blue: the CIE 1931 matching
// functions over the band it stands for, taken to linear sRGB and scaled so
// that all the wavelengths let through at once make white.
const WT = new Float64Array(NW * 3);
{
  const g = (l, m, a, b) => Math.exp(-0.5 * Math.pow((l - m) / (l < m ? a : b), 2));
  for (let n = 0; n < NW; n++) {
    for (let j = 0; j < 10; j++) {
      const l = LAM[n] + (j - 4.5) * 3.5;
      const x = 1.056 * g(l, 599.8, 37.9, 31) + 0.362 * g(l, 442, 16, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
      const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
      const z = 1.217 * g(l, 437, 11.8, 36) + 0.681 * g(l, 459, 26, 13.8);
      WT[n * 3] += 3.2406 * x - 1.5372 * y - 0.4986 * z;
      WT[n * 3 + 1] += -0.9689 * x + 1.8758 * y + 0.0415 * z;
      WT[n * 3 + 2] += 0.0557 * x - 0.204 * y + 1.057 * z;
    }
  }
  for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let n = 0; n < NW; n++) s += WT[n * 3 + c];
    for (let n = 0; n < NW; n++) WT[n * 3 + c] /= s;
  }
}

// The strips, laid in this order. At rest, and at the start, a strip's middle
// is at (x, y) and its length runs a degrees from straight down the panel. w is
// its width as a share of the Width knob, len its length in LEDs, g its
// retardation at the middle in nm, sl how fast that grows along it in nm a LED,
// cs across it, q how that growth itself grows, and o the turn of its optical
// axis from 45 degrees.
const STRIPS = [
  { x: 26, y: 56, a: 34, w: 1, len: 220, g: 530, sl: 3.6, cs: 0.8, q: 0.01, o: -14 },
  { x: 34, y: 100, a: -62, w: 0.88, len: 210, g: 560, sl: -3.4, cs: -0.7, q: -0.009, o: 12 },
  { x: 32, y: 26, a: 66, w: 0.8, len: 190, g: 490, sl: 4.0, cs: 0.6, q: -0.011, o: -6 },
  { x: 46, y: 62, a: -32, w: 0.7, len: 170, g: 550, sl: -3.8, cs: 1.0, q: 0.01, o: 17 },
];
const NS = STRIPS.length;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// A slow wander that is zero at t = 0, so the picture opens where the table puts it.
function drift(amp, rate, t, phase) {
  return amp * (Math.sin(rate * t + phase) - Math.sin(phase));
}

export function setup(params) {
  params.tm = 0;
  params.ta = 0;
  params.cosA = 0;
  params.sinA = 1;
  params.strips = STRIPS.map(() => ({ cx: 0, cy: 0, ux: 0, uy: 1, hw: 0, hl: 0, C: 0, S: 1, g: 0, sl: 0, q: 0, cs: 0, p1: 0, p2: 0, k1: 0, k2: 0, l1: 0, l2: 0 }));
}

function place(params, width, retard) {
  const t = params.tm;
  const ta = params.ta;
  for (let k = 0; k < NS; k++) {
    const s = STRIPS[k];
    const d = params.strips[k];
    const q = k + 1;
    const alpha = (s.a + drift(7, 0.043 * Math.sqrt(q + 1), t, q) + drift(2.5, 0.071 * Math.sqrt(q + 4), t, 2 * q)) * RAD;
    d.ux = Math.sin(alpha);
    d.uy = Math.cos(alpha);
    d.cx = s.x + drift(14, 0.037 * Math.sqrt(q + 2), t, 3 * q) + drift(6, 0.083 * Math.sqrt(q + 5), t, q);
    d.cy = s.y + drift(18, 0.029 * Math.sqrt(q + 3), t, 5 * q) + drift(7, 0.067 * Math.sqrt(q + 6), t, 2 * q);
    d.hw = (s.w * width) / 2;
    d.hl = s.len / 2;
    const theta = (45 + s.o + drift(8, 0.047 * Math.sqrt(q + 3), t, 2 * q)) * RAD;
    d.C = Math.cos(2 * theta);
    d.S = Math.sin(2 * theta);
    // The thickness breathes on the analyzer's clock, so it goes on at Drift 0.
    d.g = s.g + 170 * retard + drift(45, 0.043 * Math.sqrt(q + 7), ta, 4 * q);
    d.sl = s.sl;
    d.q = s.q;
    d.cs = s.cs;
    // Two thickness waves run along and across the strip, slowly.
    d.k1 = 0.075 + 0.009 * q;
    d.l1 = (q % 2 ? 0.05 : -0.05) - 0.006 * q;
    d.p1 = 0.11 * Math.sqrt(q + 3) * t + q;
    d.k2 = 0.12 + 0.007 * q;
    d.l2 = (q % 2 ? -0.1 : 0.1) + 0.004 * q;
    d.p2 = -0.15 * Math.sqrt(q + 5) * t + 2 * q;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 24, 0.06];
  const retard = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0, 3);
  const width = clamp(k[2], 24, 46);
  const uncross = clamp(k[3], 0, 1);
  params.ta += dt;
  params.tm += dt * speed * 0.7;
  // The analyzer wanders either side of where the knob puts it, further the
  // more it is turned, so the ground stays black while the polarizers are crossed.
  const ta = params.ta;
  const wander = (5 + 14 * uncross * uncross) * (0.62 * Math.sin(0.057 * ta + 1.1) + 0.38 * Math.sin(0.0913 * ta + 2.3));
  const psi = (75 * uncross * uncross + wander) * RAD;
  params.cosA = Math.sin(psi);
  params.sinA = Math.cos(psi);
  place(params, width, retard);
}

// What one pixel sees: the strips that cover any of it, in order, with the
// share of the pixel each covers and its retardation there; and the Jones
// vector of every wavelength (two complex numbers) at each depth of the walk.
const PS = new Int32Array(NS);
const PC = new Float64Array(NS);
const PG = new Float64Array(NS);
const ST = new Float64Array((NS + 2) * NW * 4);
const ACC = new Float64Array(3);
let CA = 0;
let SA = 1;
let M = 0;
let STR = null;

// A strip of retardation gam and axis (C, S) = (cos 2 theta, sin 2 theta) acts
// on a Jones vector as cos(d/2) I - i sin(d/2) [[C, S], [S, -C]], d = 2 pi gam / lambda.
function lay(o, C, S, gam) {
  for (let n = 0; n < NW; n++, o += 4) {
    const idx = ((gam * KI[n]) | 0) & (TS - 1);
    const ce = COS[idx];
    const se = SIN[idx];
    const ar = ST[o];
    const ai = ST[o + 1];
    const br = ST[o + 2];
    const bi = ST[o + 3];
    ST[o] = ce * ar + se * (C * ai + S * bi);
    ST[o + 1] = ce * ai - se * (C * ar + S * br);
    ST[o + 2] = ce * br + se * (S * ai - C * bi);
    ST[o + 3] = ce * bi - se * (S * ar - C * br);
  }
}

// What the analyzer lets through of the vector at depth d, as red, green and
// blue, added in with weight w.
function leaf(d, w) {
  let o = d * NW * 4;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let n = 0; n < NW; n++, o += 4) {
    const er = CA * ST[o] + SA * ST[o + 2];
    const ei = CA * ST[o + 1] + SA * ST[o + 3];
    const t = er * er + ei * ei;
    r += WT[n * 3] * t;
    g += WT[n * 3 + 1] * t;
    b += WT[n * 3 + 2] * t;
  }
  ACC[0] += w * r;
  ACC[1] += w * g;
  ACC[2] += w * b;
}

// Lays the strips from j on over the vector at depth d. A strip that covers
// the whole pixel goes on; one that covers part of it splits the walk in two,
// with it and without, and the two lit pixels are weighed by the share
// covered. An edge then blends two intensities, never two amplitudes, which
// would leave a dark line wherever the two are in antiphase.
function walk(j, d, w) {
  const base = d * NW * 4;
  while (j < M && PC[j] >= 0.996) {
    const s = STR[PS[j]];
    lay(base, s.C, s.S, PG[j]);
    j++;
  }
  if (j >= M) {
    leaf(d, w);
    return;
  }
  const c = PC[j];
  const s = STR[PS[j]];
  ST.copyWithin((d + 1) * NW * 4, base, base + NW * 4);
  walk(j + 1, d + 1, w * (1 - c));
  lay(base, s.C, s.S, PG[j]);
  walk(j + 1, d, w * c);
}

const GAIN = 1.05;
const BLACK = 0.01;

export function draw(display, params) {
  STR = params.strips;
  CA = params.cosA;
  SA = params.sinA;
  // The brighter the ground, the less the strips are turned up.
  const gain = GAIN - 0.3 * CA * CA;
  const ground = ENC[(clamp((CA * CA * gain - BLACK) / (1 - BLACK), 0, 1) * 1024) | 0];
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      M = 0;
      for (let k = 0; k < NS; k++) {
        const s = STR[k];
        const dx = px - s.cx;
        const dy = py - s.cy;
        const u = dx * s.ux + dy * s.uy;
        const v = dy * s.ux - dx * s.uy;
        // The share of the pixel under the strip: a ramp 1.6 LEDs wide at each edge, then smoothed.
        const cv = (s.hw - Math.abs(v) + 0.8) / 1.6;
        if (cv <= 0) continue;
        const cu = (s.hl - Math.abs(u) + 0.8) / 1.6;
        if (cu <= 0) continue;
        let cov = (cv > 1 ? 1 : cv) * (cu > 1 ? 1 : cu);
        cov = cov * cov * (3 - 2 * cov);
        if (cov < 0.004) continue;
        PS[M] = k;
        PC[M] = cov;
        PG[M] = s.g + (s.sl + s.q * u) * u + s.cs * v + 40 * Math.sin(s.k1 * u + s.l1 * v + s.p1) + 22 * Math.sin(s.k2 * u + s.l2 * v + s.p2);
        M++;
      }
      if (M === 0) {
        display.setPixel(x, y, ground, ground, ground);
        continue;
      }
      for (let i = 0; i < NW * 4; i += 4) {
        ST[i] = 1;
        ST[i + 1] = 0;
        ST[i + 2] = 0;
        ST[i + 3] = 0;
      }
      ACC[0] = 0;
      ACC[1] = 0;
      ACC[2] = 0;
      walk(0, 0, 1);
      const r = clamp((ACC[0] * gain - BLACK) / (1 - BLACK), 0, 1);
      const g = clamp((ACC[1] * gain - BLACK) / (1 - BLACK), 0, 1);
      const b = clamp((ACC[2] * gain - BLACK) / (1 - BLACK), 0, 1);
      display.setPixel(x, y, ENC[(r * 1024) | 0], ENC[(g * 1024) | 0], ENC[(b * 1024) | 0]);
    }
  }
}
