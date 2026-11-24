// ===== Patternflow pattern =====
// Title:   Vectorscope
// Family:  videoscope
// Idea:    A colourist's two scopes watching a moving picture the panel never shows: a round vectorscope above where every sampled pixel lands at its own chroma in its own hue, so the sky is an arc, each drifting light a bar running from the sky's colour out toward the rim and a hard-edged flat bar one tight cluster, and an RGB parade below where the same pixels stand as red, green and blue traces that step, tilt and split apart as the colour grade wanders, both drawn on phosphor that leaves comet trails.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the vectorscope and the waveform monitor as colour-television test instruments (NTSC era, Tektronix, 1950s and 60s, from memory), chroma read as Cb and Cr with the ITU-R BT.709 luma weights 0.2126, 0.7152 and 0.0722 (1990, from memory), the RGB parade as a colourist's display in grading software (from memory), graticule targets at the 75 percent colour bars; pattern round 233
// Round:   233
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.25..3, Grade=-1..1, Glow=-1..1
//
// Knob 1: Hue. Turns the chroma of every sampled pixel round the vectorscope, a full turn counter-clockwise from 0 to 1 and the same picture again at 1: at 0 the sky arc runs violet, magenta, red, orange across the top of the scope, at 0.25 it has swung a quarter turn to the left, at 0.5 it hangs in the lower half in yellow, green and cyan, and the parade traces climb and fall with it.
// Knob 2: Drift. How fast the lights, the bar, the sky's hue and the colour grade move: 0.25 runs them at an eighth of the opening speed so the scope nearly stands still, 2 is the opening where a light crosses the picture in about 10 s and the bar in 20 to 30 s, 3 runs them half as fast again and the clusters sweep and smear.
// Knob 3: Grade. How hard the colour grade is pushed: at -1 the saturation is 0.3 times the picture's own and there is no cast, so the cloud sits in the middle and the red, green and blue traces lie together, at 0 it is the opening grade with 1.3 times the saturation and a cast of up to 0.12 of full level on each channel, at 1 the saturation is 2.2 times and the cast 2.3 times as large, so the cloud is shoved out to the rim and the three traces split apart by up to half the parade's height.
// Knob 4: Glow. How long the phosphor holds a point: 0.05 s at -1 for crisp moving dots, 0.2 s at the opening, 1.5 s at 1 for long luminous streaks that also burn brighter.

