// ===== Patternflow pattern =====
// Title:   Insolation Map
// Family:  insolation
// Idea:    The chart Milankovitch cycles are explained on, the daily-mean sunlight at the top of the atmosphere with the 64 columns one year and the 128 rows the latitudes from the north pole down to the south pole, computed for every LED from a Kepler orbit whose tilt, eccentricity and longitude of perihelion wander through exaggerated ranges, so the polar-night wedges swell and shrink, the equatorial humps deepen and flatten and the perihelion hot spot slides along the calendar.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chart of daily-mean insolation by latitude and day that Milutin Milankovitch (1941, from memory) used for his theory of the ice ages, computed from Kepler's orbit the way Andre Berger (1978, from memory) did it, with the orbital elements wandering as Jacques Laskar and others (1993, 2004, from memory) found they do; original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tilt=0..3, Eccentricity=-1..1, Pace=0.035..0.12
//
// Knob 1: Hue. Turns the whole ramp toward cooler colours, 150 degrees of hue over the knob's travel. At 0 it is ink indigo, violet, crimson, orange, gold and pale yellow, which is where it opens; at 0.5 navy, blue, violet, magenta, rose, coral and pale peach; at 1 ink green, teal, azure, blue, orchid and pale pink. Every colour keeps its lightness, so the order of the energy never changes. On its own the whole ramp's hue wanders by 45 degrees either way and each stop drifts by itself, see the ramp below, coming up from nothing over the first 20 seconds so that the picture opens on the ramp as it is written here.
// Knob 2: Tilt. How far the axis leans, as a multiple of the wandering obliquity: 0 at 0 (no seasons, the chart is bands of latitude and the eccentricity alone moves the brightness along the calendar), half the wandering tilt at 1, the wandering tilt at 2 where it opens (10.3 to 45 degrees), one and a half times it at 3 (15 to 67, held under 80). The polar circle sits at 90 degrees minus the tilt, so each polar-night wedge is 7 rows tall at 10 degrees, 32 at 45 and 48 at 67.
// Knob 3: Eccentricity. How far the orbit is from a circle, as the wandering eccentricity times 2 to the power 1.15 K3: 0.45 times it at -1, 1 times at 0 where it opens, 2.2 times at 1, never over 0.46. The wandering value runs 0.02 to 0.32. The sun is (1 + e) / (1 - e) squared times brighter at perihelion than at aphelion, 1.07 for the Earth's 0.017, 2.0 at 0.17, 3.8 at 0.32 and 7.3 at the cap, so at the top of the knob one side of the year is a dim violet and the other holds all the gold.
// Knob 4: Pace. How fast the orbit changes. The model clock runs 2.4 times (K4 / 0.06) to the power 0.6 model seconds a second: 1.7 at 0.035, 2.4 where it opens and 3.6 at 0.12. At the opening the perihelion goes round the calendar once in about 35 seconds, 1.8 columns a second, and at 0.12 once in 23. The tilt, the eccentricity, the perihelion and the start of the chart all run on this clock, so the knob speeds them together and changes none of their ranges. The colours do not run on it, they drift at 2.4 model seconds a second whatever the knob says.
//
// What the picture is. Day of the year runs across, 64 columns to a year, 5.7 days a column on a circular orbit, and latitude runs down, 128 rows from the north pole to the south pole, 1.406 degrees a row, the first row at 89.30 north and the last at 89.30 south. Each LED is the daily-mean sunlight at the top of the atmosphere for its day and latitude, Q = (S0 / pi) (a / r)^2 (h0 sin(phi) sin(delta) + cos(phi) cos(delta) sin(h0)), with cos(h0) = -tan(phi) tan(delta), cut to h0 = pi where the sun never sets and to h0 = 0 where it never rises. The declination is sin(delta) = sin(eps) sin(lambda), lambda being the sun's true longitude, and the distance ratio is a / r = (1 + e cos(nu)) / (1 - e^2) with nu = lambda - varpi, varpi being the longitude of perihelion. Nothing else is in it: no air, no cloud, no albedo.
// The calendar is time. Column i is the mean anomaly M = M0 + 2 pi (i + 0.5) / 64, Kepler's equation M = E - e sin(E) is solved for E on all 64 columns by seven Newton steps, and nu follows from E, so the seasons are as unequal as the orbit makes them: at e = 0.3 the half of the year around perihelion lasts 31 percent of it and the other half 69. M0 is the mean anomaly of the vernal equinox plus a start that moves, see below, so the left edge is the first day of the chart and not always the equinox.
// The orbit. Obliquity, eccentricity and longitude of perihelion are each a sum of sines whose periods do not divide, at 2.4 model seconds to a second. Over fifteen minutes the obliquity runs 10.3 to 45.0 degrees (median 27, the Earth's own swing is 22.1 to 24.5) and the eccentricity 0.02 to 0.32 (median 0.17, the Earth's is 0 to 0.06). The perihelion turns once in 83 model seconds with a wobble of 0.3 and 0.2 radian on two sines, which is too small to stop it, so it always goes round the same way. These ranges are exaggerations of the real ones, and the formula does not care.
// The start of the chart. The real calendar is tied to the equinox, so on it the seasons stand still and the perihelion slides. Here the first day of the chart moves 0.12 of a year for every turn of the perihelion, plus a wander of 0.1 of a year, so the seasons drift to the left while the perihelion drifts to the right. It is a choice about where the chart starts. It also makes a return harder: the perihelion, the start, the tilt, the eccentricity and the colours would all have to line up again at once.
// The ramp. Q is divided by the largest Q on the panel at that moment (it follows the maximum up at once and lets go of it over 1.5 seconds), raised to a power that wanders between 0.6 and 1.4, and sent through eight stops in OKLCH: lightness 0.20, 0.30, 0.42, 0.52, 0.62, 0.72, 0.84, 0.96, hue 285 (ink indigo), 295, 322 (violet), 358 (crimson), 20 (red-orange), 55 (orange), 85 (gold), 105 (pale yellow). Chroma is taken down until the colour fits in sRGB. Each stop drifts by itself on three sines that do not divide: its hue by up to 55 degrees (20 for the two ends), its lightness by 0.05 and its place along the ramp by 0.07, so the ramp is a different one a minute from now, a violet that is nearer blue, a gold that is nearer rose. Because the picture is divided by its own maximum, a tilt of 0 does not look dim: the equator is the pale-yellow maximum even though it only gets 433 of the 1361 watts of the solar constant.
// The lines. A line of colour every tenth of the (powered) maximum, nine of them, drawn from the distance to the level in LEDs: the gap between Q and the nearest level over the size of the gradient of Q taken across the neighbouring LEDs, so a line is about 2 LEDs wide where the field is steep and gets narrower where it is flat. Its colour is the ramp's own colour 0.15 higher, a little paler, and brightened by 70 of 255.
// The polar night. Q is 0 there, which is a hole. The picture draws the noon altitude of the sun, 90 - |phi - delta| degrees, which goes below 0 in the polar night. A bright line sits where it is 0, which is the edge of the polar night and exact, and dim lines where it is -6, -12 and -18 degrees, the civil, nautical and astronomical twilights. The twilight is not insolation, it is where the sun comes closest and how far under the horizon at noon, and the ink between the lines darkens to half over 24 degrees. It is drawn so the wedges have a shape and the 16 by 16 block in the corner does not go black.
// What is exact and what is drawn. The formula, Kepler's equation, the declination, the distance ratio and the polar-day and polar-night cut are the real ones, evaluated at the centre of each column and row, not averaged over a column's 5.7 days or a row's 1.4 degrees. The wanders of the three elements and their ranges, the multiplication of tilt and eccentricity by the knobs, the moving start of the chart, the division by the maximum, the power, the ramp with its drifting stops, the lines and the twilight are drawing choices. The knobs are eased over 0.2 s.

