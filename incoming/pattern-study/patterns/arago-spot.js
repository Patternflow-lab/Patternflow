// ===== Patternflow pattern =====
// Title:   Arago Spot
// Family:  wave
// Idea:    White light falls past an opaque disc: the top half is a section through its shadow, radius across and distance down, where a bright line runs down the axis through the dark band, and the bottom half is the screen itself at a distance that sweeps back and forth along that section, a dark disc with coloured rings and the Poisson-Arago spot burning in its middle while the rings breathe round it.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Poisson-Arago spot (Siméon Denis Poisson's objection to Fresnel's wave theory and François Arago's observation, 1818), Fresnel diffraction (Augustin-Jean Fresnel, 1818), Babinet's principle (Jacques Babinet, 1837), pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fresnel=4..16, Rough=0..1
//
// Knob 1: Hue. Tints the light round the wheel at a quarter saturation: at 0 a pale azure white, at 0.25 pale violet, at 0.5 peach, at 0.75 pale green. Under the tint the rings keep the colours the three wavelengths give them, and the marker ticks are gold at 0 and turn with the tint.
// Knob 2: Speed. At 2 the screen travels from the top row of the section to the bottom in 6 s and back in 6 s, slowing at both ends; at 0.2 a crossing takes 60 s, at 3 it takes 4 s.
// Knob 3: Fresnel. The Fresnel number a^2 / (lambda z) at the top row of the section, for green light; the section reaches 4 times as far, so its bottom row has a quarter of it. At 4 the screen opens on a spot 4 LEDs across in a dark disc ringed every 2.5 LEDs, and at the bottom of the sweep (N = 1) the spot is 16 LEDs across and the shadow is mostly rings. At 16 the shadow is sharp and smooth, its rings finer than an LED, and the spot is a single LED that only widens to 4 at the bottom.
// Knob 4: Rough. Spreads the disc's edge radius by up to a quarter of the radius either side, and the light drawn is the field averaged over that spread. The spot needs an edge true to a fraction of a Fresnel zone: at 1 the axis is dark at the top of the section, comes back to a quarter of the free light a third of the way down where the Fresnel number has fallen to 2, and to 0.72 at the bottom. Red has the smallest Fresnel number, so the returning spot is warm before it turns white.

// The field behind an opaque disc of radius a, lit by a plane wave, is by
// Babinet's principle the free wave minus the wave through a hole of radius
// a. In the paraxial (Fresnel) form, with s = r / a and the Fresnel number
// N = a^2 / (lambda z),
//
//   U(s) = 1 - 2 pi i N e^{i pi N s^2} * integral_0^1 e^{i pi N u^2} J0(2 pi N s u) u du,
//
// and the intensity is |U|^2. On the axis the integral is closed, the hole's
// wave is 1 - e^{i pi N}, and U = e^{i pi N}: the intensity at the centre of
// the shadow is exactly the free intensity, 1, at every distance. That is the
// spot Poisson derived from Fresnel's memoir to show the theory absurd, and
// Arago then saw.
//
// The integral is done by Simpson's rule with enough steps that the phase
// turns under 0.6 rad a step, and J0 comes from a table in steps of 1/32
// built from the Abramowitz and Stegun polynomial fits (9.4.1 and 9.4.3,
// error under 5e-8); linear reading of the table adds at most 1.2e-4.
//
// White light is three wavelengths, 620, 540 and 460 nm, drawn in red,
// green and blue. N scales as one over the wavelength, so the red rings sit
// 1.15 times further out than the green and the blue 0.85 times as far: at
// the axis the three agree and the spot is white, and the rings round it
// split into colour.
//
// Rough: an edge whose radius wanders over 1 +- w, with the density
// cos^2(pi t / 2w) / w, has on average the opacity 1 - F(u - 1), F that
// density's distribution. The field is linear in the opacity, so the average
// field is the field of that soft disc, and that is what is drawn. On the
// axis it is e^{i pi N} times the density's characteristic function at
// 2 pi N, which first vanishes at N w = 1. The speckle a real rough edge
// adds off the axis is left out.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, sin, cos, ceil, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Fresnel number of each colour over that of green.
const KN = [540 / 620, 1, 540 / 460];
// Section: rows 0..61, disc radius 20 columns, columns 2..61 (columns 0, 1,
// 62 and 63 hold the marker). The section reaches Q times as far as its top.
const SEC_H = 62, A_SEC = 20, Q = 4, SUB = 4;
// Screen: rows 64..127, centre on the LED (32, 96), disc radius 20 LEDs.
const SCR_Y = 64, A_SCR = 20, CX = 32, CY = 96;
// Radial samples of the screen profile, a quarter LED apart out to 46 LEDs.
const RS = 0.25, NR = 186;
// Edge spread at Rough 1, as a share of the radius.
const WMAX = 0.25;
// Intensity drawn at full brightness, and the curve below it.
const ITOP = 1.8, GAM = 0.8;

