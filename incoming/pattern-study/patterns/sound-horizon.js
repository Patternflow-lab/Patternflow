// ===== Patternflow pattern =====
// Title:   Sound Horizon
// Family:  cmbsky
// Idea:    Two hemispheres of the early universe's microwave sky, each a disc seen straight down its pole, are mottled in cold blue and hot orange by sound waves that rang in the plasma, so that as the distance a sound wave could travel slowly drifts, the size of the blotches breathes between big soft patches and a finer mottle while the sky itself turns and never settles into the same picture twice.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the large-scale temperature of the microwave sky (Rainer Sachs and Arthur Wolfe, 1967), acoustic oscillations of the photon-baryon plasma before recombination (Phillip Peebles and Jer Yu, 1970; Rashid Sunyaev and Yakov Zeldovich, 1970) with their peaks measured by Boomerang (2000) and WMAP (2003), the damping of the small scales by photon diffusion (Joseph Silk, 1967), all from memory; a mode of the sky gets the phase cos(l s) of how far sound had gone, as in the textbook transfer function, and the sky is built from spherical harmonics of degree 2 to 24 on a pole-on view, original, pattern round 240
// Round:   240
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ring=0.15..3, Reach=-1..1, Baryons=-0.8..0.9
//
// Knob 1: Hue. Turns the whole temperature map round the wheel. At 0, where it opens, cold is deep blue, the middle of the scale is pale cream and hot is orange running to a copper red; at 0.25 it is green against magenta.
// Knob 2: Ring. How fast the sound horizon drifts and the sky turns. It opens at 2, where the horizon angle swings with periods of 37 s and 59 s and the sky turns about 2 degrees a second (a feature at the rim of a disc moves about 1 LED a second). At 0.15 a swing takes about 8 minutes and the turn is a tenth as fast, and the blotches still wander on their own there; at 3 the swings take 25 s and 39 s.
// Knob 3: Reach. How far down in size the sound reaches before it is damped away, as the damping degree lD: 6 at -1 (a few broad soft blobs 25 to 40 LED across), 11 at 0 where it opens (patches 8 to 20 LED across with a finer mottle between), 19 at 1 (a fine mottle 4 to 8 LED across over bigger patches).
// Knob 4: Baryons. The weight of the baryons in the plasma, Rb, which lifts the zero point of the oscillation so that every second acoustic peak stands taller than its neighbour. It opens at Rb 0.3 and runs from -0.56, where the first and third peaks stand tall and the hot spots are broad and the cold ones narrow, to 1.14, where the first and third peaks are nearly gone, the second and fourth are twice as strong, and the hot spots are the small tall ones on a cooler sky.

