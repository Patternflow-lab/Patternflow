// ===== Patternflow pattern =====
// Title:   Wiggle Section
// Family:  seismology
// Idea:    A seismic record section on scrolling chart paper: twelve wiggle traces with their positive lobes filled in gold and the negative ones left dim, across which earthquakes of every size run as slanted wavefronts, a small P arrival, the larger S behind it, a dispersive surface-wave train and a coda that fades away, over a microseism hum that never lets a trace lie flat.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 202, after the seismic record section
// Round:   202
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scroll=0..4, Moveout=-1.35..0.65, Gain=-1..1
//
// Knob 1: Hue. The colour of the fill: gold where the knob opens, then round the wheel; the hottest swings turn pale in every colour.
// Knob 2: Scroll. How fast the paper runs: a crawl of 1 LED a second at the bottom, about 4 where the knob opens, 8.6 at the top.
// Knob 3: Moveout. The slant of the wavefronts across the twelve stations: steep and falling to the left at the bottom, level in the middle where every station shakes at once, steep and falling to the right at the top; where the knob opens they fall gently to the right. The traces the fronts reach first stand nearest the epicentre and swing widest.
// Knob 4: Gain. How far a trace may swing: at the bottom only the biggest earthquakes show, where the knob opens most of them do, and at the top everything clips into solid blocks.

const W = 64;
const H = 128;
// Twelve traces, each in a column five LEDs wide, two LEDs of margin either side of the panel.
const NC = 12;
const PITCH = 5;
const X0 = 2;
// The baseline sits on an LED edge two LEDs into its column, so the fill never starts on a half-lit LED.
const BASE = 2;
// The widest a positive lobe grows to the right of the baseline, and a negative one to the left, in LEDs.
const POSW = 2.6;
const NEGW = 1.6;
// Mean spacing of earthquake origin times, in rows of paper.
const SLOT = 34;
const TWO_PI = 6.283185307179586;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x, seed) {
  const ix = Math.floor(x);
  let f = x - ix;
  f = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(ix, seed);
  const b = hash(ix + 1, seed);
  return 2 * (a + (b - a) * f) - 1;
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy * 7 + 3);
  const b = hash(ix + 1, iy * 7 + 3);
  const c = hash(ix, iy * 7 + 10);
  const d = hash(ix + 1, iy * 7 + 10);
  return 2 * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) - 1;
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

// Ricker wavelet of peak period T, s rows from its centre.
function ricker(s, T) {
  const a = (Math.PI * s) / T;
  const a2 = a * a;
  return (1 - 2 * a2) * Math.exp(-a2);
}

// One earthquake, a closed form of its index n: when and how big it is, how far off, which way it leans, and the shape of each of its waves.
function makeEvent(n) {
  const h = (k) => hash(n, k + 100);
  const e = {};
  e.n = n;
  e.R = n * SLOT + (h(1) - 0.5) * SLOT * 1.2;
  // Gutenberg-Richter: many small ones and few big ones, about ten times fewer for every ten times the amplitude.
  e.A = Math.min(5, 0.55 * Math.pow(0.02 + 0.98 * h(2), -0.65));
  // far: 0 for a near shock whose S follows its P by 7 rows, 1 for a distant one with 27 rows between them and a stronger surface-wave train.
  e.far = h(3);
  e.L0 = 7 + 20 * e.far;
  e.Dn = 40 + 260 * e.far * e.far + 60 * h(4);
  e.sf = 0.55 + 0.9 * h(5);
  e.sgP = h(6) < 0.5 ? -1 : 1;
  e.sgS = h(7) < 0.5 ? -1 : 1;
  e.sgR = h(8) < 0.5 ? -1 : 1;
  const big = 1 + 0.1 * Math.log(e.A);
  e.TP = 8.5 * big;
  e.TS = 12 * big;
  // Dispersion: the long periods of the surface-wave train arrive first, so its period shortens from f0 to f1 as it passes.
  e.f0 = 1 / ((17 + 12 * e.far) * big);
  e.f1 = 1 / (8.5 * big);
  e.Ld = 35 + 35 * e.far;
  e.tauR = 20 + 16 * e.far;
  e.tauC = 14 + 8 * h(9);
  e.aS = 0.8 * e.A;
  e.aP = 0.3 * e.aS;
  e.aR = e.aS * (0.35 + 1.2 * e.far);
  e.aC = 0.22 * e.aS;
  e.seed = (h(10) * 9000) | 0;
  return e;
}

