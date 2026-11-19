// ===== Patternflow pattern =====
// Title:   Throng
// Family:  geometry
// Idea:    A row of tall bars runs from the left wall to the right across the top half of the panel and the flow slows in the middle, so the bars bunch up there: the knob turns the slowing up and holds where the gaps close and the bars in the slow place run together into one block, which bars then enter at one end and leave at the other.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 188
// Round:   190
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3, Jam=-24..24, Span=0..1
//
// Knob 1: Hue. The colour of every bar, all the way round the wheel from blue.
// Knob 2: Speed. How fast the bars run where the way is clear, from standing still at the bottom of the knob to 24 LEDs a second at the top; in the slow place they run at a share of that. Two slow clocks, one 1.618 times the other, bend the pace by a fifth either way, so the stream never settles into one beat.
// Knob 3: Jam. How hard the flow slows in the slow place, counted in clicks. It opens at 0 with the bars 12 LEDs apart there, and each click up closes the gap by 1.2 LEDs until on click 10 the bars touch and the three or so in the slow place are one block. The knob holds there for clicks 11 and 12 as well. Past that the flow slows nearly to a stop and the queue backs up toward the left wall, up to 14 LEDs by click 24, so more bars run into the block. Below 0 the gap opens by 0.25 LED a click, up to the free flow's 18 LEDs at the bottom of the knob.
// Knob 4: Span. How long the slow place is, from 18 LEDs at the bottom of the knob to 42 at the top, centred a little right of the middle of the panel. It does not go shorter, because a slow place that cannot hold two bars at once has nothing to close.

const W = 64;
const H = 128;

// The bars are 6 LEDs wide and 46 tall and stand with their tops at row 17; they run from just off the left wall to just off the right.
const SW = 6;
const SH = 46;
// Where the stream starts, as the middle of a shape that has just left the panel, which way it runs as a unit vector, and how far it goes along that line.
const X0 = -5;
const Y0 = 40;
const UX = 1;
const UY = 0;
const LEN = 74;
// How far apart the shapes are along the stream in free flow, and the closest two can be along it and still share an edge.
const STEP = 24;
const TOUCH = Math.min(SW / Math.abs(UX || 1e-9), SH / Math.abs(UY || 1e-9));
// The middle of the slow place along the stream, the length of the ramps into and out of it, and the width Knob 4 gives it from one end to the other.
const MIDC = 38;
const RAMP = 14;
const SPAN_MIN = 18;
const SPAN_MAX = 42;
// Knob 3 has 48 clicks and opens on click 0. The gap between two shapes in the slow place closes on click STOP and the knob holds there for HOLD more clicks. GAP0 is that gap where the knob opens, and the gap grows by LEFT a click below it, up to the free flow's. Past the hold the slow place slows to at most SLOWEST and backs up BACK LEDs upstream.
const STOP = 10;
const HOLD = 2;
const GAP0 = 12;
const LEFT = 0.25;
const SLOWEST = 0.95;
const BACK = 14;
const TOP = 24;
// How far two shapes overlap when they have closed, so the closed gap stays closed whatever the rounding of the edges does.
const LAP = 0.05;
// The free flow's speed in LEDs a second at Speed 1, and the clock the speed is bent by.
const FLOW = 8;
const BEND = 0.22;
const SLOW_CLOCK = 0.2;
const PHI0 = 9;
const DS = 0.25;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(x) {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
}

// What Knob 3 asks of the slow place at a click c: how much it slows the flow, from 0 to 1, and how many LEDs it backs up upstream.
function jam(c, out) {
  const tight = TOUCH - LAP;
  const free = STEP - tight;
  let gap;
  let f = 0;
  if (c <= 0) gap = Math.min(free, GAP0 - c * LEFT);
  else if (c < STOP) gap = (GAP0 * (STOP - c)) / STOP;
  else gap = 0;
  if (c > STOP + HOLD) f = clamp((c - STOP - HOLD) / (TOP - STOP - HOLD), 0, 1);
  const closed = 1 - tight / STEP;
  out.k = gap > 0 ? 1 - (tight + gap) / STEP : closed + (SLOWEST - closed) * f;
  out.back = BACK * f;
}