const W = 64, H = 128;
const { floor, sqrt, abs, exp, log, sin, cos, asin, tanh, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the sky ----------------------------------------------------------------
// Spherical harmonics from degree LMIN to LMAX, each order m from 0 up to l. The panel shows two discs of radius RAD at
// (32, 32) and (32, 96), orthographic views straight down the north and south poles, so that a pixel at radius r of a
// disc has colatitude asin(r / RAD) and the rim is the equator of both.
const LMIN = 2, LMAX = 24, NM = LMAX + 1, NT = 65, RAD = 31.5, RIM = 0.75;
const MOFF = new Int32Array(NM + 1);
const modeL = [], modeM = [];
for (let m = 0; m <= LMAX; m++) {
  MOFF[m] = modeL.length;
  for (let l = max(m, LMIN); l <= LMAX; l++) (modeL.push(l), modeM.push(m));
}
MOFF[NM] = modeL.length;
const NMODE = modeL.length;
// The south pole sees the same function with its colatitude turned to pi minus it, which flips the sign of every
// mode with l + m odd.
const SG = new Float32Array(NMODE);
for (let i = 0; i < NMODE; i++) SG[i] = (modeL[i] + modeM[i]) & 1 ? -1 : 1;

// Normalised associated Legendre functions on NT rings, evenly spaced in colatitude from 0 to 90 degrees.
const PL = new Float32Array(NT * NMODE);
{
  const col = new Float64Array(LMAX + 1);
  for (let k = 0; k < NT; k++) {
    const th = (k / (NT - 1)) * (PI / 2), x = cos(th), sn = sin(th);
    let pmm = sqrt(1 / (4 * PI));
    for (let m = 0; m <= LMAX; m++) {
      if (m > 0) pmm *= -sqrt((2 * m + 1) / (2 * m)) * sn;
      col[m] = pmm;
      let p1 = m + 1 <= LMAX ? sqrt(2 * m + 3) * x * pmm : 0, p0 = pmm;
      if (m + 1 <= LMAX) col[m + 1] = p1;
      for (let l = m + 2; l <= LMAX; l++) {
        const p2 = sqrt((4 * l * l - 1) / (l * l - m * m)) * (x * p1 - sqrt(((l - 1) * (l - 1) - m * m) / (4 * (l - 1) * (l - 1) - 1)) * p0);
        col[l] = p2;
        p0 = p1;
        p1 = p2;
      }
      for (let l = max(m, LMIN), i = MOFF[m]; l <= LMAX; l++, i++) PL[k * NMODE + i] = col[l];
    }
  }
}

// The pixels of one disc (the other is its mirror): where each lies, which two rings it reads between, how much of it the
// rim leaves, and cos(m a), sin(m a) of its angle a round the pole for every m.
const PX = [], PY = [], PKK = [], PWW = [], PDM = [], PPL = [];
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - 32, dy = y + 0.5 - 32, r = sqrt(dx * dx + dy * dy);
    if (r > RAD + RIM) continue;
    const c = cl((RAD + RIM - r) / (2 * RIM), 0, 1);
    PX.push(x);
    PY.push(y);
    const e = c * c * (3 - 2 * c);
    PDM.push(Math.pow(e, 0.6));
    PPL.push((1 - e) * 0.12);
    const g = (asin(min(r, RAD) / RAD) / (PI / 2)) * (NT - 1), k = min(floor(g), NT - 2);
    PKK.push(k);
    PWW.push(g - k);
  }
}
const NPIX = PX.length;
const CT = new Float32Array(NPIX * NM), ST = new Float32Array(NPIX * NM);
for (let p = 0; p < NPIX; p++) {
  const a = Math.atan2(PY[p] + 0.5 - 32, PX[p] + 0.5 - 32);
  for (let m = 0; m < NM; m++) {
    CT[p * NM + m] = cos(m * a);
    ST[p * NM + m] = sin(m * a);
  }
}

