// ===== Patternflow pattern =====
// Title:   Rayleigh Criterion
// Family:  airydisk
// Idea:    Seven pairs of point sources circle each other on Kepler orbits and are photographed through one round aperture, so each point is an Airy disc with its dark and bright rings, and each pair is a peanut or a clean double or a single lump that opens and closes as its separation crosses the limit where the dip between the two peaks appears.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the diffraction pattern of a round aperture, intensity (2 J1(x) / x)^2 (George Airy, 1835, from memory), the resolution criterion that two such patterns are separated when the peak of one lies on the first dark ring of the other (Lord Rayleigh, 1879, from memory), the criterion that asks only that the dip between them vanish, at 0.77 of that separation (C. M. Sparrow, 1916, from memory), Bessel's integral for J1 summed by the trapezoid rule, original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Wavelength=490..680, Aperture=1.6..3.6, Seeing=0..1, Companion=-1..1
//
// Knob 1: Wavelength. The colour of the light in nanometres, which is also its size. 490 is cyan, 530 green, 580 yellow, 610 orange, 650 and up red, and the colour is the one a spectrum shows at that wavelength. The first dark ring of every disc has a radius of 1.22 lambda f / D, so it grows with the wavelength: x1.00 at 550 nm, x0.89 at 490, x1.24 at 680. At the opening 490 the first dark ring has a radius of 4.45 LED, at 680 it is 6.2, and a pair that is two at cyan is one lump at red. The discs are white where the light is strongest and take the colour where it is not.
// Knob 2: Aperture. The diameter D of the opening, in arbitrary units, with the scene fixed. The first dark ring has a radius of 10 / D x (lambda / 550) LED, so at 550 nm it is 6.9 LED at 1.45, 5 LED at 2 (the opening) and 2.5 LED at 4. A wider opening makes every disc smaller and every pair easier to split, and since the pairs do not move, this is the knob that moves them across the limit all together.
// Knob 3: Seeing. How much the air stirs the light, 0 to 1. At 0 the aperture is alone and the picture is the diffraction pattern of the lens, crisp rings and still discs. A share 0.75 K of every disc's light goes into a soft halo 2.4 first-ring radii across (the Strehl ratio falls from 1 to 0.25), the rings sink into it, and every source is shaken on its own by up to 0.3 of a first-ring radius, with sines of 0.3 to 1.1 Hz that no pair shares. At 0.5 the rings are still there but hazy and the pairs shiver across the limit, at 1 the discs are wide soft lumps.
// Knob 4: Companion. The brightness of the second source of each pair against its first, scaled with exp(1.2 (K + 0.04)) on a ratio each pair has of its own (0.5 to 0.95). At -1 the companions are 0.3 of that ratio, small faint discs next to bright ones, sometimes lost in a ring. At the opening 0.06 the ratios are as listed. At 1 the companions are 2.9 times that, which makes every pair but one a pair of equals, where the dip at the limit is deepest.
//
// What the picture is. A view of a telescope's image plane. Each of seven pairs is two point sources a long way off that the aperture cannot show as points: it shows each as an Airy disc, I = (2 J1(x) / x)^2 with x = 3.8317 r / R, R the radius of the first dark ring. The discs of one pair add as intensities, because two sources do not interfere, and the sum goes through a display curve. Equal discs a distance R apart (Rayleigh's limit) have 0.735 of their peak at the middle: the pair is two with a waist. At 0.77 R (Sparrow's limit) the waist is gone and the pair is a flat-topped peanut, and closer than that it is one round lump. The picture is the pair walking through that sequence in both directions.
// The orbits. Every pair is a Kepler orbit: mean anomaly M = 2 pi t / P, the eccentric anomaly E from M = E - e sin E by Newton's method (four steps from M + e sin M), position (a (cos E - e), a sqrt(1 - e^2) sin E), the second axis shortened by the cosine of an inclination, the whole turned on the screen by an angle that itself precesses once in 160 to 290 s, and the semi-major axis breathing by 12 percent on a clock of its own. The seven periods are 23, 31, 37, 43, 47, 53 and 61 s, prime, so no two come round together. The separation in units of R at the opening runs 0.5 to 1.3, 0.9 to 2.1, 0.3 to 1.05, 1.3 to 2.5, 0.5 to 1.7, 0.7 to 1.0 and 0.5 to 2.1, one pair for each way of meeting the limit: one that stays a lump, one that stays two, one that hovers on the limit, and four that cross it. Eccentric orbits are fast near periapsis, so the crossing of 1 R and 0.77 R takes 1 to 4 s there and half a minute at a pair that sits near apoapsis. The two sources take the barycentre by their brightness, which puts the brighter one nearer the middle of the pair.
// The places. The pairs are seven homes on a staggered lattice, four in the left column and three in the right, 32 to 36 LED apart, and each home drifts on two sines per axis (5 to 7 LED, periods 49 to 149 s) so a pair walks across a quarter of the panel and its neighbours do not meet. All seven are on screen at once, one for each fourth and a bit of the 4 x 8 grid of 16 LED squares.
// The table. J1 is computed once, from Bessel's integral J1(x) = (1/pi) integral of sin t sin(x sin t) over 0 to pi, summed by the trapezoid rule at 32 steps (the integrand is smooth and periodic, so the error is at machine level; the first zero came out at 3.8317 and the first ring at 0.0175 of the peak). The intensity goes into a table of 2048 steps in x^2, and each frame blends it with a soft halo table by the Seeing knob. Each source adds its table to a 64 x 128 buffer inside 5.1 first-ring radii (the sixth zero), the last 7.6 x of it fading out smoothly so there is no edge. The cost per frame is about 20 to 70 thousand lookups.
// The display. The sum I goes through a curve that is I^0.36 below 0.1, so the rings (0.0175, 0.0042, 0.0016 of the peak: 0.24, 0.13, 0.09 after the curve) are still bright enough to read and the tails fill the space, and goes straight above, so that the 26 percent dip at Rayleigh's limit is still 22 percent on the screen. Whiteness follows the linear I, 0 below 0.62 and 1 above 1: the centre of each disc is white and the colour of the light starts where it has fallen to 0.62. At the limit the middle of the pair is only 0.735 and shows as a coloured waist between two white cores. The sky is a dark navy (8, 20, 56), because a black one leaves the quarter of the panel beyond every ring dead and a dark navy that is added to every colour is the plate the light falls on.
// What is exact and what is drawn. The Airy pattern, the first zero 1.22 lambda f / D, the incoherent sum, Rayleigh's 0.735 and Sparrow's 0.77, the Kepler equation and the way R scales with lambda and 1 / D are physics. The halo and the shaking that stand for seeing, the display curve, the colour map of the spectrum and its white core, the sky, the orbits' sizes and eccentricities and the places are drawing choices. R is 2.5 to 7 LED at 550 nm so that a disc is a lump with rings and never a one LED point.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---------------------------------------------------------------- the Airy table
const J1Z = 3.8317059702;   // the first zero of J1, the first dark ring at x = 3.8317
const XMAX = 19.6158585105; // the sixth zero: nothing is added beyond it
const NT = 2048;            // table steps in x^2
const UMAX = XMAX * XMAX;
const AIRY = new Float32Array(NT + 2);
const HALO = new Float32Array(NT + 2);
const MIX = new Float32Array(NT + 2);

