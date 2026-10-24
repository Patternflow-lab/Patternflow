// ===== Patternflow pattern =====
// Title:   Moving Sofa
// Family:  geometry
// Idea:    Hammersley's sofa, two quarter discs set apart by a block with a half disc cut from its inner side, is carried up the right leg of a hallway fourteen LEDs wide, round the corner with the inner corner riding inside its hole, across the top and down the left leg, and in every turn a faint strip trailing behind it is shaved off by the walls until only the sofa is left.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: moving sofa problem (Leo Moser, 1966) and Hammersley's sofa (John Hammersley, 1968), pattern round 34
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hole=-1..1, Trail=0..1
//
// Knob 1: Hue. Turns every colour once round the wheel. At 0 the sofa is teal with a gold rim on its hole and the walls are lavender; at 0.25 the sofa is violet with a green rim, at 0.5 brick red with a blue rim, at 0.75 green with a pink rim.
// Knob 2: Speed. At 2 a sofa comes up the right leg at 34 LEDs a second, takes 2.4 seconds over each corner and 1.4 seconds across the top, and a new one sets off every 6.2 seconds; at 0.2 a corner takes 24 seconds, at 3 it takes 1.6 and a sofa sets off every 4.1 seconds.
// Knob 3: Hole. The radius r of the hole, in hallway widths. At 0 it is Hammersley's 2/pi = 0.637, the largest sofa of this shape, area pi/2 + 2/pi = 2.2074 widths squared and 46 LEDs long; at -1 r = 0 and the sofa is a half disc of area pi/2 = 1.571 that pivots on the inner corner; at 1 r = 1, area 2, and the two quarter discs meet at a single point above the hole.
// Knob 4: Trail. How long the floor keeps a glow where the sofas have passed, a fade time of 0.25 seconds at 0, 0.36 at 0.06, 2.5 at 0.5 and 7.8 at 1 (at Speed 2). Turned up, the whole hallway glows except the two outer corners, which no sofa ever reaches.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, abs, round, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => {
  t = cl(t, 0, 1);
  return t * t * (3 - 2 * t);
};

// One corner of the hallway, in widths: the arm the sofa comes along is
// 0 <= wy <= 1, wx <= 1, the arm it leaves by 0 <= wx <= 1, wy <= 1, the
// inner corner the origin and the outer corner (1, 1). On the panel the right
// corner has wx running up the right leg and wy across, X = XC + U wy and
// Y = YC - U wx; the left corner is its mirror image, X -> 64 - X.
const U = 14, XC = 49, YC = 15;

// Hole 0 is r = 2/pi, where the area pi/2 + 2r - pi r^2 / 2 is largest.
// Gerver's sofa of 1992, area 2.2195, is larger still and is not drawn here.
const R_OPT = 2 / PI;
const holeRadius = (k) => (k < 0 ? R_OPT * (1 + k) : R_OPT + (1 - R_OPT) * k);

// Signed distance, in widths, to Hammersley's sofa with hole radius r: the
// points with y >= 0 within 1 of the segment from (-r, 0) to (r, 0), less
// the half disc of radius r on the origin. Negative inside. Below the flat
// side it is the distance to the two flat pieces, so a sharp end of the hole
// touching a wall does not bleed into the wall's LED.
function sdf(x, y, r) {
  const ax = abs(x);
  if (y < 0) {
    const ex = ax < r ? r - ax : ax > r + 1 ? ax - r - 1 : 0;
    return sqrt(ex * ex + y * y);
  }
  const dx = ax > r ? ax - r : 0;
  return max(-y, sqrt(dx * dx + y * y) - 1, r - sqrt(x * x + y * y));
}
// Whether the sofa's nearest edge to (x, y) is the hole's semicircle.
const notch = (x, y, r) => r > 0.02 && x * x + y * y < (r + 0.12) * (r + 0.12) && abs(x) < r + 0.04;

// How far (x, y), in the sofa's frame, lies inside every position the
// hallway has taken in a turn so far, th of the way round, starting from the
// strip behind the sofa's front: negative once some wall has passed through
// it. The outer wall a = 1 has kept (x - r, y) within 1 of the origin in the
// directions 0..th, the wall b = 1 has done the same for (x + r, y) in the
// directions 90..90+th degrees, and the inner corner has cut from the hole
// the part below the chord from (-r, 0) at angle th. At th = 90 degrees
// this is the sofa.
function block(x, y, th, r) {
  const ct = cos(th), st = sin(th);
  let s = min(y, 1 - y, r + 1 - x);
  const vx = x - r, vy = y;
  if (vy >= 0 && vx * st - vy * ct >= 0) s = min(s, 1 - sqrt(vx * vx + vy * vy));
  else s = min(s, 1 - vx, 1 - vx * ct - vy * st);
  const wx = x + r, wy = y;
  if (wx <= 0 && wy * st + wx * ct >= 0) s = min(s, 1 - sqrt(wx * wx + wy * wy));
  else s = min(s, 1 - wy, 1 + wx * st - wy * ct);
  return min(s, max(sqrt(x * x + y * y) - r, -wx * st + wy * ct));
}

