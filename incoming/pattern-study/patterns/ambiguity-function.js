// ===== Patternflow pattern =====
// Title:   Ambiguity Function
// Family:  ambiguity
// Idea:    The ambiguity function of a radar waveform, a train of chirped Gaussian pulses in two interleaved repetition intervals, drawn as its squared magnitude in decibels over the whole panel, delay down and Doppler across, so that a chirp leans the ridge, more pulses thin the Doppler peaks into a bed of nails, and staggering the intervals wipes out the repeated peaks, while the waveform drifts from one shape to the next without a pause.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ambiguity function of a radar waveform, chi(tau, nu) = integral of u(t) u*(t - tau) exp(j 2 pi nu t) dt (Philip Woodward, Probability and Information Theory, with Applications to Radar, 1953, from memory), the closed form of the chirped Gaussian pulse and the sum over a pulse train of lagged copies of it, each with its own Doppler factor (radar textbooks, from memory, derived again here and checked by numerical integration), staggered pulse repetition intervals against blind speeds (radar practice, from memory), a decibel scale in colour bands; original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pulses=0..4, Chirp=-1..1, Scale=-1..1
//
// Knob 1: Hue. Turns the three brightest bands of the scale, teal, lime and the white of the peak, round the colour wheel, one turn over the range; the three darkest, navy, indigo and violet-blue, stay where they are so the floor never goes brown. At 0 the scale runs navy, indigo, violet-blue, teal, lime and, at the peak, white. A drift of 0.06 and 0.03 of a turn (97 and 53.7 model seconds) rides on it.
// Knob 2: Pulses. How many pulses the train aims for: 3.6 at 0, 5.6 at the opening 2, 8.2 at 4 (a line to 2, another from 2). The count drawn is 2.6 + (aim - 2.6) x (0.3 + 0.7 u), u swinging between 0 and 1 on clocks of 53 and 29 s, so over 15 minutes it sat 90 percent of the time between 3.0 and 3.5 at 0 (median 3.2), 3.7 and 5.5 at 2 (median 4.5) and 4.6 and 7.9 at 4 (median 6.3), and a pulse fades in with its weight and not with a jump. More pulses make the Doppler peaks thinner: the width of a peak is about the spacing of the peaks divided by the count.
// Knob 3: Chirp. How hard the pulses sweep, as the slope of the ridge on the panel: columns of Doppler for each row of delay, 1.8 x the knob plus a swing of 1.5, 0.8 and 0.5 (41, 23.7 and 17.3 s) that passes through zero. At 0 the slope runs from -2.7 to 2.7 (a slope of 1 is 45 degrees, 90 percent of the time -1.7 to 1.8); at -1 it sat between -4.5 and 0.9 with a median of -1.8, at 1 between -0.9 and 4.5 with a median of 1.8. The knob also tilts the lattice of peaks: a phase of pi q n^2 across the pulses with q = 0.4 x the knob plus 0.26 and 0.14 of swing, which slides each row of peaks sideways by q of their spacing from the one before when the pulses are evenly spaced.
// Knob 4: Scale. How long the waveform is, all its lengths together: the spacing of the pulses is 38 x 2^(0.8 x knob) rows, 21.8 at -1, 39.3 at the opening 0.06 and 66.2 at 1, with the pulse width 0.32 of it, and a swing of 28 and 14 percent (37 and 59 s). Stretching it in delay squeezes it in Doppler by the same factor: the peaks come 800 / spacing columns apart, 37 at -1, 20 at 0 and 12 at 1.
//
// What the picture is. The ambiguity function says how well a radar waveform tells one echo from another that is a little later (delay tau) and a little faster (Doppler nu). Here delay runs down the panel in rows and Doppler across it in columns, every LED shows the squared magnitude |chi|^2 in decibels, 0 dB at the origin, and the origin is the one point of symmetry: |chi(-tau, -nu)| = |chi(tau, nu)|, which the code gives to 1e-14 (and the origin is the highest point of the plane, as the theory says it must be). The waveform is the thing that changes. No frame, axis, ring or number is drawn.
// The waveform. A chip is a Gaussian pulse exp(-t^2 / 2 t0^2) with a quadratic phase, so its own ambiguity function is the closed form |chi1|^2 = exp(-(tau^2 + (pi t0^2 nu + c tau)^2) / t0^2), c the chirp: an ellipse of fixed area, sheared as c grows (the volume under the plane cannot be changed, only moved), and the ridge of a chirp is the line nu = -c tau / (pi t0^2). A train puts up to 9 chips at the times (n >> 1) P + (n & 1) T1: two interleaved trains of period P, the odd one T1 late, and rho = T1 / P runs from 0.5 (even spacing P / 2) down to 0.28 (spacing 0.28 P and 0.72 P, a staggered interval). Each chip has a weight (1 - tp) + tp sin^2(pi (n + 0.5) / N), a Hann taper that keeps the Doppler sidelobes low, and a phase pi q n^2.
// How it is computed. chi(tau, nu) is the sum over all pairs of chips (n, m) of c_n c_m* exp(j pi nu (t_n + t_m)) |chi1(tau - (t_n - t_m), nu)|: the common phase exp(j pi nu tau) is dropped, which a magnitude does not need. The pairs fall into three sets by offset (even-even and odd-odd at 0, even-odd at +T1, odd-even at -T1), each a lattice of period P, so a table of the complex weight of every lag and column is built once a frame (81 pairs by 65 columns), and a row only adds the few lattice terms that reach it (those within 3.75 t0, where the Gaussian is down 61 dB). The cross term of a chirp between delay and Doppler is a geometric series along a row, so the inner loop is multiplications and no exponentials. The panel is evaluated at the 65 x 129 corners of the LED grid and an LED shows the mean power of its four corners, which fills the nulls that fall between LEDs. The formula was checked against a brute-force numerical integral of chi for four trains of 3.4 to 8.6 pulses, staggered and not, chirped and not, at 14 points each: the largest difference in normalised power was 6e-5. A frame is about 0.85 ms in Node.
// How a level is coloured. 10 log10 of the power is mapped to s = 6 (1 - (-dB / 37.6)^0.62), and the six colour bands are the integer steps of s: white within 2.1 dB of the top, lime to 6.4, teal to 12.3, violet-blue to 19.6, indigo to 28, and below that the navy floor, so the bands are about as wide as each other on a Gaussian peak and teal and lime keep to the ridges and the peaks. The scale rises, by its brightest channel, from a navy of 41/255 and an indigo of 66 through a violet-blue of 117 and a teal of 178 to a lime yellow and white, in hue, saturation and value together, so the peaks shine on a dark ground. An LED takes the mean of the band colours over s plus and minus 0.75 of its gradient, 1.5 LED across, from a running integral of the staircase, so that a band narrower than that fades into its neighbours and does not alias. No contour line is drawn.
// The floor. Under the waveform lies a noise floor at -24 dB, five plane waves of level of 3.2 dB each (waves of 34 to 73 LEDs, each stretching by 20 percent, that turn and slide), added as power. It reaches the indigo and violet-blue bands and shows as faint clouds. It is drawn, not computed from the waveform: the Gaussian chips have no sidelobes of their own, and without it the plane between the peaks is a flat navy that the eye takes for a hole in the picture.
// How it moves. All clocks run at 1.6 times the Lab's. Every parameter swings on one to four sines that do not divide: the pulse count (53, 29 s), the slope (41, 23.7, 17.3), the lattice tilt (61, 31), the spacing (37, 59), the pulse width (47, 71, 27.1), the Hann mix tp (79, 19), the stagger (73, 37.7, 21.9), the area per unit of time x bandwidth, which squeezes delay against Doppler (67, 39.3, a factor of 1.74 to either side of 800 LEDs squared), the hue (97, 53.7) and the origin, which wanders 24 columns and 50 rows from the centre of the panel (83, 47.3, 29.3 and 101, 61.7, 37.1). Nothing accumulates: the picture is a function of time and the knobs, easing over 0.2 s.
// What is exact and what is drawn. The ambiguity function of the train, its symmetry, the closed form of the chirped Gaussian, the Dirichlet-like thinning of the peaks with the pulse count and the loss of the repeated peaks under staggering are the theory, computed. The pulse shape, the Hann taper, the weights of the knobs, the drift of the waveform, the wandering origin, the noise floor, the dB scale and its colours are drawing choices.

