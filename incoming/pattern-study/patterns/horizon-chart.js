// ===== Patternflow pattern =====
// Title:   Horizon Chart
// Family:  horizonchart
// Idea:    Eight strips of data stream sideways down the panel, each one a signed time series cut into bands and folded over itself, amber climbing from the floor of its strip and cyan hanging from the ceiling, every fold brighter than the one under it, so a strip fifteen LEDs tall holds several heights at once and the strips swell and fall together or apart.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the horizon graph, two-tone pseudo colouring by Takafumi Saito and colleagues (2005, from memory), in the folded band form Jeffrey Heer, Nicholas Kong and Maneesh Agrawala measured (2009, from memory), eight series stacked as small multiples, each a mean-reverting drift under regime shifts and bursts with a shared factor beneath; pattern round 232
// Round:   232
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stream=0..4, Folds=-1..1, Coupling=-1..1
//
// Knob 1: Hue. Turns the amber and cyan pair once round the colour wheel, back where it began at 1.
// Knob 2: Stream. How fast the strips run sideways, 3 LED a second at 0 and 24 at 4.
// Knob 3: Folds. How many bands the range is cut into, 1.5 at -1, 3 at 0 and 4.5 at 1; between whole numbers the last band grows in smoothly.
// Knob 4: Coupling. How much the eight strips share one underlying factor, none at -1 so each wanders alone, nearly all at 1 so they swell and fall together.

const W = 64;
const NSTRIP = 8;
const SH = 15; // rows of colour in a strip, with one dark row under it
const PITCH = 16;
const SP = 2.5; // LED between two samples of a series
const NS = 29; // samples held: 72 LED, the panel and a little past the right edge
const NCH = NSTRIP + 1; // the eight series and the shared factor
const SUB = [0.17, 0.5, 0.83]; // three looks across each column, so a slope is anti-aliased
const { floor, sqrt, exp, abs, min, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (x) => x - floor(x);

// ---- the series: regime level, drift, bursts, wandering volatility
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

function makeChan(j) {
  const shared = j === NSTRIP;
  const tauO = 4.5 + 5 * fr(j * 0.381 + 0.2); // samples
  const tauV = 55 + 75 * fr(j * 0.4142 + 0.3);
  const rv = exp(-1 / tauV);
  return {
    ps: 1 / ((shared ? 9 : 15) + (shared ? 8 : 14) * fr(j * 0.618 + 0.1)), // a regime shift every so many samples
    pb: 1 / (40 + 36 * fr(j * 0.7071 + 0.45)), // a burst every so many samples
    ro: exp(-1 / tauO),
    rv,
    sv: 0.18 * sqrt(1 - rv * rv),
    mu: (Math.random() < 0.5 ? -1 : 1) * 0.9,
    tgt: (Math.random() < 0.5 ? -1 : 1) * 0.9,
    ou: gauss(),
    bu: 0,
    lv: 0.18 * gauss(),
  };
}

function stepChan(c) {
  if (Math.random() < c.ps) c.tgt = (Math.random() < 0.7 ? -Math.sign(c.tgt) : Math.sign(c.tgt)) * (0.65 + 0.5 * Math.random());
  c.mu += 0.13 * (c.tgt - c.mu);
  c.ou = c.ro * c.ou + sqrt(1 - c.ro * c.ro) * gauss();
  c.bu *= 0.84;
  if (Math.random() < c.pb) c.bu += (Math.random() < 0.5 ? -1 : 1) * (0.9 + 0.9 * Math.random());
  c.lv = c.rv * c.lv + c.sv * gauss();
  return exp(c.lv) * (c.mu + 0.7 * c.ou + c.bu);
}

export function setup(P) {
  P.ch = [];
  P.buf = [];
  for (let j = 0; j < NCH; j++) {
    const c = makeChan(j);
    for (let k = 0; k < 400; k++) stepChan(c);
    const b = new Float32Array(NS);
    for (let k = 0; k < NS; k++) b[k] = stepChan(c);
    P.ch.push(c);
    P.buf.push(b);
  }
  P.a = 0; // how far the strips have slid since the last sample came in, LED
  P.k = [0, 2, 0, 0.06];
  P.v = new Float32Array(NCH * W * SUB.length); // each series at every look
  P.col = [0, 0, 0, 0, 0, 0].map(() => [[0, 0, 0], [0, 0, 0]]);
  P.acc = new Float32Array(SH * 3);
  P.mean = new Float32Array(W * SUB.length);
}

export function update(dt, input, P) {
  if (!P.buf) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) P.k[i] = k[i];
  const d = cl(dt || 0, 0, 0.1);
  const speed = 3 * Math.pow(8, cl(k[1], 0, 4) / 4);
  P.a += speed * d;
  while (P.a >= SP) {
    P.a -= SP;
    for (let j = 0; j < NCH; j++) {
      P.buf[j].copyWithin(0, 1);
      P.buf[j][NS - 1] = stepChan(P.ch[j]);
    }
  }
}