// The motion, seen from the sofa: the hallway is turned through th and its
// inner corner sits at c. While th runs from 0 to 90 degrees c runs round
// the hole's semicircle, c = r (cos 2th, sin 2th). By Thales the inner walls
// then pass through the hole's two ends, and the outer walls stay tangent to
// the two quarter discs, so the sofa touches both outer walls all the way
// round. Phases, in seconds at Speed 2: up the right leg, round the right
// corner, across the top, round the left corner (the right one mirrored and
// run backwards), down the left leg.
const TA = 4.4, TB = 2.4, TC = 1.4;
const T1 = TA, T2 = T1 + TB, T3 = T2 + TC, T4 = T3 + TB, LIFE = T4 + TA;
// A new sofa sets off as the last one starts round the right corner, so it
// reaches that corner as the last one leaves the left.
const PERIOD = TB + TC + TB;
// Up the leg from below the panel, and the run across the top.
const DA = 9.2, EC = (XC - (64 - XC)) / U;
const KE = 0.3, VE = 1 / (1 - KE / 2);
// Constant speed, then a stop over the last KE of the way.
function easeOut(t) {
  t = cl(t, 0, 1);
  if (t <= 1 - KE) return VE * t;
  const s = t - (1 - KE);
  return VE * (1 - KE + s - (s * s) / (2 * KE));
}
function turn(th, r, o) {
  o.th = th;
  o.cx = r * cos(2 * th);
  o.cy = r * sin(2 * th);
}
// Pose at phase ph: o.m is 1 when it is given in the left corner's mirrored
// frame.
function pose(ph, r, o) {
  o.m = 0;
  o.cy = 0;
  if (ph < T1) {
    o.th = 0;
    o.cx = r + DA * (1 - easeOut(ph / TA));
  } else if (ph < T2) turn((PI / 2) * sm((ph - T1) / TB), r, o);
  else if (ph < T3) {
    o.th = PI / 2;
    o.cx = -r - (EC - 2 * r) * sm((ph - T2) / TC);
  } else {
    o.m = 1;
    if (ph < T4) turn((PI / 2) * (1 - sm((ph - T3) / TB)), r, o);
    else {
      o.th = 0;
      o.cx = r + DA * (1 - easeOut(1 - (ph - T4) / TA));
    }
  }
  return o;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Calls f(X, Y, sx, sy) for every LED near the sofa at pose P, with (sx, sy)
// the LED centre in the sofa's frame.
function eachLed(P, r, f, xa = -r - 1, xb = r + 1) {
  const ct = cos(P.th), st = sin(P.th);
  let x0 = 99, x1 = -99, y0 = 999, y1 = -999;
  for (const [sx, sy] of [[xa, 0], [xb, 0], [xa, 1], [xb, 1]]) {
    const ex = sx - P.cx, ey = sy - P.cy, wx = ex * ct + ey * st, wy = -ex * st + ey * ct;
    const X = XC + U * wy, Y = YC - U * wx;
    x0 = min(x0, X), x1 = max(x1, X), y0 = min(y0, Y), y1 = max(y1, Y);
  }
  x0 = max(0, floor(x0) - 1), x1 = min(W - 1, floor(x1) + 1), y0 = max(0, floor(y0) - 1), y1 = min(H - 1, floor(y1) + 1);
  for (let Y = y0; Y <= y1; Y++)
    for (let Xm = x0; Xm <= x1; Xm++) {
      const wx = (YC - (Y + 0.5)) / U, wy = (Xm + 0.5 - XC) / U;
      f(P.m ? W - 1 - Xm : Xm, Y, P.cx + wx * ct - wy * st, P.cy + wx * st + wy * ct);
    }
}

export function setup(params) {
  params.s = {
    clock: 0, hue: 0, speed: 2, hole: 0, trail: 0.06, r: R_OPT, warm: false,
    wake: new Float32Array(N), buf: new Float32Array(N * 3),
    pose: { th: 0, cx: 0, cy: 0, m: 0 }, c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0],
  };
}