const W = 64, H = 128, CW = W + 1, CH = H + 1;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const CELL0 = 800;          // LED^2 per unit of time x bandwidth, at its centre
const MAXN = 9;             // chips in the train, at most

// ---------------------------------------------------------------- colour
function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const RAMP = [
  [0.665, 0.85, 0.16, 0],
  [0.690, 0.82, 0.26, 0],
  [0.660, 0.70, 0.46, 0],
  [0.500, 0.88, 0.70, 1],
  [0.200, 0.78, 0.95, 1],
  [0.150, 0.08, 1.00, 1],
];
const NB = RAMP.length;
const COL = new Float64Array(NB * 3), CUM = new Float64Array((NB + 1) * 3);
function buildRamp(hue) {
  const o = [0, 0, 0];
  for (let b = 0; b < NB; b++) {
    const R = RAMP[b];
    hsv(R[0] + hue * R[3], R[1], R[2], o);
    COL[b * 3] = o[0] * 255; COL[b * 3 + 1] = o[1] * 255; COL[b * 3 + 2] = o[2] * 255;
  }
  for (let b = 0; b < NB; b++) for (let c = 0; c < 3; c++) CUM[(b + 1) * 3 + c] = CUM[b * 3 + c] + COL[b * 3 + c];
}
const IC = [0, 0, 0];
function cumAt(s) {
  // the integral of the staircase of band colours from 0 to s; the first and last colours run on past the ends
  let b = s < 0 ? 0 : s >= NB ? NB - 1 : s | 0;
  const f = s - b;
  IC[0] = CUM[b * 3] + COL[b * 3] * f;
  IC[1] = CUM[b * 3 + 1] + COL[b * 3 + 1] * f;
  IC[2] = CUM[b * 3 + 2] + COL[b * 3 + 2] * f;
}