const CACHE = new Map();
function eventOf(n) {
  let e = CACHE.get(n);
  if (!e) {
    e = makeEvent(n);
    CACHE.set(n, e);
    if (CACHE.size > 96) CACHE.delete(CACHE.keys().next().value);
  }
  return e;
}

export function setup(params) {
  params.pos = 3064;
  params.speed = 4;
  params.hue = 0.115;
  params.p = 0.3;
  params.gain = 2.0;
  params.out = new Float32Array(NC * H * 2);
  params.raw = new Float32Array(NC * H * 2);
  params.env = new Float32Array(NC * H * 2 * 2);
  params.plan = new Float32Array(48 * NC * 8);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const k1 = clamp(k[0], 0, 1);
  params.hue = 0.115 + k1;
  const k2 = clamp(k[1], 0, 4);
  params.speed = 1 + 1.25 * Math.pow(k2, 1.3);
  params.pos += dt * params.speed;
  // Moveout: slowness in rows of paper a LED across the section. Level fronts sit at -0.35 on the dial, so the knob opens with a gentle lean.
  const m = clamp(k[2] + 0.35, -1, 1);
  params.p = 1.3 * Math.sign(m) * Math.pow(Math.abs(m), 1.5);
  const g = clamp(k[3], -1, 1);
  // Down to 1.4 at the bottom, 2 where the knob opens, 5 at the top, evenly in the logarithm either side.
  params.gain = g < 0.06 ? 2.0 * Math.pow(0.7, (0.06 - g) / 1.06) : 2.0 * Math.pow(2.5, (g - 0.06) / 0.94);
}

// The microseism: two swells that travel across the stations at their own pace, breathing over a few minutes.
function hum(i, r, amp) {
  const a = amp * (0.7 + 0.7 * noise1(r / 260 + 3.1, 91) + 0.3 * noise1(r / 90, 95));
  const w1 = Math.sin(TWO_PI * (r / 11.3 + 0.06 * i) + 1.6 * noise1(r / 41, 92));
  const w2 = 0.7 * Math.sin(TWO_PI * (r / 8.1 - 0.045 * i) + 1.6 * noise1(r / 33 + 5, 93));
  return a * (w1 + w2);
}

