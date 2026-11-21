// ===== Patternflow pattern =====
// Title:   Light Pillars
// Family:  pillars
// Idea:    On a very cold clear night a row of far-off lamps stands along the horizon of a dark navy sky, and above each lamp rises a tall column of its own colour made of glittering sparks, as if the lamp were mirrored up the sky by a thin layer of flat ice plates: the columns are brightest at the lamp, thin out into rarer and rarer glints as they climb, shimmer as the plates flutter, near lamps throw tall bright ones and far lamps short faint ones, and over minutes the layer thickens and thins so that the columns rise and sink.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: light pillars as glints from nearly flat hexagonal ice plates (Robert Greenler, Rainbows, Halos, and Glories, 1980; Walter Tape, Atmospheric Halos, 1994), pattern round 212
// Round:   212
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ice=0..4, Lamps=-1..1, Flutter=-1..1
//
// Knob 1: Hue. Turns the lamps' colours round the colour wheel on the YIQ chroma plane, so the white lamps stay white. At 0 the lamps are sodium orange, white, mercury teal, red and violet; a half turn makes them blue, white, red, teal and yellow-green.
// Knob 2: Ice. How thick the layer of plates is, which sets the height of the columns. The top of the layer is 0.12 km at 0, 0.38 km where it opens at 2 and 1.2 km at 4, before the slow breathing of the layer takes 40 percent off or adds 40 percent; the nearest lamp's column would then be 31, 97 and 306 LEDs tall, and the one at 8 km a seventh of that.
// Knob 3: Lamps. How many lamps stand along the horizon, 3 at -1, 8.5 where it opens at 0, 14 at 1. A lamp between two counts is part way into view.
// Knob 4: Flutter. How far the plates tilt about the line of sight, which is the width of a column, and how fast they flutter. At -1 the tilt is 0.5 degrees and the columns are narrow and steady, changing over about 1.8 s; at 1 it is 1.5 degrees and they are wide and quick, changing over 0.36 s.

// The picture is a view along the ground at night. One LED is 0.4 degrees, so 143 rows
// are a radian (K). A lamp at ground distance D shows below the horizon by (eye height /
// D) times K, and a plate at height u above the lamp, half way between the eye and the
// lamp, mirrors the lamp's light to the eye at 2u/D radians above the lamp, in the
// lamp's own direction across. Plates exist up to the top of the cold layer, so the
// glints make a column that rises to 2 H_top K / D rows above the lamp: a near lamp
// (D 1.1 km) has a column almost three times as tall as a lamp at 3 km. How bright a row
// is follows how many plates there are at that height, exp(-u / H0), and the lamp's power
// over D squared. A plate tilted about the line of sight by t sends its glint 2t to
// the side, so the column is 2 sigma wide, sigma being the spread of the tilt.
// The glints are independent: each cell of the column is lit by value noise in
// (x, y, time) whose lattice is about 3 LEDs wide, 1.6 tall and 0.4 to 1.8 s long,
// raised to the third power so a spark is sharp and rare, and the density of the plates
// decides how many cells are lit. The unresolved plates add a soft glow under it.
// Every column leans a little with height and the lean wanders, as the mean tilt of the
// plates changes with the wind aloft. The layer's thickness breathes on three sines
// that do not divide one another, a little out of step across the sky.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, pow, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const HOR = 104; // the horizon row
const K = 143; // rows to a radian
const EYE = 0.126; // km above the lamps' ground, so the nearest lamp stands 18 rows under the horizon
const CELLH = 1.6; // lattice spacing of the sparks, rows
const GAIN = 1.7; // how fast the light of piled-up sparks goes to white

// sodium orange, white LED, mercury teal, red, violet
const BASE = [
  [255, 150, 40], [230, 240, 255], [90, 230, 255], [255, 60, 50], [170, 110, 255],
].map((c) => c.map((v) => v / 255));