const W = 64;
const H = 128;
const { floor, exp, sin, cos, sqrt, atan2, abs, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the instrument
const SC = 32; // the vectorscope's centre, between LED 31 and 32
const SR = 29; // its outer ring, LED
const SCALE = 55.8; // LED to a chroma of 1: a 100 percent red lands at 28.6
const NX = 64; // the hidden picture is sampled on 64 x 48 cells, one point jittered inside each
const NY = 48;
const PX0 = [0, 22, 44]; // the three parade panels, 20 LED wide with 2 between
const PW = 20;
const PY0 = 123.5; // the level of 0 percent, in the parade's own rows
const PSPAN = 56; // and 100 percent is 56 rows above it
const PAR = [
  [255, 56, 46],
  [64, 255, 100],
  [70, 108, 255],
];
const SLATE = [30, 40, 52]; // the graticule, one cool tone for both scopes

// ---- the hidden video: six lights on paths that never fall into step
// colour, sigma (a fraction of the picture's width), x and y paths as [centre, amp, rad/s, phase, amp, rad/s, phase], breathing as [mean, depth, rad/s, phase]
const LIGHTS = [
  { c: [1.0, 0.12, 0.8], s: 0.075, x: [0.5, 0.32, 0.3719, 0.3, 0.12, 0.9327, 1.9], y: [0.45, 0.3, 0.2913, 2.2, 0.12, 0.8341, 0.4], a: [0.75, 0.25, 0.7117, 0.5] },
  { c: [0.05, 0.85, 1.0], s: 0.062, x: [0.5, 0.34, 0.2713, 4.1, 0.12, 0.7919, 0.7], y: [0.5, 0.3, 0.4307, 1.1, 0.1, 1.0723, 3.3], a: [0.72, 0.28, 0.9731, 2.2] },
  { c: [1.0, 0.72, 0.08], s: 0.082, x: [0.5, 0.3, 0.2117, 2.7, 0.14, 0.6703, 5.1], y: [0.52, 0.28, 0.3319, 0.2, 0.12, 0.9137, 1.5], a: [0.75, 0.25, 0.6143, 4.4] },
  { c: [0.55, 1.0, 0.1], s: 0.052, x: [0.5, 0.34, 0.4709, 5.5, 0.1, 1.1923, 2.4], y: [0.5, 0.3, 0.3723, 3.9, 0.1, 1.1317, 0.9], a: [0.7, 0.3, 1.1311, 1.3] },
  { c: [1.0, 0.24, 0.06], s: 0.07, x: [0.5, 0.3, 0.3307, 3.3, 0.14, 0.8329, 4.7], y: [0.5, 0.28, 0.2521, 5.8, 0.13, 0.7313, 2.8], a: [0.72, 0.28, 0.8719, 3.1] },
  { c: [0.1, 0.25, 1.0], s: 0.028, x: [0.5, 0.4, 0.7331, 0.6, 0.08, 1.9717, 3.7], y: [0.5, 0.34, 0.6117, 4.9, 0.08, 1.7713, 1.8], a: [0.9, 0.1, 1.7011, 0.8] },
];
// the sky and the ground, before the hues wander: violet, rose, peach, teal near the horizon, deep teal
const STOPS = [
  [0.3, 0.07, 0.66],
  [0.8, 0.2, 0.5],
  [0.88, 0.6, 0.4],
  [0.03, 0.3, 0.34],
  [0.01, 0.1, 0.16],
];
const STOP_W = [0.5171, 0.6393, 0.4957, 0.7109, 0.5683]; // rad/s of each stop's hue wander
const STOP_W2 = [0.2967, 0.3349, 0.3811, 0.2737, 0.3591];
// the colour grade: lift and gain of red, green and blue
const LIFT_W = [
  [0.1293, 0.3231, 0.4, 1.7],
  [0.1731, 0.2587, 2.1, 5.2],
  [0.1179, 0.3453, 3.6, 0.6],
];
const GAIN_W = [
  [0.1409, 0.2697, 5.0, 2.9],
  [0.0967, 0.3341, 1.2, 4.4],
  [0.1851, 0.2373, 0.1, 3.3],
];

const SLOPE_W = [
  [0.0733, 0.1913, 1.3, 4.0],
  [0.1103, 0.1597, 3.1, 0.9],
  [0.0891, 0.2237, 5.2, 2.4],
];

// ---- a vivid colour for every direction of the vectorscope
const LUT = new Float32Array(360 * 3);
(function () {
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * TAU;
    const cb = 0.62 * cos(a);
    const cr = 0.62 * sin(a);
    const rr = 1.5748 * cr;
    const bb = 1.8556 * cb;
    const gg = (-0.2126 * rr - 0.0722 * bb) / 0.7152; // luma 0 here, then lifted so the brightest channel is 1
    const top = max(rr, gg, bb);
    LUT[i * 3] = cl(rr - top + 1, 0, 1);
    LUT[i * 3 + 1] = cl(gg - top + 1, 0, 1);
    LUT[i * 3 + 2] = cl(bb - top + 1, 0, 1);
  }
})();

// the random walks: each light's hue (6), each sky stop's hue (5), a nudge on the lift of red, green and blue (3), and where each light sits, x then y (12)
const OU_SIGMA = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.05, 0.05, 0.05, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09];
const OU_TAU = 28; // seconds of the video's clock
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;

