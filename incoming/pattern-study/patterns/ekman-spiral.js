// ===== Patternflow pattern =====
// Title:   Ekman Spiral
// Family:  physics
// Idea:    A steady wind pushes the surface current 45 degrees to its right, and each row down turns it further clockwise while it shrinks, so the arrows stack into a twisting column above and the same vectors drawn from one point lie along a logarithmic spiral below.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ekman spiral (Vagn Walfrid Ekman, 1905), pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=14..60, Latitude=-1..1
//
// Knob 1: Hue. Turns the water's colours round the wheel together. At 0 the current is cyan at the surface and blue-violet where it has turned half way round, the wind is pale and the transport gold. At 0.5 the water goes from red to lime, the transport is blue and the wind pale blue.
// Knob 2: Speed. How fast the wind turns on the surface: 0.14 radians a second for each unit, so a full turn takes 22 s at the opening 2, 15 s at 3 and 224 s at 0.2. The surface current, the spiral below it and the transport arrow turn with it and keep their angles to the wind.
// Knob 3: Depth. The Ekman depth D at a latitude whose sine is 0.5, in rows, from 14 to 60. D is where the current points opposite to the surface, marked by the tick on the axis, and there it is e to the minus pi, 4.3 percent, of its surface length. At the opening 14 and latitude 0.06 that is 40 rows below the surface; at 60 it is 173, past the bottom of the column, and the arrows stand almost parallel. The spiral below keeps its shape and D only sets how far along it the column's 54 rows go. The gold transport arrow grows with the D the latitude then gives, 0.3 LED a row from 7 to 30 LEDs. Its direction does not depend on D: 90 degrees right of the wind in the north.
// Knob 4: Latitude. The sine of the latitude, from -1 to 1. Its sign is the hemisphere, shown by the N or S in the corner: below 0 the spiral turns the other way, and the surface current is 45 degrees left of the wind and the transport 90. D goes as one over the square root of the sine, 2.9 times Knob 3 at the opening 0.06 and 1.4 times at 0.25, so towards 0 the spiral unwinds and the arrows stand parallel. Within 0.02 of 0 the 45 degrees eases to nothing and the current runs along the wind; Ekman's solution has no value at the equator, so that stretch is this pattern's own.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, tanh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Two views that share one x axis, as in a drawing. Above, an oblique view of
// the depth column: the current at each row hangs from the depth axis, and
// the axis that points away from you shows slanted, KC of it. Below, the plan:
// the same vectors drawn from one point and seen from straight above.
const X0 = 32; // the depth axis, and the plan's origin
const YS = 12; // row of the surface
const YP = 98; // row of the plan's origin
const R0 = 28; // LEDs the surface current is long
const KC = 0.4; // slant of the column
const NI = 54; // rows of depth drawn
const BIN = 5; // rows between the bold arrows
const ROT = 0.14; // wind turn, radians a second per unit of Speed
const D_REF = 0.5; // the sine of latitude Knob 3 is quoted at
const TRANS = 0.3; // LEDs of transport arrow per row of D, with the surface arrow R0 long

// A dim orange or yellow reads as brown on the panel, so the faint parts, the
// fill and the reference lines, go to crimson where their hue would land in
// orange and to green in yellow. The bright arrows keep their hue.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

// The letters the picture writes, each 5 tall.
const FACE = { D: "###.|#..#|#..#|#..#|###.", N: "#...#|##..#|#.#.#|#..##|#...#", S: ".####|#....|.###.|....#|####." };
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

