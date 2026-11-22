// ===== Patternflow pattern =====
// Title:   Isogyres
// Family:  conoscopy
// Idea:    The interference figure of a thin crystal plate seen in convergent light between crossed polarizers, each LED one direction through the plate, so that rings of Michel-Lévy colour close round the points where an optic axis comes out and a dark brush crosses them, while the plate turns on its stage and the axis tilts and the optic angle opens and shuts, the brush splitting from a cross into two hyperbolas and closing again without ever coming back to the same picture.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: chromatic polarization of thin plates of mica and quartz (François Arago, 1811), rings crossed by a black bar in topaz and the two-axis crystals (David Brewster, 1813 and 1818), the optical indicatrix (Lazarus Fletcher, 1892), the interference colour chart (Auguste Michel-Lévy and Alfred Lacroix, 1888); pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Stage=0..4, Optic=0..1, Aperture=0.72..0.96
//
// Knob 1: Tint
// Knob 2: Stage
// Knob 3: Optic
// Knob 4: Aperture

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, sin, cos, PI, min, max, exp, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the light: NW wavelengths with their share of red, green and blue
const NW = 16;
const LAM = [];
for (let n = 0; n < NW; n++) LAM.push(410 + 20 * n);
const WT = new Float64Array(NW * 3);
{
  const g = (l, m, a, b) => exp(-0.5 * pow((l - m) / (l < m ? a : b), 2));
  for (let n = 0; n < NW; n++)
    for (let j = 0; j < 8; j++) {
      const l = LAM[n] + (j - 3.5) * 2.5;
      const x = 1.056 * g(l, 599.8, 37.9, 31) + 0.362 * g(l, 442, 16, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
      const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
      const z = 1.217 * g(l, 437, 11.8, 36) + 0.681 * g(l, 459, 26, 13.8);
      WT[n * 3] += 3.2406 * x - 1.5372 * y - 0.4986 * z;
      WT[n * 3 + 1] += -0.9689 * x + 1.8758 * y + 0.0415 * z;
      WT[n * 3 + 2] += 0.0557 * x - 0.204 * y + 1.057 * z;
    }
  for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let n = 0; n < NW; n++) s += WT[n * 3 + c];
    for (let n = 0; n < NW; n++) WT[n * 3 + c] /= s;
  }
}
const C2 = new Float32Array(NW), S2 = new Float32Array(NW), WN = new Float32Array(NW * 3);
const TS = 4096;
const COS = new Float32Array(TS), SIN = new Float32Array(TS);
for (let i = 0; i < TS; i++) {
  COS[i] = cos((i * TAU) / TS);
  SIN[i] = sin((i * TAU) / TS);
}
const KI = LAM.map((l) => TS / l); // a retardation in nm to a step of the circle
const ENC = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) {
  const v = i / 1024;
  ENC[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055));
}

// ---- the panel as directions through the plate
const NBAR = 1.55; // mean index of the crystal
const RHALF = 64; // LEDs from the middle to the top and bottom edge
const RR = new Float32Array(NPX), CP = new Float32Array(NPX), SP = new Float32Array(NPX);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x - 31.5, dy = y - 63.5, r = sqrt(dx * dx + dy * dy), i = y * W + x;
    RR[i] = r / RHALF;
    CP[i] = r > 1e-6 ? dx / r : 1;
    SP[i] = r > 1e-6 ? dy / r : 0;
  }