// The speed along the stream as a share of the free flow, 1 outside the slow place and 1 - k in it.
function speed(P, s) {
  let w;
  if (s < P.a) w = smooth((s - (P.a - RAMP)) / RAMP);
  else if (s <= P.b) w = 1;
  else w = smooth(1 - (s - P.b) / RAMP);
  return 1 - P.k * w;
}

// The time each place along the stream is reached at, counted from a shape entering at the start and moving at free flow: the integral of one over the speed.
function clock(P) {
  const n = Math.floor(LEN / DS) + 1;
  let prev = 1 / speed(P, 0);
  P.tau[0] = 0;
  for (let j = 1; j < n; j++) {
    const cur = 1 / speed(P, j * DS);
    P.tau[j] = P.tau[j - 1] + 0.5 * (prev + cur) * DS;
    prev = cur;
  }
  P.n = n;
}

// Where along the stream a shape is when the clock reads t.
function where(P, t) {
  let lo = 0;
  let hi = P.n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P.tau[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = P.tau[hi] - P.tau[lo];
  return (lo + (span > 0 ? (t - P.tau[lo]) / span : 0)) * DS;
}

export function setup(params) {
  params.t = 0;
  params.phi = PHI0;
  params.col = new Float32Array(3);
  params.m = new Uint8Array(W * H);
  params.J = { k: 0, back: 0 };
  params.P = { tau: new Float64Array(Math.floor(LEN / DS) + 2), n: 0, k: -1, a: 0, b: 0 };
  params.key = "";
  params.xs = new Float64Array(128);
  params.ys = new Float64Array(128);
  params.count = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const P = params.P;
  jam(clamp(k[2], -24, 24), params.J);
  const width = SPAN_MIN + (SPAN_MAX - SPAN_MIN) * clamp(k[3], 0, 1);
  const a = MIDC - width / 2 - params.J.back;
  const b = MIDC + width / 2;
  const key = params.J.k + "/" + a + "/" + b;
  if (key !== params.key) {
    params.key = key;
    P.k = params.J.k;
    P.a = a;
    P.b = b;
    clock(P);
  }
  // The free flow's pace is bent by two slow clocks that never come round together, so the stream never settles into one beat. Both ride the time the Lab hands in and the pace is zero when Speed is.
  const bend = 1 + (BEND * (Math.sin(SLOW_CLOCK * t) + 0.6 * Math.sin(SLOW_CLOCK * 1.618 * t + 1.1))) / 1.6;
  params.phi += dt * FLOW * clamp(k[1], 0, 3) * bend;
  // A shape's place comes from when it came in: the shapes come in one STEP apart on the clock, so shape i has been in for phi - i * STEP.
  const end = P.tau[P.n - 1];
  const hi = Math.floor(params.phi / STEP);
  const lo = Math.ceil((params.phi - end) / STEP);
  let n = 0;
  for (let i = hi; i >= lo && n < 128; i--) {
    const s = where(P, params.phi - i * STEP);
    params.xs[n] = X0 + UX * s;
    params.ys[n] = Y0 + UY * s;
    n++;
  }
  params.count = n;
  hsv(k[0] + 0.62, 0.6, 0.9, params.col);
}

export function draw(display, params, time) {
  const { m, col, xs, ys, count } = params;
  m.fill(0);
  for (let i = 0; i < count; i++) {
    const x0 = Math.ceil(xs[i] - SW / 2 - 0.5);
    const y0 = Math.ceil(ys[i] - SH / 2 - 0.5);
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + SH); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + SW); x++) m[y * W + x] = 1;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = m[y * W + x];
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