// J0 by Abramowitz and Stegun 9.4.1 (|x| <= 3) and 9.4.3 (x > 3).
function j0fit(x) {
  x = x < 0 ? -x : x;
  if (x <= 3) {
    const y = (x / 3) * (x / 3);
    return 1 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.00021)))));
  }
  const y = 3 / x;
  const f = 0.79788456 + y * (-0.00000077 + y * (-0.0055274 + y * (-0.00009512 + y * (0.00137237 + y * (-0.00072805 + y * 0.00014476)))));
  const t = x - 0.78539816 + y * (-0.04166397 + y * (-0.00003954 + y * (0.00262573 + y * (-0.00054125 + y * (-0.00029333 + y * 0.00013558)))));
  return (f * cos(t)) / sqrt(x);
}
const JS = 32, JN = 320 * JS + 2;
const JT = new Float32Array(JN);
for (let i = 0; i < JN; i++) JT[i] = j0fit(i / JS);

// Quadrature nodes for one Fresnel number: Simpson weight times opacity
// times u times e^{i pi N u^2}, and the J0 argument per unit s.
const GR = new Float64Array(1201), GI = new Float64Array(1201), GA = new Float64Array(1201);
function nodes(N, w, smax) {
  const umax = 1 + w;
  // The phase of the integrand turns at most 2 pi N (u + s) per unit u.
  let M = ceil((TAU * N * (umax + smax) * umax) / 0.6);
  M = cl(M + (M & 1), 24, 1200);
  const h = umax / M;
  for (let k = 0; k <= M; k++) {
    const u = k * h;
    let o = 1;
    if (w > 0 && u > 1 - w) {
      const t = u - 1;
      o = 1 - ((t + w) / (2 * w) + sin((PI * t) / w) / TAU);
    }
    const sw = ((k === 0 || k === M ? 1 : k & 1 ? 4 : 2) * h) / 3;
    const g = sw * o * u, ph = PI * N * u * u;
    GR[k] = g * cos(ph);
    GI[k] = g * sin(ph);
    GA[k] = TAU * N * u * JS;
  }
  return M;
}

// Intensity behind the disc at s, with the nodes set for N.
function intensity(N, M, s) {
  let re = 0, im = 0;
  for (let k = 0; k <= M; k++) {
    const f = GA[k] * s, i = f | 0;
    const j = i < JN - 1 ? JT[i] + (JT[i + 1] - JT[i]) * (f - i) : j0fit(f / JS);
    re += GR[k] * j;
    im += GI[k] * j;
  }
  const c = cos(PI * N * s * s), sn = sin(PI * N * s * s);
  const ar = re * c - im * sn, ai = re * sn + im * c;
  const ur = 1 - TAU * N * ai, ui = TAU * N * ar;
  return ur * ur + ui * ui;
}

// Brightness 0..1 of an intensity.
const bright = (I) => (I <= 0 ? 0 : I >= ITOP ? 1 : (I / ITOP) ** GAM);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  params.s = {
    phase: 0,
    hue: 0,
    n0: 4,
    w: 0,
    // Section: brightness per row, half-width column and colour, mirrored.
    sec: new Float32Array(SEC_H * 32 * 3),
    secN: new Float32Array(SEC_H).fill(-1),
    secW: new Float32Array(SEC_H).fill(-1),
    cursor: 0,
    prof: new Float32Array(NR * 3),
    box: new Float32Array(NR * 3),
    row: 0,
  };
}

