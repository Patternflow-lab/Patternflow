// ===== Patternflow pattern =====
// Title:   Multiplicative Cascade
// Family:  fractal
// Idea:    The panel's mass is halved thirteen times, across and down in turn, down to single LEDs, each half taking a random log-normal weight of mean 1, and every LED shows the log of its own share as light and the share of its 8 x 8 block as hue, so a patchwork of mint and violet rectangles of every size glitters at the LED level while the weights turn over level by level from the two halves down to the single LEDs and mass flows from half to half at each scale; Spread pushes the weights across the Kahane-Peyrière threshold, past which the total mass drains away and what is left gathers into a few sparks.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: multiplicative cascade (Benoit Mandelbrot, 1974), with the degeneracy threshold of Jean-Pierre Kahane and Jacques Peyrière (1976), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=0.4..1.6, Couple=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 heavy 8 x 8 blocks are mint, middling ones blue and light ones violet, with the heaviest LEDs near white; at 0.25 heavy blocks turn blue and light ones red; at 0.5 heavy ones pink and light ones green; at 0.75 heavy ones yellow and light ones azure. Dim orange and yellow are lifted by up to half so they do not read brown.
// Knob 2: Speed. The weights turn over one level at a time, from the panel's two halves down to the single LEDs. At 2 a level takes 1.2 s to turn from its old draws to new ones, the next level starts 0.4 s later, and the sweep comes round every 6.4 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Spread. tau = E[W log2 W] for each weight W = exp(sigma G - sigma^2 / 2), from 0.4 to 1.6 (sigma 0.74 to 1.49). Kahane and Peyrière's threshold is tau = 1: below it the mass survives every halving, at and above it the total dies away. Medians of 2,000 cascades: at 0.4 the total mass is 0.64 after 7 halvings and 0.61 after 13, 98% of the LEDs show above the black floor and the heaviest 1% hold half the mass; at 1 the total falls from 0.24 to 0.15, half the LEDs show and the top 1% hold 86%; at 1.6 it falls from 0.057 to 0.019, 16% show and the top 1% hold 95%. The floor stays at 1/8100 of an even share, so lost mass shows as dark.
// Knob 4: Couple. The correlation of the two halves' log weights at every split, -1 to 1. At -1 one half gains in log exactly what the other loses, so mass trades across every split line and each split shows a hard step; at the opening 0.06 the halves are close to independent, Mandelbrot's canonical cascade; at 1 both halves of a split take the same weight, no split line has a step of its own and the patches grow larger and softer. Each weight keeps its own law, so the threshold stays at tau = 1 (John Biggins, 1977), though after 13 halvings at Spread 1 the median total mass is 0.25 at -1, 0.15 at 0 and 0.08 at 1.

const W = 64, H = 128, N = W * H;
// Thirteen halvings, across and down in turn, take the panel to single
// LEDs. Node 1 is the panel, nodes 2n and 2n + 1 the halves of node n, and
// nodes 8192..16383 the LEDs.
const L = 13, NODES = 1 << (L + 1);
const { floor, min, max, sqrt, cos, sin, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The window of log mass shown, in units of the natural log of mass times
// 8192: 0 is an LED's even share of the panel's mass, LO is shown black and
// HI white. It does not move with the knobs, so lost mass shows as dark.
const LO = -9, HI = 2;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * Math.random());
}

// Which LED each leaf is: bit k of the path from the panel down picks the
// upper or lower half for odd k and the left or right half for even k.
const LED = new Int16Array(N);
for (let n = 0; n < N; n++) {
  let x = 0, y = 0;
  for (let k = 1; k <= L; k++) {
    const b = (n >> (L - k)) & 1;
    if (k & 1) y = y * 2 + b;
    else x = x * 2 + b;
  }
  LED[n] = y * W + x;
}

// The weights change one level at a time, coarse to fine: level k starts
// k - 1 steps after the panel's own halves, takes SPAN steps to turn from
// its old draws to new ones, and the sweep comes round every CYCLE steps.
const SPAN = 3, CYCLE = 16, STEPS = 2.5;
// Steps of block weight in the colour table.
const HB = 16;

