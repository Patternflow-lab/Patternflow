// ===== Patternflow pattern =====
// Title:   Radial Velocity
// Family:  spectra
// Idea:    Ten stellar spectra lie stacked on the panel as bright rainbow strips from violet to red, crossed by dark absorption lines that slide left and right as each star swings round an unseen companion, three of them double-lined binaries whose two sets of lines pass through each other, while the rainbow behind the lines never moves.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Doppler spectroscopy of stars (Christian Doppler, 1842; the radial-velocity method that found 51 Pegasi b, Mayor and Queloz, 1995)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Velocity=0..3, Blur=-1..1, Metals=-1..1
//
// Knob 1: Hue. Turns the whole rainbow round the colour wheel; where the knob opens the strips run from violet on the left to red on the right, and every turn keeps them bright.
// Knob 2: Velocity. How hard the companions pull on their stars: at the bottom of the knob every line stands still and the same lines stand in columns, it opens on 2 where each line sweeps about five LEDs either way, and at the top about ten.
// Knob 3: Blur. How wide the lines are, from sharp ones about 1.6 LEDs wide at the bottom to the broad, shallow smears of a fast-spinning star, 7 LEDs wide, at the top; it opens on about 1.9.
// Knob 4: Metals. How many of the fainter lines each star shows: at the bottom only the hydrogen lines and the broad bands of the coolest stars are left, in the middle the strong metal lines and the helium of the hottest stars come in, and at the top the cool stars fill with a forest of fine lines.

const W = 64;
// Ten strips, 11 LEDs tall with 2 LEDs of dark between them, fill the 128 rows exactly.
const BANDS = 10;
const BAND_H = 11;
const PITCH = 13;
// The strips run from 380 nm at the left edge to 700 nm at the right.
const NM0 = 380;
const NM1 = 700;
// The widest swing at the top of Knob 2, in LEDs, and the width of a line at the bottom, middle and top of Knob 3.
const SWING = 4.3;
const FWHM_LOW = 1.6;
const FWHM_MID = 1.9;
const FWHM_HIGH = 7;
// Dimmest the continuum gets anywhere on a strip.
const FLOOR = 0.45;
// How much the blue is stretched, as the power the wavelength share is raised to.
const SPREAD = 0.78;
// The line width the strengths below are written for, as a Gaussian sigma in LEDs.
const SIGMA_REF = 0.7;
// How much deeper every line is drawn than its strength says, so the cores of the strong ones go nearly dark.
const TAU_GAIN = 2.6;
// The most optical depth, averaged along a strip, that the lines may add up to.
const CAP = 0.7;

// Where a wavelength falls along a strip. Like a prism's, the spread stretches the blue: 380 to 700 nm is not an even ruler.
function ledOf(nm) {
  return (W - 1) * Math.pow((nm - NM0) / (NM1 - NM0), SPREAD);
}

function nmOf(x) {
  return NM0 + (NM1 - NM0) * Math.pow(x / (W - 1), 1 / SPREAD);
}

// One row for each star, from the top: temperature in kelvin, orbital period in seconds, eccentricity, longitude of periastron, starting phase, share of the full swing, a small shift of the whole system, and the mass ratio for a double-lined binary (0 for a single star). The periods do not divide one another.
const STARS = [
  [9800, 12.9, 0.18, 0.7, 0.4, 0.85, -0.2, 0],
  [4600, 31.7, 0.5, 2.2, 2.1, 0.7, 0.3, 0],
  [6500, 18.7, 0.3, 4.0, 5.0, 1.0, 0.1, 0.8],
  [3500, 9.7, 0.0, 0.0, 3.3, 0.55, -0.3, 0],
  [12500, 40.9, 0.6, 1.1, 0.9, 0.9, 0.2, 0],
  [8700, 22.3, 0.25, 5.3, 4.2, 1.0, -0.1, 0.9],
  [5200, 7.3, 0.08, 2.9, 1.6, 0.5, 0.0, 0],
  [7400, 36.1, 0.42, 0.3, 2.8, 0.8, -0.15, 0],
  [5800, 15.1, 0.35, 3.6, 5.8, 1.0, 0.1, 0.75],
  [3300, 26.9, 0.55, 1.9, 0.2, 0.65, 0.25, 0],
];