function glyph(buf, ch, x, y, c, v) {
  const w = GLYPH[ch].length / 5;
  for (let j = 0; j < 5 * w; j++) {
    if (!GLYPH[ch][j]) continue;
    const o = ((y + floor(j / w)) * W + x + (j % w)) * 3;
    buf[o] = c[0] * v;
    buf[o + 1] = c[1] * v;
    buf[o + 2] = c[2] * v;
  }
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, depth: 14, lat: 0.06, psi: 0.2, seen: false, buf: new Float32Array(NP * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 14, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const depth = cl(k[2], 14, 60), lat = cl(k[3], -1, 1);
  // The depth and the latitude ease to the knob, so that turning one runs
  // the spiral through the shapes between, and sit on it at the start.
  const e = S.seen ? min(1, d * 6) : 1;
  S.depth += (depth - S.depth) * e;
  S.lat += (lat - S.lat) * e;
  S.seen = true;
  S.psi += d * ROT * S.speed;
}

// A soft line of width w between two points, composited into the float
// buffer: "max" keeps the faint fills from piling up, "over" lays a line on
// top of whatever is under it.
function line(buf, x0, y0, x1, y1, c, v, w, over) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, r = w * 0.5 + 0.5;
  const xa = max(0, floor(min(x0, x1) - r)), xb = min(W - 1, floor(max(x0, x1) + r));
  const ya = max(0, floor(min(y0, y1) - r)), yb = min(H - 1, floor(max(y0, y1) + r));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const t = L2 > 1e-9 ? cl((px * dx + py * dy) / L2, 0, 1) : 0;
      const ex = px - t * dx, ey = py - t * dy;
      const cov = cl(r - sqrt(ex * ex + ey * ey), 0, 1);
      if (cov <= 0) continue;
      const o = (y * W + x) * 3;
      if (over) {
        buf[o] += (c[0] * v - buf[o]) * cov;
        buf[o + 1] += (c[1] * v - buf[o + 1]) * cov;
        buf[o + 2] += (c[2] * v - buf[o + 2]) * cov;
      } else {
        const a = cov * v;
        if (c[0] * a > buf[o]) buf[o] = c[0] * a;
        if (c[1] * a > buf[o + 1]) buf[o + 1] = c[1] * a;
        if (c[2] * a > buf[o + 2]) buf[o + 2] = c[2] * a;
      }
    }
  }
}