// Advance the clock by dc and let the floor's glow where the sofas have been
// fade.
function step(S, dc) {
  S.clock += dc;
  const keep = exp(-dc / (0.25 + 1.5 * S.trail + 6 * S.trail * S.trail)), r = S.r, wake = S.wake;
  for (let p = 0; p < N; p++) wake[p] *= keep;
  const first = floor((S.clock - LIFE) / PERIOD) + 1, last = floor(S.clock / PERIOD);
  for (let n = first; n <= last; n++) {
    const ph = S.clock - n * PERIOD;
    if (ph < 0 || ph > LIFE) continue;
    eachLed(pose(ph, r, S.pose), r, (X, Y, sx, sy) => {
      const cov = cl(0.5 - sdf(sx, sy, r) * U, 0, 1), p = Y * W + X;
      if (cov > wake[p]) wake[p] = cov;
    });
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.hole = cl(k[2], -1, 1);
  S.trail = cl(k[3], 0, 1);
  S.r = holeRadius(S.hole);
  if (!S.warm) {
    // Open with a sofa 1.6 s short of the right corner and four seconds of
    // memory already laid down behind it.
    S.clock = T1 - 1.6 - 4;
    for (let i = 0; i < 60; i++) step(S, 4 / 60);
    S.warm = true;
  }
  step(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, c1, c2, c3, wake } = S, r = S.r, h = S.hue + 0.52;
  buf.fill(0);
  const put = (p, c, v) => {
    buf[p * 3] = max(buf[p * 3], c[0] * v);
    buf[p * 3 + 1] = max(buf[p * 3 + 1], c[1] * v);
    buf[p * 3 + 2] = max(buf[p * 3 + 2], c[2] * v);
  };
  const set = (p, c, v, al) => {
    buf[p * 3] += (c[0] * v - buf[p * 3]) * al;
    buf[p * 3 + 1] += (c[1] * v - buf[p * 3 + 1]) * al;
    buf[p * 3 + 2] += (c[2] * v - buf[p * 3 + 2]) * al;
  };

  // Walls one LED outside the hallway, the solid between the legs hatched
  // as on a floor plan, and the floor's glow where the sofas have passed.
  hsv(h + 0.2, 0.45, 1, c1);
  for (let Y = 0; Y < H; Y++) put(Y * W, c1, 70), put(Y * W + 63, c1, 70);
  for (let X = 0; X < W; X++) put(X, c1, 70);
  for (let Y = 15; Y < H; Y++) put(Y * W + 15, c1, 70), put(Y * W + 48, c1, 70);
  for (let X = 15; X <= 48; X++) put(15 * W + X, c1, 70);
  for (let Y = 16; Y < H; Y++) for (let X = 16; X < 48; X++) if ((X + Y) % 5 === 0) put(Y * W + X, c1, 40);
  hsv(h + 0.05, 0.6, 1, c2);
  for (let p = 0; p < N; p++) if (wake[p] > 0.01) put(p, c2, 100 * wake[p]);

  const first = floor((S.clock - LIFE) / PERIOD) + 1, last = floor(S.clock / PERIOD);
  for (let n = first; n <= last; n++) {
    const ph = S.clock - n * PERIOD;
    if (ph < 0 || ph > LIFE) continue;
    const P = pose(ph, r, S.pose);
    // In a turn, the rest of the strip behind the sofa that every position
    // of the hallway so far still holds: the walls shave it down to the sofa.
    const u = ph >= T1 && ph < T2 ? (ph - T1) / TB : ph >= T3 && ph < T4 ? (ph - T3) / TB : -1;
    if (u >= 0) {
      const th = (PI / 2) * sm(u), al = sm(u / 0.12), back = min(r + 1 / max(sin(th), 1e-3), 12);
      hsv(h, 0.45, 1, c1);
      eachLed(P, r, (X, Y, sx, sy) => {
        // Each corner's own hallway runs on for ever; the panel's other
        // corner stops the strip.
        if (X < 1 || X > 62 || Y < 1 || (Y > 14 && X > 14 && X < 49)) return;
        const x = P.m ? -sx : sx, ex = cl(0.5 + block(x, sy, th, r) * U, 0, 1) - cl(0.5 - sdf(sx, sy, r) * U, 0, 1);
        if (ex > 0) put(Y * W + X, c1, 80 * ex * al);
      }, P.m ? -r - 1 : -back, P.m ? back : r + 1);
    }
    hsv(h, 0.85, 1, c1);
    hsv(h, 0.3, 1, c2);
    hsv(h + 0.62, 0.55, 1, c3);
    eachLed(P, r, (X, Y, sx, sy) => {
      const dl = sdf(sx, sy, r) * U, cov = cl(0.5 - dl, 0, 1);
      if (cov <= 0) return;
      const p = Y * W + X;
      set(p, c1, 150, cov);
      put(p, notch(sx, sy, r) ? c3 : c2, 255 * cl(1.6 + dl, 0, 1) * cov);
    });
  }
  // The inner corners.
  hsv(h + 0.62, 0.3, 1, c3);
  put(15 * W + 48, c3, 255);
  put(15 * W + 15, c3, 255);

  for (let p = 0; p < N; p++)
    display.setPixel(p % W, (p / W) | 0, round(min(255, buf[p * 3])), round(min(255, buf[p * 3 + 1])), round(min(255, buf[p * 3 + 2])));
}
