// ===== Patternflow pattern =====
// Title:   Seafloor Stripes
// Family:  tectonic
// Idea:    A mid-ocean ridge runs down the middle of the panel in four segments that step sideways at transform faults, and each segment pushes new crust out to both edges at its own slightly different rate, freezing the random flips of the Earth's magnetic field into amber and teal stripes of every width, so the picture is mirrored about the glowing ridge and stepped like brickwork along the faults.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: magnetic stripes of the spreading seafloor (Frederick Vine and Drummond Matthews, 1963; Lawrence Morley, 1963)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..4, Reversals=-1..1, Offset=-1..1
//
// Knob 1: Hue. Turns the pair of polarities together round the wheel, from amber and a deep teal where the knob opens, and the hot ridge with them.
// Knob 2: Spread. How fast new crust is made, from standing still at the bottom of the knob, where only the ridge breathes, to about 2.8 LEDs a second at the top; it opens on about 1.4.
// Knob 3: Reversals. How often the field flipped in the time the stripes record, so how wide the bands are: about 6 LEDs on average where the knob opens, about 16 at the bottom, with some twice that, and about 4 at the top, where the thinnest are still 2 LEDs wide.
// Knob 4: Offset. How far the faults throw the ridge sideways and how unevenly the segments spread: at the bottom the ridge is one straight line and the stripes run unbroken, where the knob opens the steps are 3 to 8 LEDs and the segments differ by 8 percent in speed, and at the top the steps are 6 to 15 LEDs and the speeds differ by 16.

const W = 64;
const H = 128;
const MID = 32;
const SEGS = 4;
// How many spreading-time units the table of reversals must reach back: the widest age a stripe can have on the panel.
const AMAX = 110;
// Table units a second at Spread 1. One unit is one LED of crust at the nominal rate and the nominal band width.
const RATE = 0.7;
// The gaps between reversals, in table units: at least 4.4, then 2.2 more on average and never more than 8.5 more, and now and then a short event of 4.6.
const GAP_MIN = 4.4;
const GAP_MORE = 2.2;
const SHORT = 4.6;
const SHORT_ODDS = 0.11;
const GAP_CAP = 8.5;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, v) {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
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

// The next gap between two reversals of the field.
function gap() {
  return Math.random() < SHORT_ODDS ? SHORT : GAP_MIN + Math.min(GAP_MORE * -Math.log(1 - Math.random()), GAP_CAP);
}

// Draw reversals ahead until the table reaches past time theta.
function extend(params, theta) {
  const rev = params.rev;
  while (params.cursor <= theta + 1) {
    params.cursor += gap();
    rev.push({ t: params.cursor, a: 0.88 + 0.12 * Math.random() });
  }
}

// Forget the reversals older than any stripe on the panel can be.
function forget(params, theta) {
  const rev = params.rev;
  while (rev.length > 3 && rev[1].t < theta - AMAX) {
    const old = rev.shift();
    params.par0 ^= 1;
    params.amp0 = old.a;
  }
}

export function setup(params) {
  params.t = 0;
  params.theta = 0;
  params.started = false;
  // The history of the field, drawn forward from before the oldest crust on the panel to now.
  params.par0 = Math.random() < 0.5 ? 0 : 1;
  params.amp0 = 0.88 + 0.12 * Math.random();
  params.rev = [];
  params.cursor = -AMAX - 40;
  extend(params, 0);
  // The ridge in four segments. Each steps sideways from the one before, one way and then the other.
  const first = Math.random() < 0.5 ? 1 : -1;
  const off = [0];
  for (let s = 1; s < SEGS; s++) off.push(off[s - 1] + first * (s % 2 ? 1 : -1) * (3.5 + 5.5 * Math.random()));
  const mean = (Math.max(...off) + Math.min(...off)) / 2;
  params.off = off.map((v) => v - mean);
  // Each segment spreads a little faster or slower than the rest, neighbours on opposite sides of the mean.
  const flip = Math.random() < 0.5 ? 1 : -1;
  params.sd = Array.from({ length: SEGS }, (_, s) => flip * (s % 2 ? 1 : -1) * (0.45 + 0.55 * Math.random()));
  // And a little faster to one side of its ridge than the other.
  const lean = Math.random() < 0.5 ? 1 : -1;
  params.lean = Array.from({ length: SEGS }, () => lean * (0.8 + 0.4 * Math.random()));
  params.ph = Array.from({ length: SEGS }, () => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28]);
  // The faults sit about a quarter of the panel apart and drift a few rows.
  params.fy = [32, 64, 96].map((y) => y + 6 * (Math.random() * 2 - 1));
  params.fph = Array.from({ length: 3 }, () => [Math.random() * 6.28, Math.random() * 6.28]);
  params.fault = new Float32Array(3);
  params.cols = Array.from({ length: SEGS }, () => new Float32Array(W * 3));
  params.p0 = new Float32Array(3);
  params.p1 = new Float32Array(3);
  params.hot = new Float32Array(3);
  params.tmp = new Float32Array(4);
}