// ---- the graticule, built once
function buildGraticule() {
  const G = new Float32Array(W * H);
  const put = (x, y, v) => {
    if (x >= 0 && x < W && y >= 0 && y < H) G[y * W + x] = max(G[y * W + x], v);
  };
  const cen = SC - 0.5;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < W; x++) {
      const d = sqrt((x - cen) * (x - cen) + (y - cen) * (y - cen));
      const o = abs(d - (SR - 0.5));
      if (o < 0.8) put(x, y, 1 - o / 0.8);
      const oi = abs(d - 0.5 * (SR - 0.5));
      if (oi < 0.8) put(x, y, 0.7 * (1 - oi / 0.8));
      // the crosshair has a gap round the centre
      const ax = abs(x - cen);
      const ay = abs(y - cen);
      if (d > 4 && d < SR - 1.5 && (ax < 1 || ay < 1)) put(x, y, 0.55);
    }
  // six hollow targets, 4 x 4, where the 75 percent colour bars land
  const bars = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1]];
  for (const b of bars) {
    const r = 0.75 * b[0];
    const g = 0.75 * b[1];
    const bl = 0.75 * b[2];
    const yy = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const cb = (bl - yy) / 1.8556;
    const cr = (r - yy) / 1.5748;
    const cx = Math.round(SC + cb * SCALE - 2);
    const cy = Math.round(SC - cr * SCALE - 2);
    for (let k = 0; k < 4; k++) {
      put(cx + k, cy, 1);
      put(cx + k, cy + 3, 1);
      put(cx, cy + k, 1);
      put(cx + 3, cy + k, 1);
    }
  }
  // the parade: level lines at 0, 25, 50, 75 and 100 percent
  for (let p = 0; p < 3; p++)
    for (let l = 0; l <= 4; l++) {
      const y = Math.round(PY0 - 0.5 - (PSPAN * l) / 4);
      for (let x = PX0[p]; x < PX0[p] + PW; x++) if (l % 2 === 0 || (x - PX0[p]) % 2 === 0) put(x, y, l % 2 === 0 ? 1 : 0.75);
    }
  return G;
}

// ---- setup
export function setup(P) {
  Object.assign(P, {
    T: 40 + Math.random() * 40, // the video's own clock
    E: new Float32Array(W * H * 3), // phosphor
    Bt: new Float32Array(W * H * 3),
    Bb: new Float32Array(W * H * 3),
    grat: buildGraticule(),
    tau: 0.2, // phosphor persistence in seconds, set from the Glow knob
    kS: 0.5, // how fast the vectorscope's tone map climbs with density
    kP: 0.09, // and the parade's
    warm: false,
    bar: null,
    stop: STOPS.map((s) => s.slice()),
    tmp: [0, 0, 0],
    ou: OU_SIGMA.map((sg) => sg * gauss()), // slow random walks that keep the hues from ever settling into a cycle
    lc: LIGHTS.map(() => [0, 0, 0]),
  });
  spawnBar(P, true);
}

// the bar's saturated flat colour at a place on the hue circle
function barColour(hue, out) {
  for (let i = 0; i < 3; i++) {
    const k = ((5 - 2 * i + hue * 6) % 6 + 6) % 6;
    out[i] = 0.95 - 0.95 * 0.92 * max(0, min(k, 4 - k, 1));
  }
}

function spawnBar(P, anywhere) {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const w = 0.14 + 0.16 * Math.random();
  const old = P.bar;
  let hue = Math.random();
  // not the hue of the bar that has just gone
  if (old && abs(((hue - old.hue + 1.5) % 1) - 0.5) < 0.2) hue = (hue + 0.4) % 1;
  P.bar = {
    w,
    h: 0.2 + 0.24 * Math.random(),
    y: 0.12 + 0.76 * Math.random(),
    dir,
    sp: 0.04 + 0.035 * Math.random(),
    hue,
    turn: (Math.random() < 0.5 ? -1 : 1) * (0.03 + 0.03 * Math.random()), // turns of the hue circle a second
    c: [0, 0, 0],
    x: anywhere ? 0.2 + 0.6 * Math.random() : dir > 0 ? -w * 0.5 - 0.02 : 1 + w * 0.5 + 0.02,
  };
  barColour(hue, P.bar.c);
}

// rotate a colour's chroma by th, keeping its luma
function rotRGB(c, th, out) {
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const cb = (c[2] - y) / 1.8556;
  const cr = (c[0] - y) / 1.5748;
  const co = cos(th);
  const si = sin(th);
  const nb = cb * co - cr * si;
  const nr = cb * si + cr * co;
  const r = y + 1.5748 * nr;
  const b = y + 1.8556 * nb;
  out[0] = cl(r, 0, 1);
  out[1] = cl((y - 0.2126 * r - 0.0722 * b) / 0.7152, 0, 1);
  out[2] = cl(b, 0, 1);
}