// x is the left LED of the 2 by 2 core, D the ground distance in km, c the colour, dr how
// far the lamp's ground rises over the flat (rows), wf / tf / sf the column's own width,
// flutter speed and lean, and pw its power. The first lamps are spread so that any count
// is an even picture.
const LAMPS = [
  { x: 11, D: 1.12, c: 0, dr: 0, wf: 1.1, tf: 1.0, sf: 1.0, pw: 1.0 },
  { x: 45, D: 1.55, c: 1, dr: 0, wf: 0.9, tf: 1.2, sf: 0.8, pw: 1.0 },
  { x: 28, D: 2.9, c: 2, dr: 0, wf: 1.25, tf: 0.8, sf: 1.2, pw: 1.1 },
  { x: 57, D: 2.3, c: 3, dr: 1, wf: 1.0, tf: 0.9, sf: 1.1, pw: 1.2 },
  { x: 3, D: 4.2, c: 4, dr: 0, wf: 0.8, tf: 1.1, sf: 0.9, pw: 1.3 },
  { x: 37, D: 5.2, c: 0, dr: -1, wf: 1.1, tf: 1.3, sf: 1.0, pw: 1.3 },
  { x: 20, D: 1.9, c: 1, dr: 1, wf: 0.85, tf: 0.7, sf: 0.7, pw: 1.0 },
  { x: 51, D: 3.6, c: 2, dr: 0, wf: 1.0, tf: 1.0, sf: 1.3, pw: 1.2 },
  { x: 61, D: 6.2, c: 1, dr: 0, wf: 1.2, tf: 0.9, sf: 1.0, pw: 1.4 },
  { x: 15, D: 5.8, c: 3, dr: -2, wf: 0.9, tf: 1.2, sf: 0.8, pw: 1.4 },
  { x: 41, D: 7.2, c: 4, dr: -1, wf: 1.0, tf: 0.8, sf: 1.1, pw: 1.5 },
  { x: 7, D: 2.7, c: 2, dr: 2, wf: 1.15, tf: 1.1, sf: 1.2, pw: 1.1 },
  { x: 33, D: 3.9, c: 3, dr: 0, wf: 0.8, tf: 0.9, sf: 0.9, pw: 1.2 },
  { x: 55, D: 8.0, c: 0, dr: -1, wf: 1.0, tf: 1.2, sf: 1.0, pw: 1.5 },
];
LAMPS.forEach((L, i) => {
  L.row = Math.round(HOR + (EYE * K) / L.D + L.dr);
  L.cx = L.x + 1; // the centre of the core
  L.seed = (i * 7919 + 101) | 0;
  L.ph = i * 3.7;
  // the lamp's power over D squared, held up a little so that a far lamp still shows
  L.amp = cl(0.3 + 0.7 * pow(1.1 / L.D, 1.2), 0, 1) * L.pw;
});

// A colour turned round the wheel on the YIQ chroma plane, which leaves white white,
// brought to a full brightest channel.
function turned(c, hue) {
  const cs = cos(2 * PI * hue), sn = sin(2 * PI * hue);
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const I = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2];
  const Q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
  const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
  const r = cl(y + 0.956 * I2 + 0.621 * Q2, 0, 1);
  const g = cl(y - 0.272 * I2 - 0.647 * Q2, 0, 1);
  const b = cl(y - 1.106 * I2 + 1.703 * Q2, 0, 1);
  const top = max(r, g, b, 0.01);
  return [r / top, g / top, b / top];
}

function hash3(ix, iy, it, sd) {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(it, 0x9e3779b1) ^ sd;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) * (1 / 4294967296);
}

// The thickness of the layer over a lamp at column x, as a multiple of its mean.
const breath = (t, x) =>
  1 + 0.2 * sin((2 * PI * t) / 113 + 0.7 + x * 0.045) + 0.12 * sin((2 * PI * t) / 61.7 + 2.9 - x * 0.03) + 0.07 * sin((2 * PI * t) / 197.3 + 4.4 + x * 0.02);

// The lean of the columns, LEDs sideways per row of height.
const lean = (t) => 0.036 * sin((2 * PI * t) / 53.1 + 1.2) + 0.022 * sin((2 * PI * t) / 131 + 4.0) + 0.011 * sin((2 * PI * t) / 17.3 + 0.4);