function arrow(buf, x0, y0, x1, y1, c, v, w, head) {
  line(buf, x0, y0, x1, y1, c, v, w, true);
  const dx = x1 - x0, dy = y1 - y0, L = sqrt(dx * dx + dy * dy);
  if (L < 3) return;
  const hd = min(head, L * 0.45), ux = dx / L, uy = dy / L, ca = cos(0.5), sa = sin(0.5);
  line(buf, x1, y1, x1 - hd * (ux * ca - uy * sa), y1 - hd * (uy * ca + ux * sa), c, v, w, true);
  line(buf, x1, y1, x1 - hd * (ux * ca + uy * sa), y1 - hd * (uy * ca - ux * sa), c, v, w, true);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, h = S.hue;
  buf.fill(0);
  // The physics. s is the sine of the latitude, D the depth at which the
  // current has turned through pi, and the current at row i below the
  // surface is R0 e^(-pi i / D) turned clockwise by sg (pi/4 + pi i / D)
  // from the wind. sg is the hemisphere, eased through 0 so that the
  // spiral can be turned inside out.
  const s = S.lat, as = max(abs(s), 1e-4);
  const D = S.depth * sqrt(D_REF / as), g = PI / D;
  const sg = tanh(s / 0.01);
  const ang = (i) => S.psi - sg * (PI / 4 + g * i);
  const amp = (i) => R0 * exp(-g * i);

  const FILL = [0, 0, 0], TIP = [0, 0, 0], REF = [0, 0, 0], WIND = [0, 0, 0], GOLD = [0, 0, 0];
  hsv(dim(h + 0.6), 0.75, 1, REF);
  hsv(h + 0.1, 0.18, 1, WIND);
  hsv(h + 0.12, 0.75, 1, GOLD);
  // Colour is how far down the turn has gone: cyan at the surface, violet at
  // the depth where the current has turned through pi.
  const water = (i, sat, out) => hsv(h + 0.5 + 0.2 * min(1.3, (g * i) / PI), sat, 1, out);

  // Reference: the depth axis, the surface circle seen slanted, and the
  // plan's circles at the surface speed and at e and e^2 times less.
  line(buf, X0, YS, X0, YS + NI, REF, 0.5, 1.4, false);
  for (let a = 0; a < 48; a++) {
    const a0 = (a / 48) * 2 * PI, a1 = ((a + 1) / 48) * 2 * PI;
    line(buf, X0 + R0 * cos(a0), YS - KC * R0 * sin(a0), X0 + R0 * cos(a1), YS - KC * R0 * sin(a1), REF, 0.45, 1.4, false);
    for (let q = 0; q < 3; q++) {
      const r = R0 * exp(-q);
      line(buf, X0 + r * cos(a0), YP - r * sin(a0), X0 + r * cos(a1), YP - r * sin(a1), REF, q ? 0.35 : 0.45, 1.4, false);
    }
  }

  // The column: the arrow of every row, with the curve through the tips.
  // Arrows that point at you are brighter than the ones that point away.
  let px = 0, py = 0, qx = 0, qy = 0;
  for (let i = 0; i <= NI; i++) {
    const a = amp(i), th = ang(i), ca = cos(th), sa = sin(th);
    const fade = i > NI - 10 ? (NI - i) / 10 : 1, near = 0.8 - 0.2 * sa;
    hsv(dim(h + 0.5 + 0.2 * min(1.3, (g * i) / PI)), 1, 1, FILL);
    water(i, 0.8, TIP);
    const tx = X0 + a * ca, ty = YS + i - KC * a * sa, fx = X0 + a * ca, fy = YP - a * sa;
    line(buf, X0, YS + i, tx, ty, FILL, 0.48 * fade * near, 1, false);
    line(buf, X0, YP, fx, fy, FILL, 0.34, 1, false);
    if (i > 0) {
      line(buf, px, py, tx, ty, TIP, 0.95 * fade * near, 2, true);
      line(buf, qx, qy, fx, fy, TIP, 0.95, 2, true);
    }
    px = tx; py = ty; qx = fx; qy = fy;
  }
  // The depth where the current runs opposite to the surface.
  if (D < NI) {
    line(buf, X0 - 4, YS + D, X0 + 4, YS + D, WIND, 0.9, 1, true);
    glyph(buf, "D", X0 + 7, floor(YS + D) - 2, WIND, 0.9);
  }
  // The bold arrows, one a bin, in the column and in the plan.
  for (let i = 0; i <= NI - 10; i += BIN) {
    const a = amp(i), th = ang(i);
    water(i, 0.6, TIP);
    arrow(buf, X0, YS + i, X0 + a * cos(th), YS + i - KC * a * sin(th), TIP, 1, 1.5, 5);
    if (i === 0) arrow(buf, X0, YP, X0 + a * cos(th), YP - a * sin(th), TIP, 1, 1.6, 5);
    else {
      line(buf, X0, YP, X0 + a * cos(th), YP - a * sin(th), TIP, 0.85, 1, false);
      line(buf, X0 + a * cos(th), YP - a * sin(th), X0 + a * cos(th), YP - a * sin(th), TIP, 1, 2.6, true);
    }
  }
  // The wind on the surface, the same wind in the plan, and the transport.
  arrow(buf, X0, YS, X0 + 0.85 * R0 * cos(S.psi), YS - KC * 0.85 * R0 * sin(S.psi), WIND, 1, 1.8, 6);
  arrow(buf, X0, YP, X0 + 0.85 * R0 * cos(S.psi), YP - 0.85 * R0 * sin(S.psi), WIND, 0.85, 1.6, 6);
  const LM = cl(TRANS * D, 7, R0 + 2), tm = S.psi - sg * (PI / 2);
  arrow(buf, X0, YP, X0 + LM * cos(tm), YP - LM * sin(tm), GOLD, 1, 2, 6);
  // The hemisphere, once the latitude is off the equator.
  const hv = cl((abs(s) - 0.01) / 0.04, 0, 1);
  if (hv > 0) glyph(buf, s > 0 ? "N" : "S", 3, 121, REF, 0.9 * hv);

  for (let p = 0; p < NP; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