function splat(E, x, y, r, g, b, w) {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = floor(fx);
  const y0 = floor(fy);
  const ax = fx - x0;
  const ay = fy - y0;
  const o = (y0 * W + x0) * 3;
  const w00 = (1 - ax) * (1 - ay) * w;
  const w10 = ax * (1 - ay) * w;
  const w01 = (1 - ax) * ay * w;
  const w11 = ax * ay * w;
  E[o] += r * w00;
  E[o + 1] += g * w00;
  E[o + 2] += b * w00;
  E[o + 3] += r * w10;
  E[o + 4] += g * w10;
  E[o + 5] += b * w10;
  const o2 = o + W * 3;
  E[o2] += r * w01;
  E[o2 + 1] += g * w01;
  E[o2 + 2] += b * w01;
  E[o2 + 3] += r * w11;
  E[o2 + 4] += g * w11;
  E[o2 + 5] += b * w11;
}

// ---- one look at the hidden video: sample it, drop every sample on both scopes
function look(P, d, k, w) {
  const E = P.E;
  const T = P.T;
  const g = cl(k[2], -1, 1);
  const cg = g < 0 ? mix(0.3, 1.3, g + 1) : mix(1.3, 2.2, g); // saturation of the grade
  const cm = g < 0 ? g + 1 : 1 + 1.3 * g; // strength of the cast
  const th = TAU * k[0];
  const cth = cos(th);
  const sth = sin(th);
  // the grade's lift and gain, each channel on its own pair of slow waves
  const lift = [0, 0, 0];
  const gain = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = LIFT_W[c];
    lift[c] = cm * (0.12 * (0.55 * sin(a[0] * T + a[2]) + 0.45 * sin(a[1] * T + a[3])) + P.ou[11 + c]);
    const b = GAIN_W[c];
    gain[c] = 1 + 0.15 * cm * (0.55 * sin(b[0] * T + b[2]) + 0.45 * sin(b[1] * T + b[3]));
  }
  // a graduated filter: each channel's gain slopes across the picture, so the parade's plateaus tilt
  const slope = [0, 0, 0];
  for (let c = 0; c < 3; c++) slope[c] = 0.4 * cm * sin(SLOPE_W[c][0] * T + SLOPE_W[c][2]) * (0.7 + 0.3 * sin(SLOPE_W[c][1] * T + SLOPE_W[c][3]));
  // the sky's colours turn slowly
  const stop = P.stop;
  for (let s = 0; s < 5; s++) {
    const ang = 0.42 * sin(STOP_W[s] * T + s * 1.3) + 0.22 * sin(STOP_W2[s] * T + s * 2.1) + P.ou[6 + s];
    rotRGB(STOPS[s], ang, P.tmp);
    stop[s][0] = P.tmp[0];
    stop[s][1] = P.tmp[1];
    stop[s][2] = P.tmp[2];
  }
  const yh0 = 0.5 + 0.06 * sin(0.1613 * T + 0.5) + 0.03 * sin(0.3271 * T + 2.0);
  const tilt = 0.26 * sin(0.0967 * T + 1.1) + 0.1 * sin(0.2173 * T + 4.0);
  const bph = 0.331 * T;
  // each light at this moment
  const L = LIGHTS.map((l, n) => {
    rotRGB(l.c, P.ou[n], P.lc[n]);
    return {
      x: l.x[0] + l.x[1] * sin(l.x[2] * T + l.x[3]) + l.x[4] * sin(l.x[5] * T + l.x[6]) + P.ou[14 + n],
      y: l.y[0] + l.y[1] * sin(l.y[2] * T + l.y[3]) + l.y[4] * sin(l.y[5] * T + l.y[6]) + P.ou[20 + n],
      i2: 1 / (2 * l.s * l.s),
      a: l.a[0] + l.a[1] * sin(l.a[2] * T + l.a[3]),
      c: P.lc[n],
    };
  });
  const bar = P.bar;
  const ASP = 0.75;

  const ps = 0.5 * w; // weight of a point on the vectorscope
  const pp = 0.5 * w; // and on the parade
  for (let j = 0; j < NY; j++) {
    const v = (j + Math.random()) / NY;
    for (let i = 0; i < NX; i++) {
      const u = (i + Math.random()) / NX;
      let r;
      let gr;
      let b;
      // the picture: a sky above a tilted horizon, a dark ground under it
      const yh = yh0 + tilt * (u - 0.5);
      const kk = sm(yh - 0.014, yh + 0.014, v);
      if (kk < 1) {
        let s = cl(v / yh + 0.03 * sin(TAU * 1.3 * u + bph), 0, 1);
        let c0;
        let c1;
        if (s < 0.55) {
          c0 = stop[0];
          c1 = stop[1];
          s /= 0.55;
        } else {
          c0 = stop[1];
          c1 = stop[2];
          s = (s - 0.55) / 0.45;
        }
        s = s * s * (3 - 2 * s);
        s = s * s * (3 - 2 * s);
        s = s * s * (3 - 2 * s);
        r = mix(c0[0], c1[0], s);
        gr = mix(c0[1], c1[1], s);
        b = mix(c0[2], c1[2], s);
      }
      if (kk > 0) {
        const t = cl((v - yh) / (1 - yh), 0, 1);
        // the ground catches a slow ripple, so its band in the parade is not a flat block
        const rip = 1 + 0.4 * sin(TAU * 1.6 * u + 0.5 * bph + 3.5 * t);
        const r2 = mix(stop[3][0], stop[4][0], t) * rip;
        const g2 = mix(stop[3][1], stop[4][1], t) * rip;
        const b2 = mix(stop[3][2], stop[4][2], t) * rip;
        if (kk >= 1) {
          r = r2;
          gr = g2;
          b = b2;
        } else {
          r = mix(r, r2, kk);
          gr = mix(gr, g2, kk);
          b = mix(b, b2, kk);
        }
      }
      // the lights, laid over it; where two meet the later one wins, so the cloud has straight bars between colours
      for (let n = 0; n < 6; n++) {
        const l = L[n];
        const dx = u - l.x;
        const dy = (v - l.y) * ASP;
        const e = (dx * dx + dy * dy) * l.i2;
        if (e > 3.2) continue;
        const q = sm(0.2, 0.7, 1.4 * exp(-e) * l.a);
        r += (l.c[0] - r) * q;
        gr += (l.c[1] - gr) * q;
        b += (l.c[2] - b) * q;
      }
      // the hard-edged bar, flat colour
      if (abs(u - bar.x) < bar.w * 0.5 && abs(v - bar.y) < bar.h * 0.5) {
        r = bar.c[0];
        gr = bar.c[1];
        b = bar.c[2];
      }
      // the grade: saturation about luma, then gain, the sloping filter and lift
      let y = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      const du = u - 0.5;
      r = cl((y + cg * (r - y)) * gain[0] * (1 + slope[0] * du) + lift[0], 0, 1);
      gr = cl((y + cg * (gr - y)) * gain[1] * (1 + slope[1] * du) + lift[1], 0, 1);
      b = cl((y + cg * (b - y)) * gain[2] * (1 + slope[2] * du) + lift[2], 0, 1);
      y = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      // the hue knob turns Cb and Cr and keeps the luma
      const cb0 = (b - y) / 1.8556;
      const cr0 = (r - y) / 1.5748;
      const cb = cb0 * cth - cr0 * sth;
      const cr = cb0 * sth + cr0 * cth;
      r = y + 1.5748 * cr;
      b = y + 1.8556 * cb;
      gr = (y - 0.2126 * r - 0.0722 * b) / 0.7152;
      // vectorscope: Cb to the right, Cr up, in its own hue
      let rad = sqrt(cb * cb + cr * cr) * SCALE;
      const m = rad / SCALE;
      if (rad > 26) rad = 26 + 4.6 * (1 - exp(-(rad - 26) / 4.6));
      const sc = m > 1e-6 ? rad / (m * SCALE) : 1;
      const ang = atan2(cr, cb);
      const li = (((ang / TAU) * 360 + 360.5) % 360 | 0) * 3;
      const sat = 1 - exp(-m / 0.055);
      splat(
        E,
        SC + cb * SCALE * sc,
        SC - cr * SCALE * sc,
        mix(1, LUT[li], sat),
        mix(1, LUT[li + 1], sat),
        mix(1, LUT[li + 2], sat),
        ps,
      );
      // parade: one point per channel at this picture column
      const px = 0.5 + 19 * u;
      splat(E, PX0[0] + px, PY0 - PSPAN * cl(r, 0, 1), PAR[0][0] / 255, PAR[0][1] / 255, PAR[0][2] / 255, pp);
      splat(E, PX0[1] + px, PY0 - PSPAN * cl(gr, 0, 1), PAR[1][0] / 255, PAR[1][1] / 255, PAR[1][2] / 255, pp);
      splat(E, PX0[2] + px, PY0 - PSPAN * cl(b, 0, 1), PAR[2][0] / 255, PAR[2][1] / 255, PAR[2][2] / 255, pp);
    }
  }
}