// J1 by Bessel's integral (1/pi) int_0^pi sin t sin(x sin t) dt, trapezoid rule. The integrand is the
// even, periodic extension of a smooth function, so 32 steps are exact to rounding for x up to 20.
const SINT = new Float32Array(33);
for (let m = 0; m <= 32; m++) SINT[m] = sin((PI * m) / 32);
function j1(x) {
  let s = 0;
  for (let m = 1; m < 32; m++) s += SINT[m] * sin(x * SINT[m]);
  return s / 32;
}

function buildTables() {
  const sx = 3.2;                   // the seeing halo, sigma in x units: 2.4 first-ring radii across at half height
  const g0 = 2 / (sx * sx);         // the Airy pattern holds 2 in these units (integral of I x dx), so the halo gets as much
  for (let j = 0; j <= NT + 1; j++) {
    const u = (j * UMAX) / NT;
    const x = sqrt(u);
    const a = x < 1e-4 ? 1 : (2 * j1(x)) / x;
    AIRY[j] = a * a * (1 - sm(12, XMAX, x));
    HALO[j] = j > NT ? 0 : g0 * exp(-u / (2 * sx * sx)) * (1 - sm(14, XMAX, x));
  }
  AIRY[NT + 1] = 0;
}

// ---------------------------------------------------------------- the pairs
// home x, home y, drift x, drift y (LED), a (units of R at the opening), e, cos inclination, period (s),
// M0 (turns), screen angle 0 (turns), precession period (s, signed), brightness of the pair, companion ratio
const PAIRS = [
  [14, 15, 5.5, 6.5, 0.95, 0.35, 0.60, 31, 0.10, 0.05, 190, 1.00, 0.85],
  [48, 31, 5.0, 7.0, 1.50, 0.40, 0.80, 47, 0.55, 0.40, -230, 0.92, 0.60],
  [18, 49, 6.0, 6.0, 0.70, 0.50, 0.50, 23, 0.30, 0.70, 160, 1.00, 0.85],
  [46, 65, 5.0, 6.5, 1.90, 0.30, 0.90, 61, 0.80, 0.15, -290, 0.90, 0.65],
  [15, 81, 6.0, 7.0, 1.10, 0.55, 0.70, 37, 0.45, 0.55, 210, 0.95, 0.50],
  [50, 97, 5.5, 6.0, 0.85, 0.20, 0.95, 53, 0.20, 0.30, -250, 0.90, 0.90],
  [19, 113, 5.5, 6.5, 1.30, 0.60, 0.65, 43, 0.65, 0.85, 175, 0.90, 0.70],
];
const NP = PAIRS.length;
// drift periods: x1, x2, y1, y2 (s), and phases
const DRIFT = [
  [71, 127, 89, 53], [83, 109, 97, 61], [59, 131, 103, 67], [97, 73, 79, 139],
  [67, 113, 131, 49], [89, 53, 107, 149], [79, 101, 61, 121],
];
const R1REF = 4.9;           // R at the opening, in LED, which the orbits are sized against

