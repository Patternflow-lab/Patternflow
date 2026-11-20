// ===== Patternflow pattern =====
// Title:   Deflection
// Family:  crt
// Idea:    The bare raster of a picture tube, its scan lines rolling slowly up a black screen, with a magnet held against the glass that wanders over it: the lines bend into S-curves and whorls round the pole, and where the bend is strongest the three colour beams part and the white line splits into red, green and blue.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: after Nam June Paik, Magnet TV (1965)
// Round:   198
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Pull=0..3, Lines=16..52, Split=0..1
//
// Knob 1: Tint. The colour of the phosphor where the three beams still land together, from a cold blue-white round the wheel; the split beams keep their own red, green and blue.
// Knob 2: Pull. How strong the magnet is. At the bottom of the knob it is gone and the lines run straight; it opens on 2, where the lines near the pole fold into an S, and at the top they wind round it.
// Knob 3: Lines. How many scan lines the raster has, from 16 bold ones 8 LEDs apart where the knob opens to 52 that crowd into a glow wherever the magnet bunches them.
// Knob 4: Split. How differently the magnet bends the three beams. Near the bottom the lines stay white almost everywhere; at the top they come apart into red, green and blue wherever they bend.

const W = 64;
const H = 128;

// How wide the magnet's reach is, in LEDs: the twist falls off as a Gaussian of this radius. The second, weaker magnet is held the other way round.
const REACH = 26;
const REACH2 = 18;
const SECOND = 0.4;
// The twist at the pole, in half turns, for each step of Knob 2.
const TWIST = 0.5;
// How far the beams part at the top of Knob 4, as a share of the twist.
const PART = 0.3;
// The raster creeps up the screen at this many LEDs a second, and a hum bar of this height drifts the other way.
const ROLL = 2.6;
const HUM = 70;
// Half the width of a scan line on the glass, in LEDs. It stays this wide however the magnet bends the line.
const HALF = 0.95;
// Each LED is the mean of SS by SS samples.
const SS = 3;

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

export function setup(params) {
  params.t = 0;
  params.roll = 0;
  params.tint = new Float32Array(3);
  // Where the two magnets are and how hard each pulls, set in update.
  params.m = new Float32Array(6);
  params.pull = 2;
  params.lines = 16;
  params.split = 0.06;
  // For each beam, the height on the undisturbed raster that lands on each corner of each LED, a row of W + 1 corners for each of H + 1 rows.
  params.v = [0, 1, 2].map(() => new Float32Array((W + 1) * (H + 1)));
  params.beam = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 16, 0.06];
  params.t += dt;
  const t = params.t;
  params.roll += dt * ROLL;
  params.pull = clamp(k[1], 0, 3);
  params.lines = clamp(k[2], 16, 52);
  params.split = clamp(k[3], 0, 1);
  // A cold blue-white at the bottom of the knob. The tint stops short of the full colour, so the lines still read as light.
  hsv(k[0] + 0.6, 0.62, 1, params.tint);

  // The hand wanders: each magnet follows two slow sines on each axis whose periods never line up, so it does not come back the same way.
  const m = params.m;
  m[0] = 32 + 15 * Math.sin(0.137 * t + 0.4) + 6 * Math.sin(0.311 * t + 2.1);
  m[1] = 66 + 36 * Math.sin(0.0713 * t + 0.9) + 12 * Math.sin(0.229 * t + 0.3);
  // The magnet is turned over now and then: the bend eases to nothing and comes back the other way.
  const flip = Math.tanh(2.6 * Math.sin(0.047 * t + 1.2));
  m[2] = flip * (0.92 + 0.08 * Math.sin(0.53 * t));
  m[3] = 32 - 20 * Math.sin(0.097 * t + 2.6) + 5 * Math.sin(0.41 * t);
  m[4] = 64 - 46 * Math.sin(0.0571 * t + 0.2) + 9 * Math.sin(0.187 * t + 1.7);
  m[5] = -SECOND * flip * (0.85 + 0.15 * Math.sin(0.37 * t + 0.8));
}