// The lines every star may show: wavelength in nm, kind, strength, and the order they come in as Knob 4 opens. Hydrogen is always there.
// kinds: 0 hydrogen, 1 calcium H and K, 2 neutral metals, 3 helium, 4 molecular band
const LINES = [
  [656.3, 0, 1.0, -9],
  [486.1, 0, 0.9, -9],
  [434.0, 0, 0.8, -9],
  [410.2, 0, 0.65, -9],
  [397.0, 0, 0.45, -9],
  [393.4, 1, 1.6, 0],
  [589.3, 2, 1.1, 1],
  [517.7, 2, 1.0, 2],
  [447.1, 3, 1.0, 3],
  [430.8, 2, 0.9, 4],
  [612.2, 2, 0.7, 5],
  [584.7, 4, 0.55, -3],
  [527.0, 2, 0.7, 7],
  [422.7, 2, 0.8, 8],
  [615.9, 4, 0.5, -3],
  [587.6, 3, 0.7, 10],
  [495.8, 2, 0.5, 11],
  [492.2, 3, 0.7, 12],
  [644.0, 2, 0.45, 13],
  [438.4, 2, 0.55, 14],
  [665.1, 4, 0.45, -3],
  [532.8, 2, 0.45, 16],
  [466.8, 2, 0.45, 17],
  [561.5, 2, 0.4, 18],
  [402.6, 3, 0.6, 19],
  [630.2, 2, 0.4, 20],
  [458.3, 2, 0.4, 21],
  [543.0, 2, 0.35, 22],
  [404.6, 2, 0.5, 23],
  [574.0, 2, 0.35, 24],
  [481.2, 2, 0.35, 25],
  [504.0, 2, 0.3, 26],
  [636.5, 2, 0.3, 27],
  [413.2, 2, 0.4, 28],
];
// Fine lines each star adds on top of the named ones: 10 for the hottest, up to 38 for the coolest.
const FINE = 28;
const RANK_TOP = 28;
const RANK_SPAN = 3;

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Hue along a strip, by LED: violet at the left edge, then blue, cyan, green, yellow, orange, red over the last few LEDs.
const HUE_X = [0, 8, 20, 28, 34, 40, 46, 53, 59, 63];
const HUE_AT = [0.78, 0.7, 0.55, 0.42, 0.3, 0.19, 0.1, 0.04, 0.0, 0.0];

function hueOf(x) {
  let k = 0;
  while (k < HUE_X.length - 2 && x > HUE_X[k + 1]) k++;
  const u = (x - HUE_X[k]) / (HUE_X[k + 1] - HUE_X[k]);
  return HUE_AT[k] + (HUE_AT[k + 1] - HUE_AT[k]) * u;
}

// Planck's law: how much light a star of temperature T gives at wavelength nm.
function planck(nm, T) {
  return 1 / (Math.pow(nm, 5) * (Math.exp(1.4388e7 / (nm * T)) - 1));
}