// Kepler: the separation vector of one pair, in LED, at time t, into OUT[0], OUT[1]
const OUT = [0, 0];
function sepAt(i, t, rscale) {
  const P = PAIRS[i];
  const e = P[5];
  const aa = P[4] * R1REF * rscale * (1 + 0.12 * sin((TAU * t) / (97 + 17 * i) + 1.3 * i));
  let M = TAU * (t / P[7] + P[8]);
  M -= floor(M / TAU) * TAU;
  let E = M + e * sin(M);
  for (let k = 0; k < 4; k++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
  const xo = aa * (cos(E) - e);
  const yo = aa * sqrt(1 - e * e) * sin(E) * P[6];
  const om = TAU * (P[9] + t / P[10]);
  const c = cos(om), s = sin(om);
  OUT[0] = xo * c - yo * s;
  OUT[1] = xo * s + yo * c;
}

// ---------------------------------------------------------------- the light
// the colour of a spectrum at this wavelength, 0..1 per channel
function spectrum(nm, o) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  o[0] = r; o[1] = g; o[2] = b;
}

const SKY = [8, 20, 54];
// the display curve: logarithmic from I0 (T = 0) up to the knee IK (T = TK), then straight to 1 (T = 1)
const I0 = 1e-3, IK = 0.04, TK = 0.5;
const LK = TK / Math.log(IK / I0), SK = 1 / (1 - IK);

const ACC = new Float32Array(W * H);
const DX2 = new Float32Array(W);
const SPEC = [0, 0, 0];

function splat(cx, cy, amp, ci, rc) {
  const x0 = max(0, floor(cx - rc)), x1 = min(W - 1, ceil(cx + rc));
  const y0 = max(0, floor(cy - rc)), y1 = min(H - 1, ceil(cy + rc));
  if (x1 < x0 || y1 < y0) return;
  for (let x = x0; x <= x1; x++) {
    const d = x + 0.5 - cx;
    DX2[x] = d * d;
  }
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy, d2 = dy * dy, row = y * W;
    for (let x = x0; x <= x1; x++) {
      const q = (DX2[x] + d2) * ci;
      if (q >= NT) continue;
      const j = q | 0, f = q - j;
      ACC[row + x] += (MIX[j] + (MIX[j + 1] - MIX[j]) * f) * amp;
    }
  }
}