// ---------------------------------------------------------------- the field
// The chips sit at t = (n >> 1) P + (n & 1) T1: two interleaved trains of period P, the odd one T1 late.
// Pairs of chips then fall into three sets by their offset: 0 (even-even and odd-odd), +T1 and -T1 (even-odd and odd-even),
// each on a lattice of period P. T1 = P / 2 is the plain train of spacing P / 2.
const KP = 4, NKP = 2 * KP + 1, NSET = 3, NT = NSET * NKP;
const TRE = new Float64Array(NT * CW), TIM = new Float64Array(NT * CW);
const H0R = new Float64Array(NT), H0I = new Float64Array(NT), USED = new Uint8Array(NT);
const P3 = new Float64Array(CW), RE = new Float64Array(CW), IM = new Float64Array(CW);
const PW = new Float64Array(CW * CH);
const SL = new Float32Array(W * H);
const CR = new Float64Array(MAXN), CI = new Float64Array(MAXN), TN = new Float64Array(MAXN);
const ER = new Float64Array(MAXN), EI = new Float64Array(MAXN);
const NPAIR = MAXN * MAXN;
const PIX = new Int32Array(NPAIR), PA = new Int32Array(NPAIR), PB = new Int32Array(NPAIR), PWR2 = new Float64Array(NPAIR), PWI2 = new Float64Array(NPAIR);

