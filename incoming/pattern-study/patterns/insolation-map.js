// ===== Patternflow pattern =====
// Title:   Insolation Map
// Family:  insolation
// Idea:    The chart climate scientists draw Milankovitch cycles on, daily-mean sunlight at the top of the atmosphere with the 64 columns one year and the 128 rows the latitudes from the north pole down to the south pole, computed for every LED from a Kepler orbit whose tilt, eccentricity and longitude of perihelion wander through exaggerated ranges, so the polar-night wedges swell and shrink, the equatorial double hump merges and collapses and the perihelion hot spot slides along the calendar.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tilt=0..3, Eccentricity=-1..1, Pace=0.035..0.18
//
// Knob 1: draft
// Knob 2: draft
// Knob 3: draft
// Knob 4: draft

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, tan, acos, atan2, abs, min, max, round, tanh, pow, PI } = Math;
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
function oklch(L, C, hDeg, o) {
  const h = hDeg * DEG;
  for (let it = 0; it < 12; it++) {
    const a = C * cos(h), b = C * sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    if ((r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && bl >= -0.001 && bl <= 1.001) || it === 11) {
      o[0] = 255 * enc(cl(r, 0, 1)); o[1] = 255 * enc(cl(g, 0, 1)); o[2] = 255 * enc(cl(bl, 0, 1));
      return;
    }
    C *= 0.85;
  }
}
const TMP = [0, 0, 0];
// each stop of the ramp drifts on its own: its hue by up to 22 degrees, its lightness by 0.03 and its place along the ramp by 0.035
const SPH = STOPS.map((_, i) => [1.3 * i + 0.4, 2.1 * i + 1.9, 0.7 * i + 4.2]);
const SPP = STOPS.map((_, i) => [41.3 + 6.7 * i, 73.1 + 9.1 * i, 29.9 + 3.3 * i]);
const SP = new Float32Array(STOPS.length), SL = new Float32Array(STOPS.length), SH = new Float32Array(STOPS.length);
function buildLut(hueShift, T) {
  for (let i = 0; i < STOPS.length; i++) {
    const w1 = sin((TAU * T) / SPP[i][0] + SPH[i][0]), w2 = sin((TAU * T) / SPP[i][1] + SPH[i][1]), w3 = sin((TAU * T) / SPP[i][2] + SPH[i][2]);
    const edge = i === 0 || i === STOPS.length - 1;
    SH[i] = STOPS[i][3] + hueShift + (edge ? 8 : 22) * (0.6 * w1 + 0.4 * w2);
    SL[i] = STOPS[i][1] + (edge ? 0 : 0.03) * w2;
    SP[i] = edge ? STOPS[i][0] : STOPS[i][0] + 0.035 * w3;
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
const MIX_PER = [73.3, 127.1, 37.9], MIX_AMP = [0.5, 0.4, 0.25], MIX_PH = [1.4, 3.8, 5.9];
const LAT_PER = [59.9, 101.3, 33.1], LAT_AMP = [0.5, 0.4, 0.25], LAT_PH = [5.1, 0.2, 2.6];
const GAM_PER = [53.9, 97.3, 163.1], GAM_AMP = [0.5, 0.3, 0.25], GAM_PH = [4.8, 1.1, 3.0];

function elements(T, k) {
  const tilt = cl(k[1], 0, 3) / 2;
  const epsW = (27.5 + 17.5 * tanh(1.4 * sw(T, EPS_PH, EPS_PER, EPS_AMP) / 1.25) / tanh(1.4)) * DEG;
  const eW = 0.17 + 0.15 * tanh(1.4 * sw(T, ECC_PH, ECC_PER, ECC_AMP) / 1.2) / tanh(1.4);
  const varpi = (TAU * T) / 83 + sw(T, PRE_PH, PRE_PER, PRE_AMP) + 5.2;
  return {
    eps: min(epsW * tilt, 80 * DEG),
    ecc: cl(eW * pow(2, 1.3 * cl(k[2], -1, 1)), 0.003, 0.55),
    varpi,
    x0: (0.3 * (varpi - 5.2)) / TAU + 0.1 * sw(T, PIN_PH, PIN_PER, PIN_AMP),
    mx: 0.5 + 0.5 * tanh(1.5 * sw(T, MIX_PH, MIX_PER, MIX_AMP)),
    ny: 0.3 + 0.3 * tanh(sw(T, LAT_PH, LAT_PER, LAT_AMP)),
    hs: -150 * cl(k[0], 0, 1) + 24 * sw(T, HUE_PH, HUE_PER, HUE_AMP),
    gam: 1.0 + 0.22 * tanh(sw(T, GAM_PH, GAM_PER, GAM_AMP)),
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
  S.T += d * (S.k[3] / 0.06) * 2.4;
  S.E = elements(S.T, S.k);
}

// ---------------------------------------------------------------- draw
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.E) return;
  const T = S.T, E = S.E;
  const { eps, ecc, varpi, x0, mx, ny, hs, gam } = E;

  // ---- the calendar: mean anomaly from the vernal equinox, Kepler's equation, true anomaly
  const beta = ecc / (1 + sqrt(1 - ecc * ecc)), ome2 = 1 - ecc * ecc, sEps = sin(eps);
  const nuV = -varpi;
  const Ev = nuV - 2 * Math.atan(beta * sin(nuV) / (1 + beta * cos(nuV)));
  const Mve = Ev - ecc * sin(Ev);
  for (let x = 0; x < W; x++) {
    const f = (x + 0.5) / W + x0;
    const M = Mve + TAU * f;
    let E = M + ecc * sin(M);
    for (let it = 0; it < 7; it++) E -= (E - ecc * sin(E) - M) / (1 - ecc * cos(E));
    const lamM = E + 2 * Math.atan((beta * sin(E)) / (1 - beta * cos(E))) + varpi;
    const lam = lamM + mx * (TAU * f - lamM);
    const nu = lam - varpi;
    const rho = (1 + ecc * cos(nu)) / ome2;
    const sd = sEps * sin(lam), cd = sqrt(1 - sd * sd);
    CSD[x] = sd; CCD[x] = cd; CTD[x] = sd / cd; CR2[x] = rho * rho; CDL[x] = Math.asin(sd);
  }
  // rows: latitude, linear in degrees at 0 and in its sine (equal area) at 1
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / H, phl = (0.5 - fy) * PI, phs = Math.asin(1 - 2 * fy), phi = phl + ny * (phs - phl);
    RSP[y] = sin(phi); RCP[y] = cos(phi); RTP[y] = tan(phi); RLA[y] = phi;
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
  buildLut(hs, T);

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