function makeState() {
  return {
    tau: 0, phi: 0.4,
    kn: [0, 2, 0, 0.72],
    gam: new Float32Array(NPX), cc: new Float32Array(NPX), ss: new Float32Array(NPX),
    mark: new Float32Array(NPX),
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.72], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.tau += d;
  const t = S.tau;
  const sw = 1 + 0.45 * sin((TAU * t) / 43.7 + 0.9) + 0.25 * sin((TAU * t) / 17.9 + 2.3);
  S.phi += 0.07 * cl(kn[1], 0, 4) * sw * d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.kn, t = S.tau;
  const tint = cl(kn[0], 0, 1) * 1100;
  const na = cl(kn[3], 0.72, 0.96);
  const opt = cl(kn[2], 0, 1);
  // the crystal
  const tilt = 38 * (0.5 + 0.46 * (0.4 * sin((TAU * t) / 67.1 + 0.4) + 0.35 * sin((TAU * t) / 29.3 + 2.0) + 0.25 * sin((TAU * t) / 13.7 + 4.1))) * (PI / 180);
  const V = max(0.02, (11 + 16 * opt + (5 + 5 * opt) * (0.4 * sin((TAU * t) / 53.7 + 0.5) + 0.35 * sin((TAU * t) / 21.9 + 2.2) + 0.25 * sin((TAU * t) / 11.3 + 5.0))) * (PI / 180));
  const zeta = (TAU * t) / 83.7 + 1.2 * sin((TAU * t) / 61.7 + 1.0) + 0.5 * sin((TAU * t) / 17.9 + 3.3);
  const G0 = 4000 * (1 + 0.14 * sin((TAU * t) / 311.7 + 0.2) + 0.1 * sin((TAU * t) / 71.3 + 1.1) + 0.06 * sin((TAU * t) / 33.7 + 2.7));
  const kk = cos(V) * cos(V);
  // axes of the crystal in the frame of the plate
  const st = sin(tilt), ct = cos(tilt), b = S.phi, cb = cos(b), sb = sin(b);
  const tx = cb, ty = sb; // tilt direction
  const r1x = ct * tx, r1y = ct * ty, r1z = -st;
  const r2x = -sb, r2y = cb;
  const cz = cos(zeta), sz = sin(zeta);
  const u1x = cz * r1x + sz * r2x, u1y = cz * r1y + sz * r2y, u1z = cz * r1z;
  const u2x = -sz * r1x + cz * r2x, u2y = -sz * r1y + cz * r2y, u2z = -sz * r1z;
  const { gam, cc, ss } = S;
  const sna = na / NBAR;
  for (let i = 0; i < NPX; i++) {
    const sn = RR[i] * sna; // sin of the angle inside
    const nx = sn * CP[i], ny = sn * SP[i], nz = sqrt(1 - sn * sn);
    // e1: the polarizer direction seen along n, e2 across it
    const q = 1 / sqrt(1 - nx * nx);
    const e1x = (1 - nx * nx) * q, e1y = -nx * ny * q, e1z = -nx * nz * q;
    const e2x = ny * e1z - nz * e1y, e2y = nz * e1x - nx * e1z, e2z = nx * e1y - ny * e1x;
    const p1 = e1x * u1x + e1y * u1y + e1z * u1z, q1 = e2x * u1x + e2y * u1y + e2z * u1z;
    const p2 = e1x * u2x + e1y * u2y + e1z * u2z, q2 = e2x * u2x + e2y * u2y + e2z * u2z;
    const m11 = p1 * p1 + kk * p2 * p2, m22 = q1 * q1 + kk * q2 * q2, m12 = p1 * q1 + kk * p2 * q2;
    const dd = m11 - m22, D = sqrt(dd * dd + 4 * m12 * m12);
    gam[i] = (G0 * D) / nz;
    if (D > 1e-9) {
      cc[i] = -dd / D;
      ss[i] = (-2 * m12) / D;
    } else {
      cc[i] = 1;
      ss[i] = 0;
    }
  }
  // the lamp: its colour temperature and its brightness drift a little
  const kap = 0.15 * (0.6 * sin((TAU * t) / 97.3 + 0.8) + 0.4 * sin((TAU * t) / 41.1 + 2.9));
  const lamp = 0.95 * (1 + 0.07 * (0.6 * sin((TAU * t) / 53.3 + 1.7) + 0.4 * sin((TAU * t) / 23.1 + 0.3)));
  for (let n = 0; n < NW; n++) {
    const a = (TAU * tint) / LAM[n];
    C2[n] = cos(a);
    S2[n] = sin(a);
    const w = lamp * (1 + (kap * (LAM[n] - 550)) / 150);
    WN[n * 3] = WT[n * 3] * w;
    WN[n * 3 + 1] = WT[n * 3 + 1] * w;
    WN[n * 3 + 2] = WT[n * 3 + 2] * w;
  }
  const GAIN = 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const gx = x < W - 1 ? gam[i + 1] - gam[i] : gam[i] - gam[i - 1];
      const gy = y < H - 1 ? gam[i + W] - gam[i] : gam[i] - gam[i - W];
      const gg = sqrt(gx * gx + gy * gy);
      const g = gam[i], c = cc[i], s = ss[i], c2 = c * c, s2 = s * s;
      let r = 0, gr = 0, bl = 0;
      for (let n = 0; n < NW; n++) {
        const idx = ((g * KI[n]) | 0) & (TS - 1);
        const u = (PI * 1.2 * gg) / LAM[n];
        const u2 = u * u;
        const at = u > 3.1 ? 0 : 1 - u2 / 6 + (u2 * u2) / 120 - (u2 * u2 * u2) / 5040;
        const I = 0.5 * (1 - c2 * C2[n]) + at * (-0.5 * s2 * C2[n] * COS[idx] + 0.5 * s * S2[n] * SIN[idx]);
        r += WN[n * 3] * I;
        gr += WN[n * 3 + 1] * I;
        bl += WN[n * 3 + 2] * I;
      }
      display.setPixel(x, y, ENC[cl(r * GAIN, 0, 1) * 1024 | 0], ENC[cl(gr * GAIN, 0, 1) * 1024 | 0], ENC[cl(bl * GAIN, 0, 1) * 1024 | 0]);
    }
}