// ---- colour -----------------------------------------------------------------
// A diverging temperature scale in the spirit of the Planck map: cold deep blue, azure, pale ice, cream, apricot,
// orange, copper. Every stop is bright, so no step of it goes brown on the panel.
const KEYS = [
  [-1.0, 16, 40, 205],
  [-0.72, 32, 100, 245],
  [-0.42, 74, 170, 255],
  [-0.16, 170, 222, 255],
  [0.0, 255, 242, 214],
  [0.2, 255, 220, 158],
  [0.46, 255, 176, 88],
  [0.76, 255, 128, 58],
  [1.0, 240, 90, 46],
];
const LUTN = 1024;
// A field of one standard deviation reaches tanh(TONE) of the way to the ends of the scale.
const TONE = 1 / 1.55;
function rgb2hsv(r, g, b, o) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  o[0] = h / 6;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx;
}
function hsv2rgb(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function buildLut(lut, hue) {
  const c = [0, 0, 0], hs = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const u = -1 + (2 * i) / (LUTN - 1);
    let k = 0;
    while (k < KEYS.length - 2 && u > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * f, g = a[2] + (b[2] - a[2]) * f, bl = a[3] + (b[3] - a[3]) * f;
    rgb2hsv(r / 255, g / 255, bl / 255, hs);
    hsv2rgb(hs[0] + hue, hs[1], hs[2], c);
    lut[i * 3] = c[0] * 255;
    lut[i * 3 + 1] = c[1] * 255;
    lut[i * 3 + 2] = c[2] * 255;
  }
}

// ---- state ------------------------------------------------------------------
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const OPEN = [0, 2, 0, 0.06];
// The orders m = 0 are the only ones that reach the pole, and a few strong ones turn the middle of a disc into rings, so they carry less.
const M0 = 0.8;

export function setup(params) {
  const st = (params.st = {
    k: OPEN.slice(), init: false, t: 0,
    gr: new Float32Array(NMODE), gi: new Float32Array(NMODE), hr: new Float32Array(NMODE), hi: new Float32Array(NMODE), tau: new Float32Array(NMODE),
    cr: new Float32Array(NMODE), ci: new Float32Array(NMODE),
    ph1: Math.random() * TAU, ph2: Math.random() * TAU, rot: Math.random() * TAU, rph: Math.random() * TAU,
    lD: 10.5, rb: 0.3, sigma: 1, sTrk: 1, s: 0.5,
    zNr: new Float32Array(NT * NM), zNi: new Float32Array(NT * NM), zSr: new Float32Array(NT * NM), zSi: new Float32Array(NT * NM),
    lut: new Float32Array(LUTN * 3), hue: -9,
  });
  for (let i = 0; i < NMODE; i++) {
    const sd = modeM[i] === 0 ? 1 : sqrt(0.5);
    st.gr[i] = gauss() * sd;
    st.gi[i] = modeM[i] === 0 ? 0 : gauss() * sd;
    st.hr[i] = gauss() * sd;
    st.hi[i] = modeM[i] === 0 ? 0 : gauss() * sd;
    st.tau[i] = exp(log(25) + (log(70) - log(25)) * Math.random());
  }
}

function targets(k) {
  return { hue: k[0], fac: cl(k[1], 0.15, 3) / 2, lD: 11 * Math.pow(1.75, cl(k[2], -1, 1)), rb: cl(k[3], -0.8, 0.9) + 0.24 };
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || OPEN;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  const T = targets(st.k);
  if (!st.init) {
    st.init = true;
    st.lD = T.lD;
    st.rb = T.rb;
  }
  const d = cl(dt || 0, 0, 0.1);
  st.t += d;
  const a = 1 - exp(-d / 0.25);
  st.lD += (T.lD - st.lD) * a;
  st.rb += (T.rb - st.rb) * a;
  st.fac = T.fac;
  // The sound horizon angle: a base and two slow sines, so the first acoustic peak at l = pi / s sweeps about l = 4 to 14.
  st.ph1 += (TAU * d * T.fac) / 37;
  st.ph2 += (TAU * d * T.fac) / 59;
  st.s = 0.5 + 0.17 * sin(st.ph1) + 0.11 * sin(st.ph2);
  // The sky turns about its pole, never quite steadily.
  st.rph += (TAU * d * T.fac) / 83;
  st.rot += d * T.fac * (0.035 + 0.02 * sin(st.rph));
  // The random amplitudes wander as Ornstein-Uhlenbeck processes, each with a correlation time of 25 to 70 s.
  for (let i = 0; i < NMODE; i++) {
    const e = exp(-d / st.tau[i]), sd = sqrt(1 - e * e) * (modeM[i] === 0 ? 1 : sqrt(0.5));
    st.gr[i] = st.gr[i] * e + sd * gauss();
    if (modeM[i] !== 0) st.gi[i] = st.gi[i] * e + sd * gauss();
    st.hr[i] = st.hr[i] * e + sd * gauss();
    if (modeM[i] !== 0) st.hi[i] = st.hi[i] * e + sd * gauss();
  }
  // The coefficients: c = g amp(l) (cos(l s) + Rb) exp(-(l / lD)^2), the factor 2 for m > 0 standing for -m. Where
  // cos(l s) + Rb comes near zero a scale has nothing, and with the first peak out among l 6 to 16 and Rb high that would
  // leave only a few giant blobs, so a second set of independent amplitudes h, as strong as 0.15 to 0.5 of the typical weight, more
  // as Rb goes up, and spread over l 5 to 20, plays the part the Doppler motion of the plasma plays in the sky: it fills the troughs.
  const wl = new Float32Array(LMAX + 1), fl = new Float32Array(LMAX + 1);
  const typ = 0.2 * sqrt(0.5 + st.rb * st.rb) * (1 + max(0, st.rb - 0.3));
  let tot = 0;
  for (let l = LMIN; l <= LMAX; l++) {
    const q = l / st.lD, lz = log(l / 10) / 0.55, am = (1 / sqrt(l * (l + 1))) * Math.pow(l / 5, 0.45) * exp(-q * q);
    wl[l] = am * (cos(l * st.s) + st.rb);
    fl[l] = am * typ * exp(-0.5 * lz * lz);
  }
  for (let i = 0; i < NMODE; i++) {
    const l = modeL[i], mz = modeM[i] === 0, f0 = mz ? M0 : 1;
    const ar = (st.gr[i] * wl[l] + st.hr[i] * fl[l]) * f0, ai = (st.gi[i] * wl[l] + st.hi[i] * fl[l]) * f0;
    st.cr[i] = ar * (mz ? 1 : 2);
    st.ci[i] = ai * (mz ? 1 : 2);
    tot += (ar * ar + ai * ai) * (mz ? 1 : 2);
  }
  st.sigma = sqrt(tot / (4 * PI));
  if (st.sTrk === 1 && !st.seeded) (st.seeded = true), (st.sTrk = st.sigma);
  st.sTrk += (st.sigma - st.sTrk) * (1 - exp(-d / 4));
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const T = targets(st.k);
  if (abs(T.hue - st.hue) > 1e-4) (st.hue = T.hue), buildLut(st.lut, T.hue);
  const lut = st.lut;

  // Ring sums A_m(theta) for the north cap and the south one, turned by the sky's rotation.
  const lc = min(LMAX, Math.ceil(st.lD * 2.7)), mc = lc;
  const { cr, ci, zNr, zNi, zSr, zSi } = st;
  const cm = new Float32Array(NM), sm = new Float32Array(NM);
  for (let m = 0; m <= mc; m++) (cm[m] = cos(m * st.rot)), (sm[m] = sin(m * st.rot));
  for (let k = 0; k < NT; k++) {
    const pk = k * NMODE;
    for (let m = 0; m <= mc; m++) {
      let nr = 0, ni = 0, sr = 0, si = 0;
      const i1 = min(MOFF[m + 1], MOFF[m] + (lc - max(m, LMIN) + 1));
      for (let i = MOFF[m]; i < i1; i++) {
        const p = PL[pk + i], tr = cr[i] * p, ti = ci[i] * p, g = SG[i];
        nr += tr;
        ni += ti;
        sr += tr * g;
        si += ti * g;
      }
      const o = k * NM + m;
      zNr[o] = nr * cm[m] - ni * sm[m];
      zNi[o] = nr * sm[m] + ni * cm[m];
      zSr[o] = sr * cm[m] - si * sm[m];
      zSi[o] = sr * sm[m] + si * cm[m];
    }
  }

  // Each pixel is the sum over m of Re[Z_m(r) e^{i m a}], read between two rings.
  const pr = 255, pg = 232, pb2 = 205;
  const inv = 1 / max(1e-6, st.sTrk), half = (LUTN - 1) / 2, sk = 0.25 * (st.rb - 0.3);
  for (let p = 0; p < NPIX; p++) {
    const k0 = PKK[p], w = PWW[p], base = k0 * NM, pb = p * NM;
    let n0 = 0, n1 = 0, s0 = 0, s1 = 0;
    for (let m = 0; m <= mc; m++) {
      const c = CT[pb + m], s = ST[pb + m], i0 = base + m, i1 = i0 + NM;
      n0 += zNr[i0] * c - zNi[i0] * s;
      n1 += zNr[i1] * c - zNi[i1] * s;
      s0 += zSr[i0] * c - zSi[i0] * s;
      s1 += zSr[i1] * c - zSi[i1] * s;
    }
    const x = PX[p], y = PY[p], dim = PDM[p], pale = PPL[p];
    let u = (n0 + (n1 - n0) * w) * inv;
    let j = floor((tanh((u + sk * (u * u - 1)) * TONE) + 1) * half + 0.5) * 3;
    display.setPixel(x, y, floor((lut[j] + (pr - lut[j]) * pale) * dim), floor((lut[j + 1] + (pg - lut[j + 1]) * pale) * dim), floor((lut[j + 2] + (pb2 - lut[j + 2]) * pale) * dim));
    u = (s0 + (s1 - s0) * w) * inv;
    j = floor((tanh((u + sk * (u * u - 1)) * TONE) + 1) * half + 0.5) * 3;
    display.setPixel(x, 127 - y, floor((lut[j] + (pr - lut[j]) * pale) * dim), floor((lut[j + 1] + (pg - lut[j + 1]) * pale) * dim), floor((lut[j + 2] + (pb2 - lut[j + 2]) * pale) * dim));
  }
}