const W = 64, H = 128;
const { sqrt, exp, sin, cos, tan, acos, atan, asin, abs, min, max, round, tanh, pow, PI } = Math;
const TAU = 2 * PI, DEG = PI / 180;
const sq = (v) => v * v;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---------------------------------------------------------------- buffers
const QF = new Float32Array(W * H);   // daily-mean insolation, S0 = 1
const AF = new Float32Array(W * H);   // the sun's noon altitude, radians (below zero is polar night)
const CSD = new Float32Array(W), CCD = new Float32Array(W), CTD = new Float32Array(W), CR2 = new Float32Array(W), CDL = new Float32Array(W);
const RSP = new Float32Array(H), RCP = new Float32Array(H), RTP = new Float32Array(H), RLA = new Float32Array(H);
for (let y = 0; y < H; y++) {
  const phi = (90 - (180 * (y + 0.5)) / H) * DEG;
  RSP[y] = sin(phi); RCP[y] = cos(phi); RTP[y] = tan(phi); RLA[y] = phi;
}
const LUTN = 256;
const LUT = new Float32Array((LUTN + 1) * 3);

// ---------------------------------------------------------------- colour
// the ramp, as OKLCH: lightness, chroma, hue in degrees (unwrapped), at u
const STOPS = [
  [0.0, 0.2, 0.1, 285],
  [0.1, 0.3, 0.18, 295],
  [0.25, 0.42, 0.22, 322],
  [0.4, 0.52, 0.22, 358],
  [0.55, 0.62, 0.21, 380],
  [0.7, 0.72, 0.18, 415],
  [0.85, 0.84, 0.16, 445],
  [1.0, 0.96, 0.08, 465],
];
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
// OKLCH to sRGB; a colour outside the gamut keeps its lightness and hue and gets the largest chroma that fits, found by bisection so the ramp has no steps
function lin(L, C, h, o) {
  const a = C * cos(h), b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
}
const fits = (o) => o[0] >= -0.0005 && o[0] <= 1.0005 && o[1] >= -0.0005 && o[1] <= 1.0005 && o[2] >= -0.0005 && o[2] <= 1.0005;
function oklch(L, C, hDeg, o) {
  const h = hDeg * DEG;
  lin(L, C, h, o);
  if (!fits(o)) {
    let lo = 0, hi = C;
    for (let it = 0; it < 12; it++) {
      const mid = 0.5 * (lo + hi);
      lin(L, mid, h, o);
      if (fits(o)) lo = mid; else hi = mid;
    }
    lin(L, lo, h, o);
  }
  o[0] = 255 * enc(cl(o[0], 0, 1)); o[1] = 255 * enc(cl(o[1], 0, 1)); o[2] = 255 * enc(cl(o[2], 0, 1));
}
const TMP = [0, 0, 0];
// each stop of the ramp drifts on its own: its hue by up to 22 degrees, its lightness by 0.03 and its place along the ramp by 0.035
const SPH = STOPS.map((_, i) => [1.3 * i + 0.4, 2.1 * i + 1.9, 0.7 * i + 4.2]);
const SPP = STOPS.map((_, i) => [41.3 + 6.7 * i, 73.1 + 9.1 * i, 29.9 + 3.3 * i]);
const SP = new Float32Array(STOPS.length), SL = new Float32Array(STOPS.length), SH = new Float32Array(STOPS.length);
function buildLut(hueShift, T, env) {
  for (let i = 0; i < STOPS.length; i++) {
    const w1 = sin((TAU * T) / SPP[i][0] + SPH[i][0]), w2 = sin((TAU * T) / SPP[i][1] + SPH[i][1]), w3 = sin((TAU * T) / SPP[i][2] + SPH[i][2]);
    const edge = i === 0 || i === STOPS.length - 1;
    SH[i] = STOPS[i][3] + hueShift + env * (edge ? 20 : 55) * (0.6 * w1 + 0.4 * w2);
    SL[i] = STOPS[i][1] + env * (edge ? 0 : 0.05) * w2;
    SP[i] = edge ? STOPS[i][0] : STOPS[i][0] + env * 0.07 * w3;
  }
  for (let i = 0; i <= LUTN; i++) {
    const u = i / LUTN;
    let j = 0;
    while (j < STOPS.length - 2 && u > SP[j + 1]) j++;
    const f = cl((u - SP[j]) / (SP[j + 1] - SP[j]), 0, 1);
    oklch(SL[j] + (SL[j + 1] - SL[j]) * f, STOPS[j][2] + (STOPS[j + 1][2] - STOPS[j][2]) * f, SH[j] + (SH[j + 1] - SH[j]) * f, TMP);
    LUT[i * 3] = TMP[0]; LUT[i * 3 + 1] = TMP[1]; LUT[i * 3 + 2] = TMP[2];
  }
}

