// ===== Patternflow pattern =====
// Title:   Rayleigh Criterion
// Family:  airydisk
// Idea:    Seven pairs of point sources circle each other on Kepler orbits and are seen through one round aperture, so every point is an Airy disc with dark and bright rings and every pair is a single lump, a peanut with a waist or a clean double, as its separation crosses the limit where the dip between the two peaks appears.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the diffraction pattern of a round aperture, intensity (2 J1(x) / x)^2 (George Airy, 1835, from memory), the rule that two such patterns are resolved when the peak of one lies on the first dark ring of the other (Lord Rayleigh, 1879, from memory), the rule that asks only that the dip between them vanish, at 0.77 of that separation (C. M. Sparrow, 1916, from memory), J1 from Bessel's integral summed by the trapezoid rule (Friedrich Bessel, 1824, from memory), the Kepler equation M = E - e sin E solved by Newton's method (Johannes Kepler, 1609, from memory), the Strehl ratio as the share of light left in the diffraction core (Karl Strehl, 1895, from memory), the wavelength to RGB map of a spectrum in straight segments (Dan Bruton, from memory), original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Wavelength=490..680, Aperture=1.8..3.6, Seeing=0..1, Companion=-1..1
//
// Knob 1: Wavelength. The colour of the light in nanometres, and with it the size of every disc. 490 is cyan and the knob opens there, 510 green, 545 lime, 580 yellow, 612 orange, 645 and up red, each channel pulled a tenth of the way to white. The first dark ring has a radius R = 1.22 lambda f / D, so it grows with the wavelength: x0.89 at 490 against 550 nm, x1.24 at 680. At the opening Aperture of 2, R is 4.9 LED at 490, 5.5 at 550 and 6.8 at 680. The scene does not move, so a pair that is two at cyan has closed to a peanut at red.
// Knob 2: Aperture. The diameter D of the opening, the scene held fixed. R = 11 / D x (lambda / 550) LED, so at 550 nm it is 6.1 LED at 1.8, 5.5 at the opening 2, 4.1 at 2.7 and 3.1 at 3.6, and at 490 it is 5.4, 4.9, 3.6 and 2.7. Over the whole range R doubles from one end to the other. A wide opening makes every disc smaller and every pair easier to split, and since the orbits are fixed in LED this is the knob that carries all seven pairs across the limit together.
// Knob 3: Seeing. How much the air stirs the light, 0 to 1, opening at 0. At 0 the lens is alone: still discs, crisp rings. The share of each disc's light that stays in the diffraction core (the Strehl ratio) is 1 - 0.85 K, and 0.6 of the rest goes into a soft halo 1.97 R across at half height, which sinks the rings (gone by about 0.4) and leaves a blur at 1 with a hot centre. Every source is also shaken on its own by up to 0.45 K R (2.2 LED at the opening and K = 1) in x and y with two sines each of 0.3 to 1.5 Hz that no two sources share, so a pair shivers across the limit. The display floor goes from 1e-3 to 5e-3 and the knee from 0.5 to 0.35 as the knob goes up, and the brightness is lifted by peak^-0.5, x2.0 at 1, so a blur falls off smoothly and does not turn into a flat plate.
// Knob 4: Companion. The brightness of the second source of each pair against the first. Each pair has a ratio q of its own at the opening, 0.85, 0.6, 0.85, 0.65, 0.5, 0.9 and 0.7, and the knob raises it to the power exp(-2 (K - 0.06)). At the opening 0.06 the ratios are as listed. At -1 the power is 8.3: the companions are 0.26, 0.014, 0.26, 0.028, 0.003, 0.42 and 0.05, so most are gone and the few that stay are small faint discs beside a bright one, sometimes lost in the first ring. At 1 the power is 0.15 and every companion is 0.90 to 0.98 of its primary, seven pairs of near equals, which is where the dip at the limit is deepest.
//
// What the picture is. The image plane of a telescope. Each of seven pairs is two point sources too far away to be anything but points. The aperture shows each as an Airy disc, I = (2 J1(x) / x)^2 with x = 3.8317 r / R, R the radius of the first dark ring, and the two discs of a pair add as intensities, since two separate sources do not interfere. The sum goes through a display curve. Two equal discs a distance R apart (Rayleigh) have 0.735 of the peak at the middle, so the pair is two with a waist. At 0.77 R (Sparrow) the middle is 1.13 against a peak of 1.06 and the dip is gone: a flat peanut. Closer than that it is one round lump that is brighter than either disc. The picture is each pair walking through that sequence in both directions at its own pace.
// The orbits. Each pair is a Kepler orbit. The mean anomaly M = 2 pi t / P runs at the pair's period, the eccentric anomaly E comes from M = E - e sin E by four Newton steps from M + e sin M, the position is (a (cos E - e), a sqrt(1 - e^2) sin E), the second axis is shortened by the cosine of the inclination, and the whole is turned on the screen by an angle that precesses once in 160 to 290 s, the sense alternating from pair to pair. The semi-major axis breathes by 12 percent on a clock of its own (97 to 199 s), which is what keeps the orbits from closing on themselves. The periods are 31, 47, 23, 61, 37, 53 and 43 s, all prime. The sizes a are 0.7 to 1.9 R (3.4 to 9.3 LED at the opening), e is 0.2 to 0.6 and the cosine of the inclination 0.5 to 0.95. At the opening wavelength and aperture the separation in units of R runs, over 15 minutes: 0.43 to 1.44, 0.78 to 2.35, 0.22 to 1.18, 1.17 to 2.76, 0.42 to 1.91, 0.60 to 1.14 and 0.42 to 2.33. One pair never merges, one is always two, one hovers on the limit, and the other four cross it. Pooled over the seven, a pair is one lump or a peanut (0.77 R or less) 27 percent of the time, has a waist (between 0.77 R and R) 18 percent and is two 55 percent. The passage from 1 R to 0.77 R takes 1.6 to 2.6 s at the median on the four pairs with e of 0.35, 0.5, 0.55 and 0.6, and about 11 s on the two with e of 0.4 and 0.2. The brighter source of a pair sits nearer the middle, with the barycentre taken by brightness.
// The places. The homes are staggered in two columns, four on the left near x 14 to 19 and three on the right near x 46 to 50, 32 to 35 LED from their nearest neighbours. Each home wanders on two sines per axis, up to 5 to 6 LED either side across the panel and 6 to 7 along it, with periods of 49 to 149 s, so a pair crosses into the next 16 x 16 square of the 4 x 8 grid and its neighbours do not meet.
// The table. J1 is computed once, from Bessel's integral J1(x) = (1/pi) integral over 0 to pi of sin t sin(x sin t) dt, by the trapezoid rule with 32 steps (the integrand is smooth and periodic, so the sum is exact to rounding for x up to 20; the first zero comes out at 3.8317 and the first ring at 0.0175 of the peak). The intensity goes into a table of 2048 steps in x^2, so a lookup needs no square root, and the seeing halo into another. Each frame blends the two by the Seeing knob and every source adds its table into a 64 x 128 buffer within the sixth zero of J1, x = 19.6, which is 5.1 R. The last 7.6 of x fade out smoothly so there is no edge. A frame takes 0.1 to 0.3 ms for the sums, 0.5 ms in the Lab.
// The display. The sum I is drawn with a curve that is logarithmic from 1e-3 (black) to 0.04 (half of full), and from there a power 1.6 to 1. A linear display would show no rings at all. On this curve the three first rings (0.0175, 0.0042 and 0.0016 of the peak) come out at 0.39, 0.19 and 0.06, so two rings read clearly and a third is a trace, and the dip at Rayleigh's limit (0.735) comes out at 0.80, 20 percent where the light is down 26. Whiteness follows the intensity: smoothstep(0.45, 1, I) plus 0.45 T^2 of the rest, so the centre of a disc is white and fades into the colour of the light. At Rayleigh's limit the middle of an equal pair has a whiteness of 0.66 against 1 at its peaks, a coloured waist between two white cores. The ground is a navy (8, 20, 54): a black one leaves the space between the pairs dead, and the navy is the plate that all the light is added to, which keeps the darkest 16 x 16 square at more than half the brightness of an average one.
// What is exact and what is drawn. The Airy intensity, the first zero at 1.22 lambda f / D, the incoherent sum, Rayleigh's 0.735 and Sparrow's 0.77 with their equal discs, the Kepler equation and the way R grows with lambda and with 1 / D are physics. The seeing, a halo and a shake in place of a phase screen, the display curve and its whiteness, the colour map of the spectrum and its paling, the ground, the sizes and eccentricities of the orbits and the places are drawing choices. R is 2.7 to 7.6 LED over the knobs, so a disc is a lump with rings and never a point of one LED. Where Rayleigh's and Sparrow's separations are stated they hold for two equal discs: a faint companion shows no dip and is lost at a larger separation, which the Companion knob shows.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, pow, PI } = Math;
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
// drift periods of each home: two sines along x and two along y (s)
const DRIFT = [
  [71, 127, 89, 53], [83, 109, 97, 61], [59, 131, 103, 67], [97, 73, 79, 139],
  [67, 113, 131, 49], [89, 53, 107, 149], [79, 101, 61, 121],
];
const R1REF = 4.9;           // R at the opening, in LED, which the orbits are sized against