export function setup(params) {
  params.t = 0;
  params.stars = STARS.map((s, si) => {
    const T = s[0];
    // Where each kind of line is strongest: hydrogen near 9500 K, calcium and the metals growing towards the cool end, helium near 15000 K.
    const bump = Math.exp(-Math.pow(Math.log(T / 9500), 2) / (2 * 0.38 * 0.38));
    const sc = clamp((9800 - T) / 5600, 0, 1);
    const sm = clamp((7800 - T) / 4500, 0, 1);
    const he = Math.exp(-Math.pow(Math.log(T / 15000), 2) / (2 * 0.22 * 0.22));
    const cool = clamp((4300 - T) / 1200, 0, 1);
    const pos = [];
    const tau = [];
    const rank = [];
    const wid = [];
    LINES.forEach((l, li) => {
      const kind = l[1];
      const scale = kind === 0 ? 0.55 + 0.8 * bump : kind === 1 ? 0.2 + 1.0 * Math.pow(sc, 0.8) : kind === 2 ? 0.12 + 1.1 * sm : kind === 3 ? 1.3 * he : 1.0 * cool;
      pos.push(ledOf(l[0]));
      tau.push(l[2] * scale);
      rank.push(l[3]);
      wid.push(kind === 4 ? 2.2 : 0.85 + 0.35 * hash(si, li));
    });
    // The fine lines are this star's own: where they fall, how deep and how wide.
    const nFine = Math.round(10 + FINE * sm);
    for (let j = 0; j < nFine; j++) {
      pos.push(1 + (W - 3) * hash(si * 31 + 7, j));
      tau.push((0.07 + 0.18 * hash(si * 31 + 8, j)) * (0.3 + 1.2 * sm));
      rank.push(14 + (RANK_TOP - 14) * hash(si * 31 + 9, j));
      wid.push(0.85 + 0.35 * hash(si * 31 + 10, j));
    }
    // The continuum: hot stars bright at the blue end, cool stars at the red, never below FLOOR.
    let top = 0;
    for (let x = 0; x < W; x++) top = Math.max(top, planck(nmOf(x), T));
    const cont = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const r = planck(nmOf(x), T) / top;
      cont[x] = FLOOR + (1 - FLOOR) * Math.pow(r, 0.7);
    }
    return { T, period: s[1], e: s[2], w: s[3], phase: s[4], kf: s[5], gam: s[6], q: s[7], pos, tau, rank, wid, cont, drift: 0.01 + 0.012 * hash(si, 99), slowP: 60 + 140 * hash(si, 98), slowPhase: 6.28 * hash(si, 97) };
  });
  params.rgb = new Float32Array(W * 3);
  params.prof = new Float32Array(W);
  params.area = new Float64Array(2);
  params.depth = new Float64Array(2);
  params.col = new Float32Array(3);
  params.swing = 2 * SWING;
  params.sigma = FWHM_MID / 2.3548;
  params.metals = 0.5;
}

// The orbital velocity of a star at time t as a share of its full swing, from Kepler's equation.
function velocity(s, t) {
  const e = s.e;
  const M = (2 * Math.PI * t) / s.period + s.phase;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 5; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const w = s.w + s.drift * t;
  return 0.75 * ((Math.cos(nu + w) + e * Math.cos(w)) / (1 + e));
}

// A second companion far out pulls the whole system slowly one way and the other, so the curve never closes on itself.
function trend(s, t) {
  return s.gam + 0.35 * Math.sin((2 * Math.PI * t) / s.slowP + s.slowPhase);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.swing = SWING * clamp(k[1], 0, 3);
  const b = clamp(k[2], -1, 1);
  params.sigma = (b < 0 ? FWHM_MID * Math.pow(FWHM_LOW / FWHM_MID, -b) : FWHM_MID * Math.pow(FWHM_HIGH / FWHM_MID, b)) / 2.3548;
  params.metals = (clamp(k[3], -1, 1) + 1) / 2;
  for (let x = 0; x < W; x++) {
    const h = hueOf(x) + k[0];
    // Blue and violet are given a little white so they read as bright as the green.
    const blue = clamp(1 - Math.abs(((h % 1) + 1) % 1 - 0.7) / 0.14, 0, 1);
    hsv(h, 0.9 - 0.22 * blue, 1, params.col);
    params.rgb[x * 3] = params.col[0];
    params.rgb[x * 3 + 1] = params.col[1];
    params.rgb[x * 3 + 2] = params.col[2];
  }
}