// persistence in seconds: 0.05 at -1, 0.2 at the opening 0.06, 1.5 at 1
function tauOf(k4) {
  const k = cl(k4, -1, 1);
  return 0.2 * exp((k < 0.06 ? 1.31 : 2.14) * (k - 0.06));
}

function step(P, d, k) {
  const tau = tauOf(k[3]);
  P.tau = tau;
  const a = exp(-d / tau);
  const E = P.E;
  for (let i = 0; i < E.length; i++) E[i] *= a;
  // brighter points as the glow lengthens, but not in step with the glow
  const w = d * 30 * pow(tau / 0.2, -0.75);
  look(P, d, k, w);
  // the bar crosses slowly and is replaced when it has gone
  const bar = P.bar;
  const sp = cl(k[1], 0.25, 3) / 2;
  bar.x += bar.dir * bar.sp * d * sp;
  bar.hue += bar.turn * d * sp;
  barColour(bar.hue, bar.c);
  // the random walks, pulled back toward nothing with a time constant of OU_TAU
  const dv = d * sp;
  const rho = exp(-dv / OU_TAU);
  const ns = sqrt(1 - rho * rho);
  for (let i = 0; i < P.ou.length; i++) P.ou[i] = rho * P.ou[i] + ns * OU_SIGMA[i] * gauss();
  if ((bar.dir > 0 && bar.x - bar.w * 0.5 > 1.02) || (bar.dir < 0 && bar.x + bar.w * 0.5 < -0.02)) spawnBar(P, false);
}