export function draw(display, params) {
  const pos = params.pos;
  const p = params.p;
  const left = p >= 0;
  const q = Math.abs(p);
  const G = params.gain;
  const plan = params.plan;
  const out = params.out;
  const raw = params.raw;
  const top = pos - H;
  // The earthquakes that can still reach the view: any whose origin lies between these rows.
  const rMax = 170 + 64 * q * 1.5 + 160;
  const n0 = Math.floor((top - rMax) / SLOT) - 1;
  const n1 = Math.ceil(pos / SLOT) + 1;
  const evs = [];
  for (let n = n0; n <= n1; n++) evs.push(eventOf(n));
  const ne = evs.length;
  // Per event and station: arrival rows of P, S and the surface wave, amplitudes, the end of the coda.
  for (let ei = 0; ei < ne; ei++) {
    const e = evs[ei];
    const pf = q * e.sf;
    for (let i = 0; i < NC; i++) {
      const xc = X0 + PITCH * i + BASE;
      const u = left ? xc : W - xc;
      const o = (ei * NC + i) * 8;
      plan[o] = e.R + (pf / 1.73) * u;
      plan[o + 1] = e.R + e.L0 + pf * u;
      plan[o + 2] = e.R + 2.1 * e.L0 + 1.25 * pf * u;
      const fall = e.Dn / (e.Dn + u);
      const site = 0.85 + 0.3 * hash(i, 77);
      const f = fall * site;
      plan[o + 3] = e.aP * f;
      plan[o + 4] = e.aS * f;
      plan[o + 5] = e.aR * f;
      plan[o + 6] = e.aC * f;
      plan[o + 7] = plan[o + 2] + e.tauR * 5;
    }
  }
  const humAmp = 0.06;
  for (let i = 0; i < NC; i++) {
    for (let s = 0; s < H * 2; s++) {
      const r = top + (s + 0.5) * 0.5;
      let u = hum(i, r, humAmp);
      for (let ei = 0; ei < ne; ei++) {
        const o = (ei * NC + i) * 8;
        const rP = plan[o];
        const end = plan[o + 7];
        if (r < rP - 15 || r > end + 60) continue;
        const e = evs[ei];
        const rS = plan[o + 1];
        const rR = plan[o + 2];
        // P
        u += e.sgP * plan[o + 3] * ricker(r - rP - 5, e.TP);
        // S
        if (r > rS - 20) {
          u += e.sgS * plan[o + 4] * ricker(r - rS - 6, e.TS);
          const s2 = r - rS;
          if (s2 > 0) {
            const env = (1 - Math.exp(-s2 / 7)) * Math.exp(-s2 / e.tauC);
            u += plan[o + 6] * env * (0.6 * noise2(r / 4 + e.seed, i / 2.3) + 0.4 * noise2(r / 2.4 + e.seed + 40, i / 1.6));
          }
        }
        // Surface waves
        const sr = r - rR;
        if (sr > 0) {
          const env = (1 - Math.exp(-sr / 6)) * Math.exp(-sr / e.tauR);
          const ph = TWO_PI * (e.f1 * sr - (e.f1 - e.f0) * e.Ld * (1 - Math.exp(-sr / e.Ld)));
          u += e.sgR * plan[o + 5] * env * Math.sin(ph + 0.6);
        }
      }
      const y = G * u;
      raw[i * H * 2 + s] = y;
      const ay = Math.abs(y);
      out[i * H * 2 + s] = y / Math.pow(1 + ay * ay * ay * ay, 0.25);
    }
  }
  // How wide the biggest lobe within a few rows is, so a whole lobe fades together instead of thinning to a line at its ends.
  const env = params.env;
  for (let i = 0; i < NC; i++) {
    const b = i * H * 2;
    for (let s = 0; s < H * 2; s++) {
      let mp = 0;
      let mn = 0;
      for (let d = -7; d <= 7; d++) {
        const t = s + d;
        if (t < 0 || t >= H * 2) continue;
        const v = out[b + t];
        if (v > mp) mp = v;
        else if (-v > mn) mn = -v;
      }
      env[(b + s) * 2] = mp * POSW;
      env[(b + s) * 2 + 1] = mn * NEGW;
    }
  }
  const col = [0, 0, 0];
  const hue = params.hue;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  }
  for (let i = 0; i < NC; i++) {
    const xb = X0 + PITCH * i + BASE;
    for (let y = 0; y < H; y++) {
      const s0 = i * H * 2 + y * 2;
      let wp = 0;
      let wn = 0;
      let heat = 0;
      for (let k = 0; k < 2; k++) {
        const v = out[s0 + k];
        if (v > 0) wp += v * POSW * 0.5;
        else wn -= v * NEGW * 0.5;
        const hv = smooth(0.9, 2.6, Math.abs(raw[s0 + k]));
        heat += hv * 0.5;
      }
      // A lobe narrower than two LEDs fades instead of drawing a one-LED line.
      const fp = smooth(0.5, 1.5, Math.max(env[s0 * 2], env[s0 * 2 + 2]));
      const fn = smooth(0.6, 1.4, Math.max(env[s0 * 2 + 1], env[s0 * 2 + 3]));
      // the baseline, always faintly there, then the positive lobe right of it
      for (let k = 0; k < 3; k++) {
        const c = clamp(wp - k, 0, 1) * fp;
        const b = k === 0 ? Math.max(c, 0.08 + 0.35 * clamp(wp, 0, 1)) : c;
        if (b <= 0) break;
        hsv(hue + 0.012 * heat, 0.9 - 0.55 * heat, b, col);
        display.setPixel(xb + k, y, col[0] * 255, col[1] * 255, col[2] * 255);
      }
      for (let k = 0; k < 2; k++) {
        const c = clamp(wn - k, 0, 1) * fn;
        if (c <= 0) break;
        hsv(hue - 0.02, 0.95, c * 0.3, col);
        display.setPixel(xb - 1 - k, y, col[0] * 255, col[1] * 255, col[2] * 255);
      }
    }
  }
}