// The colour of the crust at distance dist from the ridge, with ridge speed u, into out.
function crust(params, dist, u, m, out) {
  const rev = params.rev;
  const tau = params.theta - dist / (m * u);
  let idx = -1;
  for (let k = 0; k < rev.length; k++) {
    if (rev[k].t <= tau) idx = k;
    else break;
  }
  const pol = (params.par0 + idx + 1) & 1;
  const amp = idx < 0 ? params.amp0 : rev[idx].a;
  // How far, in LEDs, this stripe's nearer and farther edges are, and the stripe beyond whichever is closer.
  const toward = idx + 1 < rev.length ? (rev[idx + 1].t - tau) * m * u : 99;
  const away = idx >= 0 ? (tau - rev[idx].t) * m * u : 99;
  const near = Math.min(toward, away);
  const nextAmp = toward < away ? rev[idx + 1].a : idx > 0 ? rev[idx - 1].a : params.amp0;
  // Older crust has cooled and its magnetisation weakened a little.
  const dark = 1 - 0.18 * Math.pow(clamp(dist / 45, 0, 1), 0.8);
  const w = near < 0.5 ? 0.5 * (1 - near / 0.5) : 0;
  const a = params[pol ? "p1" : "p0"];
  const b = params[pol ? "p0" : "p1"];
  // Where two stripes meet the one LED between them is dimmed, so the edge is a thin dark seam and not a grey blend of two colours.
  const seam = 1 - w;
  const ka = amp * dark * (1 - w) * seam;
  const kb = nextAmp * dark * w * seam;
  out[0] = a[0] * ka + b[0] * kb;
  out[1] = a[1] * ka + b[1] * kb;
  out[2] = a[2] * ka + b[2] * kb;
  out[3] = pol;
}

function paint(params, m, e) {
  const { cols, hot, tmp, t } = params;
  for (let s = 0; s < SEGS; s++) {
    const ph = params.ph[s];
    // Each segment's ridge sits where the faults put it, plus a slow drift that grows with the offset.
    const xr = clamp(MID + e * 1.7 * params.off[s] + e * (5.2 * Math.sin(0.037 * t + ph[0]) + 3 * Math.sin(0.0113 * t + ph[1])), 12, 52);
    const v = 1 + 0.16 * e * params.sd[s];
    const lean = 0.025 * params.lean[s] * (1 + 0.4 * e * params.sd[s]);
    // The ridge swells and dims a little, each segment on its own beat.
    const beat = 0.5 + 0.3 * Math.sin(0.9 * t + ph[2]) + 0.2 * Math.sin(0.37 * t + ph[3]);
    const half = 1.9 * (0.88 + 0.24 * beat);
    const glow = 255 * (0.92 + 0.08 * beat);
    // The ridge swells whiter as it brightens.
    hsv(params.hue, 0.55 - 0.28 * beat, 1, hot);
    const col = cols[s];
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - xr;
      const dist = Math.abs(dx);
      crust(params, dist, v * (dx < 0 ? 1 - lean : 1 + lean), m, tmp);
      // The crust near the ridge is still warm, and brighter as the ridge swells.
      const warm = 1 + (0.1 + 0.16 * beat) * Math.exp(-dist / 9);
      tmp[0] *= warm;
      tmp[1] *= warm;
      tmp[2] *= warm;
      // The ridge is fresh crust, hot whatever its polarity. Against the teal it is set off by a seam like the stripes' own.
      const g = 1 - smooth(half - 0.5, half + 0.5, dist);
      const seam = 1 - (tmp[3] ? 0.6 : 0.1) * 4 * g * (1 - g);
      for (let c = 0; c < 3; c++) col[x * 3 + c] = (tmp[c] * (1 - g) + hot[c] * glow * g) * seam;
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const rate = RATE * clamp(k[1], 0, 4);
  const kr = clamp(k[2], -1, 1);
  const m = Math.exp(kr < 0 ? -0.9 * kr : -0.4 * kr);
  const e = (clamp(k[3], -1, 1) + 1) / 2;
  // The crust has been spreading for a while when the panel opens.
  if (!params.started) {
    params.started = true;
    params.theta = 40 * rate;
  }
  params.t += dt;
  params.theta += dt * rate;
  extend(params, params.theta);
  forget(params, params.theta);
  hsv(k[0] + 0.1, 0.95, 0.95, params.p0);
  hsv(k[0] + 0.1 + 0.43, 1, 0.74, params.p1);
  params.hue = k[0] + 0.1;
  for (let i = 0; i < 3; i++) {
    params.p0[i] *= 255;
    params.p1[i] *= 255;
  }
  paint(params, m, e);
  for (let f = 0; f < 3; f++) {
    const base = params.fy[f];
    const ph = params.fph[f];
    params.fault[f] = base + e * (3 * Math.sin(0.031 * params.t + ph[0]) + 1.5 * Math.sin(0.0123 * params.t + ph[1]));
  }
}

export function draw(display, params) {
  const { cols, fault } = params;
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    const s = yc < fault[0] ? 0 : yc < fault[1] ? 1 : yc < fault[2] ? 2 : 3;
    const col = cols[s];
    for (let x = 0; x < W; x++) display.setPixel(x, y, clamp(col[x * 3], 0, 255), clamp(col[x * 3 + 1], 0, 255), clamp(col[x * 3 + 2], 0, 255));
  }
}