// Kepler: the separation vector of one pair, in LED, at time t, into OUT[0], OUT[1]
const OUT = [0, 0];
function sepAt(i, t) {
  const P = PAIRS[i];
  const e = P[5];
  const aa = P[4] * R1REF * (1 + 0.12 * sin((TAU * t) / (97 + 17 * i) + 1.3 * i));
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

const PLATE = [8, 20, 54];  // the navy ground that all the light is added to
// the display curve: logarithmic from I0 (T = 0) up to the knee IK (T = TK), then a power curve to 1 (T = 1).
// Seeing lifts the floor and lowers the knee, so a blurred lump falls off smoothly and is not a flat plate.
const IK = 0.04, SK = 1 / (1 - IK);

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
    sepAt(i, t);
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

  const sr = 0.1 + 0.9 * SPEC[0], sg = 0.1 + 0.9 * SPEC[1], sb = 0.1 + 0.9 * SPEC[2];
  const I0 = 1e-3 * (1 + 4 * see), TK = 0.5 - 0.15 * see, LK = TK / log(IK / I0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const I = ACC[p];
      const T = I < I0 ? 0 : I < IK ? log(I / I0) * LK : I < 1 ? TK + (1 - TK) * pow((I - IK) * SK, 1.6) : 1;
      const w0 = sm(0.45, 1, I), wh = w0 + (1 - w0) * 0.45 * T * T;
      const v = 255 * T;
      display.setPixel(
        x, y,
        min(255, PLATE[0] + v * (sr + (1 - sr) * wh)) | 0,
        min(255, PLATE[1] + v * (sg + (1 - sg) * wh)) | 0,
        min(255, PLATE[2] + v * (sb + (1 - sb) * wh)) | 0
      );
    }
  }
}