// ---- colour: two ramps, one for each sign, from the dimmest fold to the brightest
const POS = [
  [0, 232, 108, 10],
  [0.4, 255, 158, 22],
  [0.75, 255, 208, 70],
  [1, 255, 246, 208],
];
const NEG = [
  [0, 0, 138, 146],
  [0.4, 0, 196, 214],
  [0.75, 96, 228, 248],
  [1, 216, 250, 255],
];

function ramp(stops, u, out) {
  let i = 0;
  while (i < stops.length - 2 && u > stops[i + 1][0]) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const t = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * t;
  out[1] = a[2] + (b[2] - a[2]) * t;
  out[2] = a[3] + (b[3] - a[3]) * t;
}

// A hue turn that keeps the brightness where it was.
function rotate(m, c) {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  c[0] = cl(m[0] * r + m[1] * g + m[2] * b, 0, 255);
  c[1] = cl(m[3] * r + m[4] * g + m[5] * b, 0, 255);
  c[2] = cl(m[6] * r + m[7] * g + m[8] * b, 0, 255);
}

function cubic(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

// ---- drawing: each strip's value at three looks across every column, folded into bands
const M = 2.6; // the value that fills every band at three bands

export function draw(display, P) {
  if (!P.buf) return;
  const [k1, , k3, k4] = P.k;
  const B = 3 + 1.5 * cl(k3, -1, 1);
  const n = Math.ceil(B - 1e-6);
  const f = B - (n - 1);
  const lam = 0.92 * Math.pow(cl((k4 + 1) / 2, 0, 1), 1.5);
  const own = sqrt(1 - lam * lam);
  const nl = SUB.length;

  const th = 2 * PI * cl(k1, 0, 1);
  const co = Math.cos(th);
  const si = Math.sin(th);
  const m = [
    0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
    0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.14, 0.072 - co * 0.072 - si * 0.283,
    0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072,
  ];
  for (let i = 0; i < n; i++) {
    const u = min(1, (i + 0.35) / (B - 0.65));
    ramp(POS, u, P.col[i][0]);
    ramp(NEG, u, P.col[i][1]);
    rotate(m, P.col[i][0]);
    rotate(m, P.col[i][1]);
  }

  // every series at every look across the panel, smooth between its samples
  const V = P.v;
  for (let j = 0; j < NCH; j++) {
    const b = P.buf[j];
    for (let x = 0; x < W; x++)
      for (let s = 0; s < nl; s++) {
        const u = (x + SUB[s] + P.a) / SP;
        const i0 = floor(u);
        V[(j * W + x) * nl + s] = cubic(b[i0 - 1], b[i0], b[i0 + 1], b[i0 + 2], u - i0);
      }
  }

  // The eight own parts sum to nothing at every look, so there are always both signs on the panel.
  const MEAN = P.mean;
  for (let q = 0; q < W * nl; q++) {
    let sum = 0;
    for (let j = 0; j < NSTRIP; j++) sum += V[j * W * nl + q];
    MEAN[q] = sum / NSTRIP;
  }

  const hs = [0, 0, 0, 0, 0, 0];
  const acc = P.acc;
  for (let j = 0; j < NSTRIP; j++) {
    const y0 = j * PITCH;
    for (let x = 0; x < W; x++) {
      acc.fill(0);
      for (let s = 0; s < nl; s++) {
        const q = x * nl + s;
        const v = own * 1.069 * (V[j * W * nl + q] - MEAN[q]) + lam * V[NSTRIP * W * nl + q];
        const neg = v < 0;
        const a = Math.pow(abs(v) / (M * (0.5 + 0.167 * B)), 0.7 + 0.0667 * (B - 1.5)) * B;
        for (let i = 0; i < n; i++) hs[i] = cl(a - i, 0, 1) * SH * (i === n - 1 ? f : 1);
        for (let r = 0; r < SH; r++) {
          const dist = neg ? r : SH - 1 - r;
          let cr = 0;
          let cg = 0;
          let cb = 0;
          for (let i = 0; i < n; i++) {
            const t = hs[i] - dist;
            if (t <= 0.1) break;
            const cov = t >= 0.9 ? 1 : (t - 0.1) / 0.8;
            const c = P.col[i][neg ? 1 : 0];
            cr += (c[0] - cr) * cov;
            cg += (c[1] - cg) * cov;
            cb += (c[2] - cb) * cov;
          }
          acc[r * 3] += cr;
          acc[r * 3 + 1] += cg;
          acc[r * 3 + 2] += cb;
        }
      }
      for (let r = 0; r < SH; r++)
        display.setPixel(x, y0 + r, Math.round(acc[r * 3] / nl), Math.round(acc[r * 3 + 1] / nl), Math.round(acc[r * 3 + 2] / nl));
      display.setPixel(x, y0 + SH, 0, 0, 0);
    }
  }
}