// Recomputes one row of the section for the current Fresnel number and edge.
function sectionRow(S, y) {
  const z = 1 + ((Q - 1) * (y + 0.5)) / SEC_H;
  for (let c = 0; c < 3; c++) {
    const N = (S.n0 * KN[c]) / z;
    const M = nodes(N, S.w, 30 / A_SEC);
    for (let x = 0; x < 30; x++) {
      let acc = 0;
      for (let j = 0; j < SUB; j++) acc += intensity(N, M, (x + (j + 0.5) / SUB) / A_SEC);
      S.sec[(y * 32 + x) * 3 + c] = bright(acc / SUB);
    }
  }
  S.secN[y] = S.n0;
  S.secW[y] = S.w;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  // Fresnel and Rough in fine steps, so a still knob leaves the section alone.
  S.n0 = round(cl(k[2] == null ? 4 : k[2], 4, 16) * 50) / 50;
  S.w = round(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 100) / 100 * WMAX;
  // One crossing of the section in 6 s at Speed 2.
  S.phase = (S.phase + (d * speed) / 24) % 1;
  S.row = (SEC_H - 1) * (0.5 - 0.5 * cos(TAU * S.phase));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // Section rows that are stale: all of them on the first frame, then up
  // to eight a frame from a running cursor.
  let fresh = 0;
  const first = S.secN[0] < 0;
  for (let n = 0; n < SEC_H && (first || fresh < 8); n++) {
    const y = (S.cursor + n) % SEC_H;
    if (S.secN[y] !== S.n0 || S.secW[y] !== S.w) {
      sectionRow(S, y);
      fresh++;
    }
  }
  S.cursor = (S.cursor + 8) % SEC_H;

  const tint = hsv(S.hue + 0.55, 0.25, 1);
  const mark = hsv(S.hue + 0.15, 0.7, 1);

  // Section, mirrored about the axis between columns 31 and 32.
  for (let y = 0; y < SEC_H; y++)
    for (let x = 0; x < 30; x++) {
      const p = (y * 32 + x) * 3;
      const r = round(255 * tint[0] * S.sec[p]), g = round(255 * tint[1] * S.sec[p + 1]), b = round(255 * tint[2] * S.sec[p + 2]);
      display.setPixel(32 + x, y, r, g, b);
      display.setPixel(31 - x, y, r, g, b);
    }
  // The marker: where along the section the screen below stands, two LEDs
  // wide at either side and spread over the two rows it falls between.
  const my = S.row, m0 = floor(my), mf = my - m0;
  for (let y = 0; y < SEC_H; y++) {
    const a = y === m0 ? 1 - mf : y === m0 + 1 ? mf : 0;
    const v = a > 0 ? 0.35 + 0.65 * a : 0;
    for (const x of [0, 1, 62, 63]) display.setPixel(x, y, round(255 * mark[0] * v), round(255 * mark[1] * v), round(255 * mark[2] * v));
  }
  for (let x = 0; x < W; x++) {
    display.setPixel(x, SEC_H, 0, 0, 0);
    display.setPixel(x, SEC_H + 1, 0, 0, 0);
  }

  // Screen: the radial profile at the marker's distance, a quarter LED apart,
  // then averaged over one LED so rings finer than an LED blur instead of
  // aliasing.
  const z = 1 + ((Q - 1) * (S.row + 0.5)) / SEC_H;
  const prof = S.prof, box = S.box;
  for (let c = 0; c < 3; c++) {
    const N = (S.n0 * KN[c]) / z;
    const M = nodes(N, S.w, (NR * RS) / A_SCR);
    for (let i = 0; i < NR; i++) prof[i * 3 + c] = intensity(N, M, (i * RS) / A_SCR);
  }
  for (let i = 0; i < NR; i++)
    for (let c = 0; c < 3; c++) {
      let acc = 0, n = 0;
      for (let j = -2; j <= 2; j++) {
        const q = i + j < 0 ? -(i + j) : min(NR - 1, i + j);
        acc += prof[q * 3 + c] * (j === -2 || j === 2 ? 0.5 : 1);
        n += j === -2 || j === 2 ? 0.5 : 1;
      }
      box[i * 3 + c] = bright(acc / n);
    }
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - CX, dy = SCR_Y + y - CY;
      const f = sqrt(dx * dx + dy * dy) / RS, i = min(NR - 2, f | 0), t = f - i;
      const p = i * 3;
      display.setPixel(
        x,
        SCR_Y + y,
        round(255 * tint[0] * (box[p] + (box[p + 3] - box[p]) * t)),
        round(255 * tint[1] * (box[p + 1] + (box[p + 4] - box[p + 1]) * t)),
        round(255 * tint[2] * (box[p + 2] + (box[p + 5] - box[p + 2]) * t)),
      );
    }
}