export function update(dt, input, P) {
  if (!P.E) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const speed = cl(k[1], 0.25, 3) / 2;
  if (!P.warm) {
    P.warm = true;
    // open on phosphor that has been burning for a while
    const tau = tauOf(k[3]);
    const n = cl(Math.ceil((3 * tau) / (1 / 15)), 8, 45);
    for (let s = 0; s < n; s++) {
      P.T += speed / 15;
      step(P, 1 / 15, k);
    }
  }
  if (d <= 0) return;
  P.T += d * speed;
  step(P, d, k);
}

// ---- drawing: blur the phosphor a little, tone map it, lay the graticule over it
export function draw(display, P) {
  if (!P.E) return;
  const E = P.E;
  const A = P.Bt;
  const B = P.Bb;
  const a = 0.2;
  const c = 1 - 2 * a;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const xl = x > 0 ? o - 3 : o;
      const xr = x < W - 1 ? o + 3 : o;
      A[o] = c * E[o] + a * (E[xl] + E[xr]);
      A[o + 1] = c * E[o + 1] + a * (E[xl + 1] + E[xr + 1]);
      A[o + 2] = c * E[o + 2] + a * (E[xl + 2] + E[xr + 2]);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const yu = y > 0 ? o - W * 3 : o;
      const yd = y < H - 1 ? o + W * 3 : o;
      B[o] = c * A[o] + a * (A[yu] + A[yd]);
      B[o + 1] = c * A[o + 1] + a * (A[yu + 1] + A[yd + 1]);
      B[o + 2] = c * A[o + 2] + a * (A[yu + 2] + A[yd + 2]);
    }
  const G = P.grat;
  for (let y = 0; y < H; y++) {
    const kt = y < 64 ? P.kS : P.kP;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const m = max(B[o], B[o + 1], B[o + 2]);
      let r = 0;
      let g = 0;
      let bl = 0;
      if (m > 1e-5) {
        // the vectorscope takes a square root of the density and bends it; the parade cuts the faint floor off and saturates the plateaus
        const lv = y < 64 ? pow(1 - exp(-kt * sqrt(m)), 2.1) : pow(1 - exp(-kt * max(0, m - 0.9)), 1.3);
        const s = (lv * 255) / m;
        r = B[o] * s;
        g = B[o + 1] * s;
        bl = B[o + 2] * s;
      }
      const gr = G[y * W + x];
      if (gr > 0) {
        r += gr * SLATE[0];
        g += gr * SLATE[1];
        bl += gr * SLATE[2];
      }
      display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, bl) | 0);
    }
  }
}