// ---------------------------------------------------------------- state
export function setup(params) {
  buildTables();
  const sh = [];
  for (let i = 0; i < NP * 2; i++) {
    sh.push([
      TAU * (0.3 + 0.8 * ((i * 0.381966) % 1)), TAU * ((i * 0.618034) % 1),
      TAU * (0.35 + 0.75 * ((i * 0.7548776) % 1)), TAU * ((i * 0.5698403) % 1),
      TAU * (1.1 + 0.4 * ((i * 0.2360679) % 1)), TAU * ((i * 0.3247179) % 1),
      TAU * (0.5 + 0.6 * ((i * 0.4142136) % 1)), TAU * ((i * 0.7320508) % 1),
    ]);
  }
  params.s = { t: 0, k: null, shake: sh };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [490, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.15);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const t = S.t, k = S.k;
  const nm = cl(k[0], 380, 700);
  const dia = cl(k[1], 1.2, 6);
  const see = cl(k[2], 0, 1);
  const cexp = exp(-2 * (k[3] - 0.06));
  spectrum(nm, SPEC);

  // R, the radius of the first dark ring in LED, and the table index per LED^2
  const R = (11 / dia) * (nm / 550);
  const kk = J1Z / R;
  const ci = (kk * kk * NT) / UMAX;
  const rc = (XMAX / J1Z) * R;
  const rscale = 1;               // the orbits are in LED and do not follow the optics

  // the Strehl share of the Airy table against the halo
  const str = 1 - 0.85 * see;
  const hw = 0.6 * (1 - str);
  for (let j = 0; j <= NT + 1; j++) MIX[j] = str * AIRY[j] + hw * HALO[j];
  const peak = str + hw * HALO[0];
  const gain = pow(peak, -0.5);

  ACC.fill(0);
  const shk = 0.45 * see * R;
  for (let i = 0; i < NP; i++) {
    const P = PAIRS[i], D = DRIFT[i];
    const cx = P[0] + P[2] * (0.7 * sin((TAU * t) / D[0] + i) + 0.3 * sin((TAU * t) / D[1] + 2 * i));
    const cy = P[1] + P[3] * (0.7 * sin((TAU * t) / D[2] + 1.7 * i) + 0.3 * sin((TAU * t) / D[3] + 3 * i));
    sepAt(i, t, rscale);
    const b = pow(P[12], cexp);
    const w = b / (1 + b);          // the brighter source sits nearer the barycentre
    const sx = OUT[0], sy = OUT[1];
    for (let n = 0; n < 2; n++) {
      const h = S.shake[i * 2 + n];
      const jx = shk * (0.6 * sin(h[0] * t + h[1]) + 0.4 * sin(h[4] * t + h[5]));
      const jy = shk * (0.6 * sin(h[2] * t + h[3]) + 0.4 * sin(h[6] * t + h[7]));
      const fx = n === 0 ? -sx * w : sx * (1 - w);
      const fy = n === 0 ? -sy * w : sy * (1 - w);
      splat(cx + fx + jx, cy + fy + jy, P[11] * (n === 0 ? 1 : b) * gain, ci, rc);
    }
  }

  const sr = SPEC[0], sg = SPEC[1], sb = SPEC[2];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const I = ACC[p];
      const T = I < I0 ? 0 : I < IK ? Math.log(I / I0) * LK : I < 1 ? TK + (1 - TK) * pow((I - IK) * SK, 1.6) : 1;
      const wh = sm(0.5, 1, I);
      const v = 255 * T;
      display.setPixel(
        x, y,
        min(255, SKY[0] + v * (sr + (1 - sr) * wh)) | 0,
        min(255, SKY[1] + v * (sg + (1 - sg) * wh)) | 0,
        min(255, SKY[2] + v * (sb + (1 - sb) * wh)) | 0
      );
    }
  }
}
