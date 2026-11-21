// ===== Patternflow pattern =====
// Title:   Doppler Rings
// Family:  doppler
// Idea:    A point source glides along a long, never-closing Lissajous path and lets go of a ring every half second or so, each ring fixed where it was let go and spreading at 16 LEDs a second, so the rings crowd in front of the source and open out behind it; as its speed rises to the speed of the waves they pile into a bright shock front ahead of it, and past that they trail the straight edges of a Mach cone, every point of every ring coloured by the pitch an ear there would hear, blue where the source was coming at it, red where it was leaving and white where it was passing by.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Doppler effect (Christian Doppler, 1842), Buys Ballot's trumpeters on a train (1845), the Mach cone in Ernst Mach's photographs of bullets in flight (1887), pattern round 211
// Round:   211
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pulse=1.2..3, Mach=-1..1, Orbit=-1..1
//
// Knob 1: Hue. Turns the whole colour ramp round the colour wheel together, keeping its white middle. At 0 it is blue for a source coming at you, white for one passing and red for one going away; a quarter turn makes them green and violet, a half turn amber and cyan.
// Knob 2: Pulse. How many rings the source lets go of a second, from 1.2 to 3, give or take an eighth as the minutes pass. The rings spread at 16 LEDs a second, so a source standing still leaves them 13.3 LEDs apart at 1.2, 8 apart where the knob opens at 2, and 5.3 apart at 3.
// Knob 3: Mach. How fast the source goes, as a multiple of the 16 LEDs a second the rings spread at. Its speed swings between 0.22 and 1.78 times the mean, and the knob sets the mean: 0.2 at -1, 0.85 at 0 where it opens, 1.8 at 1. Low, the rings sit almost round each other and the source drifts. In the middle it climbs past the speed of the waves now and then, so that a Mach cone opens and closes. At the top it is past them most of the time and trails a narrow cone.
// Knob 4: Orbit. How big a path the source runs. At -1 the path is at most 22 LEDs wide and 43 tall and the source turns every few seconds; at 0 it is 47 by 93; at 1 it can reach 62 by 124, nearly the whole panel. It opens at 0.06, on a path 47 by 95.

// Every ring is a circle about the place the source was when it let the ring
// go, and its radius is C times the time since, whatever the source does after.
// A point on a ring at angle t from the way the source was heading, which was
// at M times C, has the pitch ratio f / f0 = 1 / (1 - M cos t), above 1 ahead
// and below 1 behind. Past M = 1 the ratio goes negative on the forward arc
// of a ring, where the source has already overtaken it; the colour takes its
// size, which is the bluest where the ring touches the cone.