export function setup(params) {
  const S = {
    hue: -1, speed: 2, tau: 0.4, rho: 0, phi: 0, cyc: new Int32Array(L + 1).fill(-1),
    a: new Float32Array(NODES), b: new Float32Array(NODES),
    acc: new Float32Array(NODES), g: new Float32Array(NODES), pal: new Float32Array(HB * 256 * 3),
  };
  // Each weight's normal G turns from one draw a to the next b along a
  // quarter circle, cos(t) a + sin(t) b, which is again standard normal at
  // every moment, so the cascade's law holds while it moves.
  for (let n = 2; n < NODES; n++) {
    S.a[n] = gauss();
    S.b[n] = gauss();
  }
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.speed = cl(kv[1], 0.2, 3);
  S.tau = cl(kv[2], 0.4, 1.6);
  S.rho = cl(kv[3], -1, 1);
  if (kv[0] !== S.hue) palette(S, cl(kv[0], 0, 1));
  const { a, b, g: G, acc } = S;
  S.phi += (d * S.speed * STEPS) / 2;
  for (let k = 1; k <= L; k++) {
    const sk = S.phi - (k - 1), c = floor(sk / CYCLE), u = sk - c * CYCLE;
    if (c !== S.cyc[k]) {
      // A new turn for this level: the old target is the new start.
      S.cyc[k] = c;
      for (let n = 1 << k; n < 2 << k; n++) {
        a[n] = b[n];
        b[n] = gauss();
      }
    }
    const p = cl(u / SPAN, 0, 1), t = (PI / 2) * p * p * (3 - 2 * p), ct = cos(t), st = sin(t);
    for (let n = 1 << k; n < 2 << k; n++) G[n] = ct * a[n] + st * b[n];
  }
  // Spread is tau = E[W log2 W]; for W = exp(sigma G - sigma^2 / 2) that is
  // sigma^2 / (2 ln 2).
  const sig = sqrt(2 * Math.LN2 * S.tau), half = (sig * sig) / 2;
  const r = S.rho, r2 = sqrt(1 - r * r);
  // The first half takes its own normal; the second takes rho times its
  // sibling's plus its own, so both are standard normal and their
  // correlation is rho. Each half's log weight adds to its parent's log mass.
  acc[1] = 0;
  for (let n = 2; n < NODES; n += 2) {
    const g1 = G[n], g2 = r * g1 + r2 * G[n + 1], up = acc[n >> 1] - half;
    acc[n] = up + sig * g1;
    acc[n + 1] = up + sig * g2;
  }
}

// Colour by two depths of the same cascade: the hue says how heavy the
// LED's 8 x 8 block (seven halvings down) is against a typical block at
// this Spread, the light says how heavy the LED itself is against an even
// share. Rows of the table are HB steps of block weight, columns 256 steps
// of LED weight.
function palette(S, hue) {
  S.hue = hue;
  for (let j = 0; j < HB; j++) {
    const z = (2 * j) / (HB - 1) - 1;
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      const h = 0.62 + hue - 0.2 * z - 0.05 * v, hh = h - floor(h);
      // Orange and yellow are lifted so that dim ones do not read brown, and
      // deep blue is paled a little, since it reads darkest on the LEDs.
      const warm = max(0, cos(2 * PI * (hh - 0.11))) ** 2, blue = max(0, cos(2 * PI * (hh - 0.67)));
      const sat = 0.95 - 0.12 * blue - 0.7 * v ** 5;
      hsv(h, sat, i ? min(1, (0.08 + 0.92 * v) * (1 + 0.5 * warm)) : 0, S.pal, (j * 256 + i) * 3);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { acc, pal } = S, k = 255 / (HI - LO);
  // A block seven halvings down carries seven weights; its log weight
  // against an even share has mean -7 sigma^2 / 2 and spread sigma sqrt 7.
  const sig = sqrt(2 * Math.LN2 * S.tau), m7 = (-7 * sig * sig) / 2, s7 = 1 / (sig * sqrt(7));
  for (let n = 0; n < N; n++) {
    const p = LED[n], x = p & 63, y = p >> 6;
    const v = acc[N + n] - LO;
    if (v <= 0) {
      display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const z = Math.tanh((acc[(N + n) >> 6] - m7) * s7 * 0.8);
    const c = ((((z + 1) * (HB - 1)) / 2 + 0.5) | 0) * 768 + min(255, (v * k) | 0) * 3;
    display.setPixel(x, y, (255 * pal[c]) | 0, (255 * pal[c + 1]) | 0, (255 * pal[c + 2]) | 0);
  }
}