// The height on the undisturbed raster that a beam lands at (x, y) from, when its twist is scaled by g. Each magnet turns the picture about itself by an angle that falls off with distance and keeps distances, so undoing it is turning back by the same angle; the second magnet is undone first.
function source(x, y, m, twist, g) {
  let dx = x - m[3];
  let dy = y - m[4];
  let a = -twist * g * m[5] * Math.exp(-(dx * dx + dy * dy) / (REACH2 * REACH2));
  let c = Math.cos(a);
  let s = Math.sin(a);
  x = m[3] + dx * c - dy * s;
  y = m[4] + dx * s + dy * c;
  dx = x - m[0];
  dy = y - m[1];
  a = -twist * g * m[2] * Math.exp(-(dx * dx + dy * dy) / (REACH * REACH));
  c = Math.cos(a);
  s = Math.sin(a);
  return m[1] + dx * s + dy * c;
}

export function draw(display, params) {
  const { m, tint, roll, v, beam } = params;
  const twist = params.pull * Math.PI * TWIST;
  const gap = H / params.lines;
  const part = PART * params.split;
  const inv = 1 / (SS * SS);
  // Each beam's height on the raster at every LED corner, counted in scan lines.
  for (let g = 0; g < 3; g++) {
    const scale = 1 + (g - 1) * part;
    const vg = v[g];
    for (let y = 0, i = 0; y <= H; y++) for (let x = 0; x <= W; x++, i++) vg[i] = (source(x, y, m, twist, scale) + roll) / gap;
  }
  for (let y = 0; y < H; y++) {
    // The hum bar: a soft band a little brighter than the rest that drifts down while the lines roll up.
    const hum = 0.8 + 0.2 * Math.cos(((y - roll * 2.3) / HUM) * Math.PI * 2);
    for (let x = 0; x < W; x++) {
      const i = y * (W + 1) + x;
      for (let g = 0; g < 3; g++) {
        const vg = v[g];
        const a = vg[i];
        const b = vg[i + 1];
        const c = vg[i + W + 1];
        const d = vg[i + W + 2];
        // How many scan lines a step of one LED crosses here. A line is drawn the same width on the glass wherever it is, so where the magnet crowds the lines they run together into a glow.
        const gx = (b - a + d - c) * 0.5;
        const gy = (c - a + d - b) * 0.5;
        const dens = Math.max(Math.sqrt(gx * gx + gy * gy), 1e-4);
        let sum = 0;
        for (let sy = 0; sy < SS; sy++) {
          const fy = (sy + 0.5) / SS;
          const l = a + (c - a) * fy;
          const r = b + (d - b) * fy;
          for (let sx = 0; sx < SS; sx++) {
            const s = l + (r - l) * ((sx + 0.5) / SS);
            const e = 1 - Math.abs(s - Math.round(s)) / dens / HALF;
            // Flat across the middle of the line and soft at its edges.
            if (e > 0) sum += e > 0.5 ? 1 : e * 2;
          }
        }
        // Lines that run together share the beam, so the glow they make is dimmer than one line alone.
        const crowd = dens * 2 * HALF;
        beam[g] = Math.min(1, sum * inv) * (crowd > 1 ? 1 / Math.sqrt(crowd) : 1);
      }
      // Where the three beams land together the line is the phosphor's own tint; where they part, each keeps its own colour.
      const white = Math.min(beam[0], beam[1], beam[2]);
      const vv = 255 * hum;
      display.setPixel(
        x,
        y,
        clamp((white * tint[0] + beam[0] - white) * vv, 0, 255),
        clamp((white * tint[1] + beam[1] - white) * vv, 0, 255),
        clamp((white * tint[2] + beam[2] - white) * vv, 0, 255),
      );
    }
  }
}