export function setup(params) {
  params.s = {
    t: 0, init: false,
    hue: 0, ice: 2, cnt: 8.5, fl: 0.06,
    hueT: 0, iceT: 2, cntT: 8.5, flT: 0.06,
    cols: BASE.map((c) => c.slice()), colHue: -1,
    acc: new Float32Array(W * H * 3),
    gl: new Float32Array(W * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.hueT = cl(kn[0], 0, 1);
  S.iceT = cl(kn[1], 0, 4);
  S.cntT = 8.5 + 5.5 * cl(kn[2], -1, 1);
  S.flT = cl(kn[3], -1, 1);
  const d = cl(dt || 0, 0, 0.1);
  if (!S.init) {
    S.init = true;
    S.hue = S.hueT; S.ice = S.iceT; S.cnt = S.cntT; S.fl = S.flT;
  } else {
    const k = 1 - exp(-d / 0.35);
    S.hue += (S.hueT - S.hue) * k;
    S.ice += (S.iceT - S.ice) * k;
    S.cnt += (S.cntT - S.cnt) * k;
    S.fl += (S.flT - S.fl) * k;
  }
  S.t += d;
  if (abs(S.hue - S.colHue) > 0.001) {
    S.colHue = S.hue;
    S.cols = BASE.map((c) => turned(c, S.hue));
  }
}

function column(S, L, w, col, acc) {
  const t = S.t;
  const iceH = 0.12 * pow(10, S.ice / 4); // km
  const Htop = iceH * breath(t, L.cx);
  const H0 = 0.7 * Htop; // the plates' scale height
  const hTop = (2 * Htop * K) / L.D; // rows
  const sig = 0.866 * pow(3, S.fl / 2); // tilt spread, degrees (0.5 .. 1.5)
  const std = (0.5 + 2.0 * sig) * L.wf; // the column's width, LEDs
  const cw = 1.2 + 0.7 * std; // lattice spacing across, LEDs
  const tau = 0.8 * pow(2.2, -S.fl) * L.tf; // decorrelation time, s
  const gt = t / tau + L.ph;
  const it = floor(gt), ft = gt - it, ut = ft * ft * (3 - 2 * ft);
  const sh = lean(t) * L.sf;
  const norm = pow(2.3 / std, 0.35);
  const A = L.amp * w * norm * (1 + 0.05 * sin(t * 1.7 + L.ph));
  const sd = L.seed;
  const y1 = L.row; // the column starts at the top of the core
  const rmax = min(y1, hTop * 1.05);
  for (let y = y1 + 1; y >= max(0, y1 - rmax); y--) {
    const r = y1 - y; // rows above the lamp
    let dens;
    if (r < 0) dens = exp(-r * r * 0.25);
    else {
      const u = (r * L.D) / (2 * K); // km above the lamp
      dens = exp(-u / H0) * sm(1.0, 0.7, (r + 0.5) / hTop);
    }
    if (dens * A < 0.004) continue;
    const cxr = L.cx + sh * max(r, 0);
    const gy = (y + 0.5) / CELLH + L.seed * 0.013;
    const iy = floor(gy), fy = gy - iy, uy = fy * fy * (3 - 2 * fy);
    const xa = max(0, floor(cxr - 3.2 * std)), xb = min(W - 1, ceil(cxr + 3.2 * std));
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cxr;
      const env = exp(-(dx * dx) / (2 * std * std));
      const gx = (x + 0.5) / cw + L.seed * 0.0071;
      const ix = floor(gx), fx = gx - ix, ux = fx * fx * (3 - 2 * fx);
      // value noise in (x, y, t)
      const a0 = hash3(ix, iy, it, sd), a1 = hash3(ix + 1, iy, it, sd);
      const b0 = hash3(ix, iy + 1, it, sd), b1 = hash3(ix + 1, iy + 1, it, sd);
      const c0 = hash3(ix, iy, it + 1, sd), c1 = hash3(ix + 1, iy, it + 1, sd);
      const d0 = hash3(ix, iy + 1, it + 1, sd), d1 = hash3(ix + 1, iy + 1, it + 1, sd);
      const n0 = (a0 + (a1 - a0) * ux) * (1 - uy) + (b0 + (b1 - b0) * ux) * uy;
      const n1 = (c0 + (c1 - c0) * ux) * (1 - uy) + (d0 + (d1 - d0) * ux) * uy;
      const n = n0 + (n1 - n0) * ut;
      const bias = 0.1 + 0.7 * dens * pow(env, 0.6);
      const v = cl(bias + (n - 0.5) * 2.3, 0, 1);
      const spark = min(1, 2.4 * v * v * v);
      const light = A * env * (r < 3 ? 0.7 + 0.1 * r : 1) * (1.5 * spark * (0.55 + 0.45 * pow(dens, 0.5)) + 0.2 * dens);
      const i = (y * W + x) * 3;
      acc[i] += light * col[0];
      acc[i + 1] += light * col[1];
      acc[i + 2] += light * col[2];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc, gl = S.gl;
  acc.fill(0);
  gl.fill(0);
  const cnt = S.cnt;
  for (let k = 0; k < LAMPS.length; k++) {
    const L = LAMPS[k];
    const w = sm(0, 1, cnt - k);
    if (w <= 0) continue;
    const col = S.cols[L.c];
    column(S, L, w, col, acc);
    // the glow the lamp puts on the haze at the horizon
    const gs = 5;
    for (let x = max(0, floor(L.cx - 3 * gs)); x <= min(W - 1, ceil(L.cx + 3 * gs)); x++) {
      const e = exp(-((x + 0.5 - L.cx) ** 2) / (2 * gs * gs)) * L.amp * w * 0.35;
      gl[x * 3] += e * col[0];
      gl[x * 3 + 1] += e * col[1];
      gl[x * 3 + 2] += e * col[2];
    }
  }
  // the lamps themselves: a 2 by 2 core and a soft halo
  for (let k = 0; k < LAMPS.length; k++) {
    const L = LAMPS[k];
    const w = sm(0, 1, cnt - k);
    if (w <= 0) continue;
    const col = S.cols[L.c];
    const near = cl(1.1 / L.D, 0, 1);
    const sg = 1.0 + 1.6 * near;
    const flick = 1 + 0.06 * sin(S.t * 2.3 + L.ph) * sin(S.t * 0.9 + L.ph * 2);
    const b = (0.5 + 0.5 * near) * w * flick;
    for (let y = max(0, L.row - 8); y <= min(H - 1, L.row + 9); y++)
      for (let x = max(0, floor(L.cx - 10)); x <= min(W - 1, floor(L.cx + 10)); x++) {
        const dx = x + 0.5 - L.cx, dy = y + 0.5 - (L.row + 1);
        const q = (dx * dx) / (1.5 * sg * sg) + (dy * dy) / (sg * sg);
        let a = 0.6 * b * exp(-q / 2);
        const core = x >= L.x && x <= L.x + 1 && y >= L.row && y <= L.row + 1;
        if (core) a += 3.0 * b;
        if (a < 0.003) continue;
        const i = (y * W + x) * 3;
        const wh = core ? 0.55 : 0.3;
        acc[i] += a * (col[0] + (1 - col[0]) * wh);
        acc[i + 1] += a * (col[1] + (1 - col[1]) * wh);
        acc[i + 2] += a * (col[2] + (1 - col[2]) * wh);
      }
  }
  for (let y = 0; y < H; y++) {
    let sr, sg2, sb;
    let gk = 0;
    if (y < HOR) {
      const t = pow(y / HOR, 1.4);
      sr = 4 + 6 * t; sg2 = 8 + 10 * t; sb = 28 + 24 * t;
      gk = 0.7 * exp(-(HOR - 1 - y) / 5);
    } else {
      sr = 3; sg2 = 3; sb = 7;
      gk = 0.3 * exp(-(y - HOR) / 5);
    }
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = acc[i] + gk * gl[x * 3], g = acc[i + 1] + gk * gl[x * 3 + 1], b = acc[i + 2] + gk * gl[x * 3 + 2];
      display.setPixel(
        x, y,
        sr + (255 - sr) * (1 - exp(-GAIN * r)),
        sg2 + (255 - sg2) * (1 - exp(-GAIN * g)),
        sb + (255 - sb) * (1 - exp(-GAIN * b)),
      );
    }
  }
}