// ---------------------------------------------------------------- state
const sw = (T, ph, per, amp) => {
  let s = 0;
  for (let i = 0; i < per.length; i++) s += amp[i] * sin((TAU * T) / per[i] + ph[i]);
  return s;
};
const EPS_PER = [57.3, 89.7, 141.1], EPS_AMP = [0.55, 0.4, 0.3], EPS_PH = [0.9, 2.3, 4.1];
const ECC_PER = [43.7, 71.3, 119.9], ECC_AMP = [0.5, 0.4, 0.3], ECC_PH = [3.4, 0.6, 5.0];
const PRE_PER = [47.9, 131.3], PRE_AMP = [0.3, 0.2], PRE_PH = [1.7, 4.4];
const HUE_PER = [67.1, 113.9, 29.3], HUE_AMP = [0.5, 0.35, 0.15], HUE_PH = [2.2, 5.5, 0.4];
const PIN_PER = [61.7, 107.3], PIN_AMP = [0.6, 0.5], PIN_PH = [0.3, 2.9];
const GAM_PER = [53.9, 97.3, 163.1], GAM_AMP = [0.5, 0.3, 0.25], GAM_PH = [4.8, 1.1, 3.0];

function elements(T, k, TP, env) {
  const tilt = cl(k[1], 0, 3) / 2;
  const epsW = (27.5 + 17.5 * tanh(1.4 * sw(T, EPS_PH, EPS_PER, EPS_AMP) / 1.25) / tanh(1.4)) * DEG;
  const eW = 0.17 + 0.15 * tanh(1.4 * sw(T, ECC_PH, ECC_PER, ECC_AMP) / 1.2) / tanh(1.4);
  const varpi = (TAU * T) / 83 + sw(T, PRE_PH, PRE_PER, PRE_AMP) + 5.2;
  return {
    eps: min(epsW * tilt, 80 * DEG),
    ecc: cl(eW * pow(2, 1.15 * cl(k[2], -1, 1)), 0.003, 0.46),
    varpi,
    x0: (0.12 * (varpi - 5.2)) / TAU + 0.1 * sw(T, PIN_PH, PIN_PER, PIN_AMP),
    hs: -150 * cl(k[0], 0, 1) + env * 45 * sw(TP, HUE_PH, HUE_PER, HUE_AMP),
    gam: 1.0 + env * 0.4 * tanh(sw(TP, GAM_PH, GAM_PER, GAM_AMP)),
    tp: TP,
    env,
  };
}