// Lay one set of lines into a strip's profile of optical depth, or with prof null only measure them: area[0] gains the area of the hydrogen and molecular lines, which are never turned down, and area[1] that of the forest of metal lines, which is. Each line is a Gaussian of the width the blur gives it, widened a little by the LED it lands on, so a line that slides between two LEDs does not flicker.
function lineSet(s, prof, shift, weight, sigma, depth, reach, gain, area) {
  // depth[0] is for the lines never turned down, depth[1] for the forest.
  const n = s.pos.length;
  for (let j = 0; j < n; j++) {
    const present = clamp((reach - s.rank[j]) / RANK_SPAN, 0, 1);
    if (present <= 0) continue;
    const w = sigma * s.wid[j];
    const se = Math.sqrt(w * w + 1 / 12);
    const fixed = s.rank[j] < -1;
    const peak = s.tau[j] * present * weight * (fixed ? depth[0] : depth[1] * gain) * TAU_GAIN * (w / se);
    if (peak < 0.01) continue;
    area[fixed ? 0 : 1] += peak * se * 2.5066;
    if (!prof) continue;
    const c = s.pos[j] + shift;
    const lo = Math.max(0, Math.ceil(c - 3.5 * se));
    const hi = Math.min(W - 1, Math.floor(c + 3.5 * se));
    const inv = 1 / (2 * se * se);
    for (let x = lo; x <= hi; x++) {
      const d = x - c;
      prof[x] += peak * Math.exp(-d * d * inv);
    }
  }
}

// Rows of a strip, brightness from the edge to the middle.
const ROWS = [0.72, 0.96, 1, 1, 1, 1, 1, 1, 1, 0.96, 0.72];

export function draw(display, params) {
  const { stars, rgb, prof, area, depth, swing, sigma, metals, t } = params;
  // Wide lines are shallower, the hydrogen lines least of all.
  depth[0] = Math.pow(SIGMA_REF / sigma, 0.6);
  depth[1] = Math.pow(SIGMA_REF / sigma, 0.9);
  const reach = metals * (RANK_TOP + RANK_SPAN);
  // The darkest a line gets: nearly black when it is sharp, only a shade when it is smeared wide.
  const dark = 0.03 + 0.15 * clamp((sigma - SIGMA_REF) / 2.2, 0, 1);
  for (let b = 0; b < BANDS; b++) {
    const s = stars[b];
    prof.fill(0);
    const orbit = velocity(s, t);
    const drift = trend(s, t);
    // However many lines a star is given, the forest of metal lines never takes more than CAP of the strip's light on average once the hydrogen has taken its share.
    area[0] = 0;
    area[1] = 0;
    lineSet(s, null, 0, 1, sigma, depth, reach, 1, area);
    if (s.q > 0) lineSet(s, null, 0, 0.85, sigma, depth, reach, 1, area);
    const room = Math.max(CAP * W - area[0], 0.2 * CAP * W);
    const gain = area[1] > room ? room / area[1] : 1;
    lineSet(s, prof, swing * s.kf * (drift + orbit), 1, sigma, depth, reach, gain, area);
    if (s.q > 0) lineSet(s, prof, swing * s.kf * (drift - orbit / s.q), 0.85, sigma, depth, reach, gain, area);
    const y0 = b * PITCH;
    for (let x = 0; x < W; x++) {
      const m = (dark + (1 - dark) * Math.exp(-prof[x])) * s.cont[x] * 255;
      const r = rgb[x * 3] * m;
      const g = rgb[x * 3 + 1] * m;
      const bl = rgb[x * 3 + 2] * m;
      for (let j = 0; j < BAND_H; j++) display.setPixel(x, y0 + j, r * ROWS[j], g * ROWS[j], bl * ROWS[j]);
    }
    if (b < BANDS - 1) for (let j = BAND_H; j < PITCH; j++) for (let x = 0; x < W; x++) display.setPixel(x, y0 + j, 0, 0, 0);
  }
}