const W = 64, H = 128;
const { floor, ceil, sqrt, sin, cos, exp, log, abs, min, max, pow, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const C = 16; // how fast a ring spreads, LEDs a second
const RMAX = 112; // the radius at which a ring has faded out
const PRE = RMAX / C; // seconds of rings laid down before the first frame
const STEPS = 180; // physics steps a second
const MAXR = 64;
const AX = 31, AY = 62; // half the path's width and height at full size, LEDs
const POS = 1.7, NEG = 1.0; // octaves of pitch up and down that saturate the blue and the red
const GAIN = 1.5; // how fast the light of piled-up rings goes to white
const BG = [2, 5, 22];
const AMP = 0.95; // the brightness of a ring just let go

// The pitch ratio f / f0 = 1 / (1 - M cos t) goes to a colour in 257 steps,
// from the reddest, a ratio of a half, to the bluest, a ratio of 3.2 or more.
function lutFor(hue) {
  const lut = new Float32Array(257 * 3);
  const cs = cos(2 * PI * hue), sn = sin(2 * PI * hue);
  const blue = [0.18, 0.5, 1.0], white = [1, 1, 1], red = [1.0, 0.22, 0.16];
  for (let i = 0; i <= 256; i++) {
    const s = i / 128 - 1, a = abs(s), from = s < 0 ? red : blue;
    let r = white[0] + (from[0] - white[0]) * a, g = white[1] + (from[1] - white[1]) * a, b = white[2] + (from[2] - white[2]) * a;
    // The ramp turns round the wheel on the YIQ chroma plane, which leaves
    // the white in the middle white.
    const y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
    const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
    r = cl(y + 0.956 * I2 + 0.621 * Q2, 0, 1);
    g = cl(y - 0.272 * I2 - 0.647 * Q2, 0, 1);
    b = cl(y - 1.106 * I2 + 1.703 * Q2, 0, 1);
    // Every step of the ramp keeps its brightest channel at full, so a dull
    // orange or teal from the turn is brought up to a bright one.
    const top = max(r, g, b, 0.01);
    lut[i * 3] = r / top;
    lut[i * 3 + 1] = g / top;
    lut[i * 3 + 2] = b / top;
  }
  return lut;
}

// The speed of the source as a multiple of its mean: three slow swings that
// never line up, so the mean is 1 and the swing runs from 0.22 to 1.78.
const gait = (t) => 1 + 0.4 * sin((2 * PI * t) / 21.7 + 0.9) + 0.26 * sin((2 * PI * t) / 8.9 + 2.6) + 0.12 * sin((2 * PI * t) / 3.7 + 4.0);

// The path: three sines a side, no two of them in a whole-number ratio, so
// the source never runs the same track twice.
function pathAt(u, sc, out) {
  const ax = AX * sc, ay = AY * sc;
  out[0] = W / 2 + ax * (0.7 * sin(0.8314 * u + 0.4) + 0.18 * sin(1.5132 * u + 2.1) + 0.12 * sin(0.4373 * u + 5.0));
  out[1] = H / 2 + ay * (0.7 * sin(1.0 * u + 1.3) + 0.18 * sin(1.9895 * u + 0.2) + 0.12 * sin(0.5713 * u + 3.3));
  out[2] = ax * (0.7 * 0.8314 * cos(0.8314 * u + 0.4) + 0.18 * 1.5132 * cos(1.5132 * u + 2.1) + 0.12 * 0.4373 * cos(0.4373 * u + 5.0));
  out[3] = ay * (0.7 * cos(1.0 * u + 1.3) + 0.18 * 1.9895 * cos(1.9895 * u + 0.2) + 0.12 * 0.5713 * cos(0.5713 * u + 3.3));
}

function sizeOf(k) {
  return k < 0 ? 0.75 * pow(0.35 / 0.75, -k) : 0.75 + 0.25 * k;
}

function machOf(k) {
  return k < 0 ? 0.85 * pow(0.2 / 0.85, -k) : 0.85 * pow(1.8 / 0.85, k);
}

export function setup(params) {
  params.s = {
    hue: -1, lut: null, acc: new Float32Array(W * H * 3), p: [0, 0, 0, 0],
    t: 0, u: 0.7, x: W / 2, y: H / 2, warm: false,
    rate: 2, rateT: 2, mm: 0.85, mmT: 0.85, sc: 0.75, scT: 0.75,
    emit: 0.5, rings: [],
  };
}

function step(S, h) {
  const k = (tau) => 1 - exp(-h / tau);
  S.rate += (S.rateT - S.rate) * k(0.35);
  S.mm += (S.mmT - S.mm) * k(0.5);
  S.sc += (S.scT - S.sc) * k(0.8);
  S.t += h;
  const p = S.p, sc = S.sc * (1 + 0.05 * sin((2 * PI * S.t) / 51.3 + 2.0) + 0.04 * sin((2 * PI * S.t) / 113.1 + 0.3));
  pathAt(S.u, sc, p);
  // Along the path at the speed asked for: M times C LEDs a second.
  S.u += (S.mm * gait(S.t) * C * h) / max(hypot(p[2], p[3]), 8);
  pathAt(S.u, sc, p);
  const vx = (p[0] - S.x) / h, vy = (p[1] - S.y) / h;
  const sp = hypot(vx, vy);
  S.x = p[0];
  S.y = p[1];
  // The pulse breathes a little, an eighth either way at most, on two slow beats.
  const er = S.rate * (1 + 0.06 * sin((2 * PI * S.t) / 29.3 + 1.1) + 0.06 * sin((2 * PI * S.t) / 67.7 + 4.2));
  S.emit += er * h;
  if (S.emit >= 1) {
    S.emit -= 1;
    // The ring was let go a little before this step ended.
    const over = S.emit / er;
    const ex = sp > 1e-6 ? vx / sp : 1, ey = sp > 1e-6 ? vy / sp : 0;
    S.rings.push({ x: S.x - vx * over, y: S.y - vy * over, ex, ey, M: sp / C, t0: S.t - over });
  }
  while (S.rings.length && C * (S.t - S.rings[0].t0) > RMAX) S.rings.shift();
  if (S.rings.length > MAXR) S.rings.shift();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.hueT = cl(kn[0], 0, 1);
  S.rateT = cl(kn[1], 1.2, 3);
  S.mmT = machOf(cl(kn[2], -1, 1));
  S.scT = sizeOf(cl(kn[3], -1, 1));
  if (!S.warm) {
    // Rings that are already standing when the pattern opens.
    S.warm = true;
    S.rate = S.rateT;
    S.mm = S.mmT;
    S.sc = S.scT;
    for (let i = 0; i < PRE * STEPS; i++) step(S, 1 / STEPS);
  } else {
    const d = cl(dt || 0, 0, 0.1), n = max(1, ceil(d * STEPS));
    for (let i = 0; i < n; i++) step(S, d / n);
  }
  if (!S.lut || abs(S.hueT - S.hue) > 0.002) {
    S.hue = S.hueT;
    S.lut = lutFor(S.hue);
  }
}

function ring(S, rg, acc) {
  const r = C * (S.t - rg.t0);
  const fade = 1 - r / RMAX;
  if (fade <= 0) return;
  const sig = 0.95 + 0.011 * r, inv = 1 / (2 * sig * sig);
  let amp = AMP * pow(fade, 1.2);
  if (r < 3) amp *= r / 3;
  const ro = r + 3 * sig, ri = r - 3 * sig, px = rg.x, py = rg.y, ex = rg.ex, ey = rg.ey, M = rg.M, lut = S.lut;
  const y0 = max(0, floor(py - ro - 0.5)), y1 = min(H - 1, ceil(py + ro - 0.5));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - py, o2 = ro * ro - dy * dy;
    if (o2 <= 0) continue;
    const xo = sqrt(o2);
    const xi = ri > 0 && abs(dy) < ri ? sqrt(ri * ri - dy * dy) : 0;
    for (let side = 0; side < (xi > 0 ? 2 : 1); side++) {
      const xa = xi > 0 ? (side ? px + xi : px - xo) : px - xo, xb = xi > 0 ? (side ? px + xo : px - xi) : px + xo;
      const x0 = max(0, ceil(xa - 0.5)), x1 = min(W - 1, floor(xb - 0.5));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px, d = sqrt(dx * dx + dy * dy), e = d - r;
        const w = exp(-e * e * inv);
        if (w < 0.01) continue;
        const cosT = d > 1e-6 ? (ex * dx + ey * dy) / d : 0;
        let den = abs(1 - M * cosT);
        if (den < 0.03) den = 0.03;
        const l = -log(den) * 1.4426950408889634;
        const s = cl(l > 0 ? l / POS : l / NEG, -1, 1);
        const c = ((s + 1) * 127.5 + 0.5) | 0, i = (y * W + x) * 3, a = w * amp;
        acc[i] += a * lut[c * 3];
        acc[i + 1] += a * lut[c * 3 + 1];
        acc[i + 2] += a * lut[c * 3 + 2];
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.lut) return;
  const acc = S.acc;
  acc.fill(0);
  for (let k = 0; k < S.rings.length; k++) ring(S, S.rings[k], acc);
  // The source itself: a white point with a faint halo.
  const sx = S.x, sy = S.y;
  for (let y = max(0, floor(sy - 9)); y <= min(H - 1, floor(sy + 9)); y++)
    for (let x = max(0, floor(sx - 9)); x <= min(W - 1, floor(sx + 9)); x++) {
      const dx = x + 0.5 - sx, dy = y + 0.5 - sy, q = dx * dx + dy * dy;
      const a = 0.9 * exp(-q / 2) + 0.1 * exp(-q / 18), i = (y * W + x) * 3;
      acc[i] += a;
      acc[i + 1] += a;
      acc[i + 2] += a;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = acc[i], g = acc[i + 1], b = acc[i + 2];
      if (r + g + b <= 0) {
        display.setPixel(x, y, BG[0], BG[1], BG[2]);
        continue;
      }
      display.setPixel(
        x, y,
        BG[0] + (255 - BG[0]) * (1 - exp(-GAIN * r)),
        BG[1] + (255 - BG[1]) * (1 - exp(-GAIN * g)),
        BG[2] + (255 - BG[2]) * (1 - exp(-GAIN * b)),
      );
    }
}