export function setup(params) {
  params.s = { t: 0, T: 0, dt: 1 / 30, k: null, qm: 0, E: null };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.2);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.dt = d;
  S.t += d;
  S.T += d * pow(S.k[3] / 0.06, 0.6) * 2.4;
  S.E = elements(S.T, S.k, S.t * 2.4, sm(0, 20, S.t));
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.E) return;
  const T = S.T, E = S.E;
  const { eps, ecc, varpi, x0, hs, gam, tp, env } = E;

  // ---- the calendar: mean anomaly from the vernal equinox, Kepler's equation, true anomaly
  const beta = ecc / (1 + sqrt(1 - ecc * ecc)), ome2 = 1 - ecc * ecc, sEps = sin(eps);
  const nuV = -varpi;
  const Ev = nuV - 2 * atan(beta * sin(nuV) / (1 + beta * cos(nuV)));
  const Mve = Ev - ecc * sin(Ev);
  for (let x = 0; x < W; x++) {
    const f = (x + 0.5) / W + x0;
    const M = Mve + TAU * f;
    let Ek = M + ecc * sin(M);
    for (let it = 0; it < 7; it++) Ek -= (Ek - ecc * sin(Ek) - M) / (1 - ecc * cos(Ek));
    const nu = Ek + 2 * atan((beta * sin(Ek)) / (1 - beta * cos(Ek)));
    const lam = nu + varpi;
    const rho = (1 + ecc * cos(nu)) / ome2;
    const sd = sEps * sin(lam), cd = sqrt(1 - sd * sd);
    CSD[x] = sd; CCD[x] = cd; CTD[x] = sd / cd; CR2[x] = rho * rho; CDL[x] = asin(sd);
  }
  // ---- the field: Q = (1/pi) (a/r)^2 (h0 sin(phi) sin(delta) + cos(phi) cos(delta) sin(h0)), S0 = 1
  let qmax = 0;
  for (let y = 0; y < H; y++) {
    const sp = RSP[y], cp = RCP[y], tp = RTP[y], phi = RLA[y];
    for (let x = 0; x < W; x++) {
      const c = -tp * CTD[x];
      const h0 = c >= 1 ? 0 : c <= -1 ? PI : acos(c);
      const q = (CR2[x] / PI) * (h0 * sp * CSD[x] + cp * CCD[x] * sqrt(max(0, 1 - c * c)));
      const o = y * W + x;
      QF[o] = c >= 1 ? 0 : q;
      AF[o] = PI / 2 - abs(phi - CDL[x]);
      if (q > qmax && c < 1) qmax = q;
    }
  }
  S.qm = max(qmax, S.qm * exp(-S.dt / 1.5) + qmax * (1 - exp(-S.dt / 1.5)));
  const qm = S.qm, iq = 1 / qm;

  // ---- palette
  buildLut(hs, tp, env);

  // ---- paint
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? y - 1 : 0, yp = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < W; x++) {
      const o = y * W + x, xm = x > 0 ? x - 1 : W - 1, xp = x < W - 1 ? x + 1 : 0;
      const u0 = QF[o] * iq, al = AF[o], u = pow(u0 > 0.004 ? u0 : 0.004, gam), gch = gam * u / (u0 > 0.004 ? u0 : 0.004);
      let r, g, b;
      const ga = sqrt(sq(AF[y * W + xp] - AF[y * W + xm]) + sq(AF[yp * W + x] - AF[ym * W + x])) * 0.5 * (180 / PI);
      const gad = max(ga, 0.4), ad = al * (180 / PI);
      if (al > 0) {
        const li = ((u > 1 ? 1 : u) * LUTN) | 0;
        r = LUT[li * 3]; g = LUT[li * 3 + 1]; b = LUT[li * 3 + 2];
      } else {
        const dd = sm(0, 24, -ad);
        r = LUT[0] * (1 - 0.5 * dd); g = LUT[1] * (1 - 0.5 * dd); b = LUT[2] * (1 - 0.5 * dd);
      }
      // the twilight lines, 6, 12 and 18 degrees of the noon sun below the horizon, and the edge of the polar night
      if (ad < 0.8) {
        const dep = -ad, kt = round(dep / 6);
        if (kt >= 1 && kt <= 3) {
          const a = (1 - sm(0.35, 1.2, abs(dep - kt * 6) / gad)) * (kt === 1 ? 0.8 : kt === 2 ? 0.6 : 0.45);
          if (a > 0) {
            r += (LUT[30] * 0.9 + 25 - r) * a; g += (LUT[31] * 0.9 + 25 - g) * a; b += (LUT[32] * 0.9 + 25 - b) * a;
          }
        }
        const a = 1 - sm(0.55, 1.6, abs(ad) / gad);
        if (a > 0) {
          const li = (0.3 * LUTN) | 0;
          r += (min(255, LUT[li * 3] * 0.8 + 90) - r) * a; g += (min(255, LUT[li * 3 + 1] * 0.8 + 90) - g) * a; b += (min(255, LUT[li * 3 + 2] * 0.8 + 90) - b) * a;
        }
      }
      // contour lines of u, every tenth of the maximum
      if (al > 0) {
        const gx = (QF[y * W + xp] - QF[y * W + xm]) * 0.5 * iq, gy = (QF[yp * W + x] - QF[ym * W + x]) * 0.5 * iq;
        const gm = max(sqrt(gx * gx + gy * gy) * gch, 0.012);
        const t = u * 10, kk = round(t);
        if (kk >= 1 && kk <= 9) {
          const a = 1 - sm(0.35, 1.2, (abs(t - kk) * 0.1) / gm);
          if (a > 0) {
            const li = (min(1, kk * 0.1 + 0.15) * LUTN) | 0;
            r += (min(255, LUT[li * 3] * 0.8 + 70) - r) * a;
            g += (min(255, LUT[li * 3 + 1] * 0.8 + 70) - g) * a;
            b += (min(255, LUT[li * 3 + 2] * 0.8 + 70) - b) * a;
          }
        }
      }
      display.setPixel(x, y, r + 0.5 | 0, g + 0.5 | 0, b + 0.5 | 0);
    }
  }
}