// power of the ambiguity function of a train of chirped Gaussian chips, normalised to 1 at the origin (ox, oy), in corner coordinates
function field(N, P, rho, t0, sh, q, tp, ox, oy, CELL) {
  const c = ((PI * t0 * t0) / CELL) * sh;   // chip chirp, set so that the ridge leans at the slope sh
  const m = min(MAXN, ceil(N - 0.5 - 1e-9));
  const t02 = t0 * t0, g1 = 1 + c * c, T1 = rho * P;
  for (let n = 0; n < m; n++) {
    const hs = sin((PI * (n + 0.5)) / N), w = 1 - tp + tp * hs * hs, ph = PI * q * n * n;
    CR[n] = w * cos(ph); CI[n] = w * sin(ph);
    TN[n] = (n >> 1) * P + (n & 1) * T1;
  }
  // c_n conj(c_m) for every ordered pair, filed under its set and its lag
  USED.fill(0); H0R.fill(0); H0I.fill(0); TRE.fill(0); TIM.fill(0);
  let np = 0;
  for (let n = 0; n < m; n++)
    for (let l = 0; l < m; l++) {
      const e = (n & 1) - (l & 1), idx = (e === 0 ? 0 : e === 1 ? 1 : 2) * NKP + ((n >> 1) - (l >> 1)) + KP;
      const wr = CR[n] * CR[l] + CI[n] * CI[l], wi = CI[n] * CR[l] - CR[n] * CI[l];
      PIX[np] = idx; PA[np] = n; PB[np] = l; PWR2[np] = wr; PWI2[np] = wi; np++;
      USED[idx] = 1; H0R[idx] += wr; H0I[idx] += wi;
    }
  // the value at the origin, which is the energy of the waveform
  let e0r = 0, e0i = 0;
  for (let s = 0; s < NSET; s++) {
    const off = s === 0 ? 0 : s === 1 ? T1 : -T1;
    for (let k = -KP; k <= KP; k++) {
      const idx = s * NKP + k + KP;
      if (!USED[idx]) continue;
      const d = k * P + off, A = exp((-g1 * d * d) / (2 * t02));
      e0r += A * H0R[idx]; e0i += A * H0I[idx];
    }
  }
  const inv = 1 / (e0r * e0r + e0i * e0i);
  const kx = (PI * t02) / CELL, w1 = PI / CELL;
  for (let i = 0; i < CW; i++) {
    const yc = i - ox, xi = kx * yc;
    P3[i] = exp((-xi * xi) / (2 * t02));
    for (let n = 0; n < m; n++) { ER[n] = cos(w1 * yc * TN[n]); EI[n] = sin(w1 * yc * TN[n]); }
    for (let p = 0; p < np; p++) {
      const a = PA[p], b = PB[p], er = ER[a] * ER[b] - EI[a] * EI[b], ei = ER[a] * EI[b] + EI[a] * ER[b];
      const o = PIX[p] * CW + i;
      TRE[o] += PWR2[p] * er - PWI2[p] * ei; TIM[o] += PWR2[p] * ei + PWI2[p] * er;
    }
  }
  const beta = (c * PI) / CELL, reach = 3.75 * t0;
  for (let j = 0; j < CH; j++) {
    const yr = j - oy;
    RE.fill(0); IM.fill(0);
    for (let s = 0; s < NSET; s++) {
      const off = s === 0 ? 0 : s === 1 ? T1 : -T1;
      for (let kk = max(-KP, ceil((yr - off - reach) / P)); kk <= min(KP, floor((yr - off + reach) / P)); kk++) {
        const idx = s * NKP + kk + KP;
        if (!USED[idx]) continue;
        const u = yr - kk * P - off;
        const P1 = exp((-g1 * u * u) / (2 * t02));
        const rate = exp(-beta * u);
        let p2 = P1 * exp(beta * u * ox);
        const row = idx * CW;
        for (let i = 0; i < CW; i++) {
          const a = p2 * P3[i];
          RE[i] += a * TRE[row + i]; IM[i] += a * TIM[row + i];
          p2 *= rate;
        }
      }
    }
    const base = j * CW;
    for (let i = 0; i < CW; i++) PW[base + i] = (RE[i] * RE[i] + IM[i] * IM[i]) * inv;
  }
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 48; i++) ph.push(TAU * Math.random());
  params.s = { t: 51, k: null, ph, hue: -9 }; // opens 51 model seconds in, where the opening frame is a lattice of peaks round a bright one
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d * 1.6;
}

const LDB = 37.6, PWR = 0.62;
// the floor: plane waves of level, drawn
const NW = 5;
const FX = new Float64Array(NW * W * 2), FY = new Float64Array(NW * H * 2);
const FOG = new Float64Array(W * H);
const FOGL = -24, FOGA = 3.2;
function fog(T, p) {
  for (let w = 0; w < NW; w++) {
    const lam = [34, 47, 61, 41, 73][w] * (1 + 0.2 * sin((TAU * T) / (79 + 11 * w) + p[24 + w]));
    const th = p[29 + w] + 0.7 * sin((TAU * T) / (97 + 13 * w) + p[34 + w]), ph = p[39 + w] + ((TAU * T) / (43 + 9 * w)) * (w & 1 ? -1 : 1);
    const kx = (TAU / lam) * cos(th), ky = (TAU / lam) * sin(th);
    for (let x = 0; x < W; x++) { FX[(w * W + x) * 2] = sin(kx * (x - 32) + ph); FX[(w * W + x) * 2 + 1] = cos(kx * (x - 32) + ph); }
    for (let y = 0; y < H; y++) { FY[(w * H + y) * 2] = sin(ky * (y - 64)); FY[(w * H + y) * 2 + 1] = cos(ky * (y - 64)); }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let w = 0; w < NW; w++) s += FX[(w * W + x) * 2] * FY[(w * H + y) * 2 + 1] + FX[(w * W + x) * 2 + 1] * FY[(w * H + y) * 2];
      FOG[y * W + x] = exp(0.23026 * (FOGL + FOGA * s));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const T = S.t, k = S.k, p = S.ph;
  const sn = (per, i) => sin((TAU * T) / per + p[i]);
  const hue = k[0] + 0.06 * sn(97, 16) + 0.03 * sn(53.7, 17);
  if (abs(S.hue - hue) > 0.0005) { buildRamp(hue); S.hue = hue; }

  const K2 = cl(k[1], 0, 4), Nk = K2 < 2 ? 3.6 + K2 : 5.6 + 1.3 * (K2 - 2);
  const N = cl(2.6 + (Nk - 2.6) * (0.3 + 0.7 * (0.5 + 0.38 * sn(53, 0) + 0.2 * sn(29, 1))), 1.2, MAXN - 0.6);
  const sh = 1.8 * k[2] + 1.5 * sn(41, 2) + 0.8 * sn(23.7, 3) + 0.5 * sn(17.3, 22);
  const Tp = 38 * pow(2, 0.8 * k[3]) * (1 + 0.28 * sn(37, 4) + 0.14 * sn(59, 5));
  const r = 0.32 + 0.1 * sn(47, 6) + 0.05 * sn(71, 7) + 0.04 * sn(27.1, 23);
  const q = 0.4 * k[2] + 0.26 * sn(61, 8) + 0.14 * sn(31, 9);
  const tp = 0.85 + 0.1 * sn(79, 10) + 0.05 * sn(19, 11);
  const ox = 32 + 14 * sn(83, 12) + 6 * sn(47.3, 13) + 4 * sn(29.3, 44), oy = 64 + 30 * sn(101, 14) + 12 * sn(61.7, 15) + 8 * sn(37.1, 45);
  const cell = CELL0 * pow(2, 0.5 * sn(67, 18) + 0.3 * sn(39.3, 19));
  const rho = 0.5 - 0.22 * sm(0.2, 0.8, 0.5 + 0.4 * sn(73, 20) + 0.3 * sn(37.7, 21) + 0.2 * sn(21.9, 46));
  fog(T, p);
  render(display, N, 2 * Tp, rho, Tp * r, sh, q, tp, ox, oy, cell);
}

function render(display, N, P, rho, t0, sh, q, tp, ox, oy, cell) {
  field(N, P, rho, t0, sh, q, tp, ox, oy, cell);
  const sc = 1 / LDB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * CW + x;
      const pw = 0.25 * (PW[a] + PW[a + 1] + PW[a + CW] + PW[a + CW + 1]) + FOG[y * W + x];
      const L = pw > 1e-5 ? 4.3429 * log(pw) : -50;
      SL[y * W + x] = NB * (1 - pow(cl(-L, 0, LDB) * sc, PWR));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * W + x;
      const xl = x > 0 ? a - 1 : a, xr = x < W - 1 ? a + 1 : a, yu = y > 0 ? a - W : a, yd = y < H - 1 ? a + W : a;
      const gx = 0.5 * (SL[xr] - SL[xl]), gy = 0.5 * (SL[yd] - SL[yu]);
      const h = max(0.04, 0.75 * sqrt(gx * gx + gy * gy));
      const s = SL[a];
      cumAt(s + h);
      const r1 = IC[0], g1 = IC[1], b1 = IC[2];
      cumAt(s - h);
      const inv = 1 / (2 * h);
      display.setPixel(
        x, y,
        cl(((r1 - IC[0]) * inv + 0.5) | 0, 0, 255),
        cl(((g1 - IC[1]) * inv + 0.5) | 0, 0, 255),
        cl(((b1 - IC[2]) * inv + 0.5) | 0, 0, 255)
      );
    }
}
