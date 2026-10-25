// ===== Patternflow pattern =====
// Title:   Peaucellier Linkage
// Family:  line
// Idea:    A Peaucellier inversor of seven thick bars swings on two fixed pivots, its crank rocking one corner of the rhombus along a circle through the main pivot so that the opposite corner runs up and down an exact straight line nearly the height of the panel, drawn as a glowing rail, and moving the crank's pivot off its place sends that corner along a circle arc beside the rail instead.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Peaucellier–Lipkin linkage (Charles-Nicolas Peaucellier, 1864; Yom Tov Lipman Lipkin, 1871), pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Arms=0..1, Offset=0..1
//
// Knob 1: Hue. Turns the bars round the wheel together. At 0 the long arms are azure, the rhombus gold, the crank rose and the rail mint; at 0.5 the arms are orange, the rhombus blue, the crank green and the rail pink.
// Knob 2: Speed. How fast the crank rocks: at 2 the output joint runs the rail top to bottom and back in 6 seconds, at 0.2 in a minute, at 3 in 4 seconds.
// Knob 3: Arms. The ratio of the long arms to the rhombus side, with their sum kept at 78 LEDs. At 0 the arms are 52 and the side 26, the rail stands 51 LEDs from the main pivot and the output runs 53 LEDs either side of centre; at 1 the arms are 45 and the side 33, the rhombus opens out, the rail moves in to 34 LEDs and the crank swings 116 degrees each way for a stroke of 55. The crank is always 0.44 of the inversion radius, so the output joint never crosses the joint the crank drives.
// Knob 4: Offset. Moves the crank's pivot away from the main pivot. Up to 0.08 it sits exactly the crank's length away and the output runs on the straight rail, within 1e-13 LEDs of it; at 1 it is a tenth of the inversion radius farther (4.5 LEDs at Arms 0), the crank's circle misses the main pivot, and the output's white track runs on a circle arc of radius about 200, 5 LEDs inside the rail at the middle of the stroke.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, abs, sin, cos, atan, hypot, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

// The main pivot O, on the left edge halfway down. The crank's pivot Q lies
// to its right, and the output rail stands farther right, upright, so the
// stroke runs along the panel's long side.
const OX = 6.5, OY = 64;
// Arms plus side, in LEDs, and the half stroke the crank aims for.
const REACH = 78, STROKE = 55;
// Bar half widths: arms and crank 4 LEDs wide, the rhombus 3.
const HW_ARM = 2, HW_RH = 1.5, HW_CR = 2;
// Base hues of the arms, rhombus, crank and rail.
const HUES = [0.56, 0.12, 0.93, 0.42];
const TRAIL = 150;

// The linkage for the knobs: long arm L, side s, inversion constant k =
// L^2 - s^2 (|OP| |OP'| = k), crank length r, the rail's distance from O
// d = k / 2r, and the crank pivot's offset.
function geometry(G, arms, off) {
  const rho = 2 - 0.65 * arms;
  G.s = REACH / (1 + rho);
  G.L = REACH - G.s;
  G.k = G.L * G.L - G.s * G.s;
  G.r = 0.44 * sqrt(G.k);
  G.d = G.k / (2 * G.r);
  G.off = (0.1 * sqrt(G.k) * max(0, off - 0.08)) / 0.92;
  G.qx = OX + G.r + G.off;
}

// Solve the linkage for crank angle th: P on the crank's circle, A and B
// where the circle of radius L round O meets the circle of radius s round
// P, and P' the fourth corner of the rhombus, A + B - P. Nothing here uses
// the inversion; the straight line is what the bars give.
function solve(G, th, J) {
  const px = G.qx + G.r * cos(th), py = OY + G.r * sin(th);
  const dx = px - OX, dy = py - OY, D = hypot(dx, dy), ex = dx / D, ey = dy / D;
  const a = (G.L * G.L - G.s * G.s + D * D) / (2 * D), hh = sqrt(max(0, G.L * G.L - a * a));
  const mx = OX + a * ex, my = OY + a * ey;
  J.px = px;
  J.py = py;
  J.ax = mx - hh * ey;
  J.ay = my + hh * ex;
  J.bx = mx + hh * ey;
  J.by = my - hh * ex;
  J.qx = 2 * mx - px;
  J.qy = 2 * my - py;
  J.D = D;
  J.ok = G.L * G.L - a * a >= 0;
}

// How far the crank may swing: the largest angle up to the one that gives
// the full stroke at which the rhombus is not flat, the arms are not
// straight and P' stays on the panel. Both sides are mirror images.
function swing(G, J) {
  const goal = 2 * atan(STROKE / G.d);
  let ok = 0;
  for (let th = 0; th <= goal + 1e-9; th += 0.004) {
    solve(G, th, J);
    const Dp = hypot(J.qx - OX, J.qy - OY);
    if (!J.ok || J.D < G.L - G.s + 1.5 || Dp > G.L + G.s - 3 || J.qy < 6 || J.qy > H - 6) break;
    ok = th;
  }
  return ok;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, arms: 0, offset: 0.06, ph: 0,
    G: {}, J: {}, theta: 0, amp: 0, gKey: '',
    rgb: new Float32Array(N * 3), tr: new Float32Array(N), col: new Float32Array(15),
    tx: new Float32Array(TRAIL), ty: new Float32Array(TRAIL), tn: 0, ti: 0,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.arms = cl(k[2], 0, 1);
  S.offset = cl(k[3], 0, 1);
  // Inside the dead band the linkage is the same, so the track is kept.
  const key = S.arms.toFixed(4) + ',' + max(0, S.offset - 0.08).toFixed(4);
  if (key !== S.gKey) {
    geometry(S.G, S.arms, S.offset);
    S.amp = swing(S.G, S.J);
    // A changed linkage starts a fresh track.
    if (S.gKey) S.tn = 0;
    S.gKey = key;
  }
  // One full rock (out, back, out the other way, back) is 6 s at Speed 2.
  S.ph += (d * S.speed * 2 * PI) / 12;
  // The crank angle is chosen so that, with the pivot in place, P' runs the
  // rail in simple harmonic motion: y = T sin(phase) along the rail.
  const T = S.G.d * Math.tan(S.amp / 2);
  S.theta = 2 * atan((T * sin(S.ph)) / S.G.d);
  S.stroke = T;
  solve(S.G, S.theta, S.J);
  S.tx[S.ti] = S.J.qx;
  S.ty[S.ti] = S.J.qy;
  S.ti = (S.ti + 1) % TRAIL;
  S.tn = min(TRAIL, S.tn + 1);
}

// Paint colour c at cover a over what is there.
function paint(rgb, p, a, r, g, b) {
  const q = p * 3;
  rgb[q] += (r - rgb[q]) * a;
  rgb[q + 1] += (g - rgb[q + 1]) * a;
  rgb[q + 2] += (b - rgb[q + 2]) * a;
}

// A bar from (ax, ay) to (bx, by) with round ends: a black rim one LED wide
// first, so crossing bars stay apart, then the bar in its flat colour.
function bar(rgb, ax, ay, bx, by, hw, col, o) {
  const R = hw + 1.2, vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy || 1;
  const x0 = max(0, floor(min(ax, bx) - R)), x1 = min(W - 1, ceil(max(ax, bx) + R));
  const y0 = max(0, floor(min(ay, by) - R)), y1 = min(H - 1, ceil(max(ay, by) + R));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5 - ax, cy = y + 0.5 - ay, t = cl((cx * vx + cy * vy) / ll, 0, 1);
      const dd = hypot(cx - t * vx, cy - t * vy), p = y * W + x;
      const rim = cl(R + 0.5 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(rgb, p, rim, 0, 0, 0);
      const c = cl(hw + 0.5 - dd, 0, 1);
      if (c > 0) paint(rgb, p, c, col[o], col[o + 1], col[o + 2]);
    }
}

// A moving joint: a disc a shade paler than its bar, with a dark pin.
function joint(rgb, cx, cy, rad, col, o) {
  for (let y = max(0, floor(cy - rad - 2)); y <= min(H - 1, ceil(cy + rad + 2)); y++)
    for (let x = max(0, floor(cx - rad - 2)); x <= min(W - 1, ceil(cx + rad + 2)); x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy), p = y * W + x;
      const rim = cl(rad + 1.5 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(rgb, p, rim, 0, 0, 0);
      const c = cl(rad + 0.5 - dd, 0, 1);
      if (c > 0) paint(rgb, p, c, 0.55 + 0.45 * col[o], 0.55 + 0.45 * col[o + 1], 0.55 + 0.45 * col[o + 2]);
      const pin = cl(1.2 - dd, 0, 1);
      if (pin > 0) paint(rgb, p, pin, 0.08, 0.08, 0.1);
    }
}

// A fixed pivot: a pale ring round a dark centre, on a short ground bar.
function anchor(rgb, cx, cy) {
  for (let y = max(0, floor(cy - 6)); y <= min(H - 1, ceil(cy + 6)); y++)
    for (let x = max(0, floor(cx - 6)); x <= min(W - 1, ceil(cx + 6)); x++) {
      const dd = hypot(x + 0.5 - cx, y + 0.5 - cy), p = y * W + x;
      const rim = cl(4.6 - dd, 0, 1);
      if (rim <= 0) continue;
      paint(rgb, p, rim, 0, 0, 0);
      const ring = cl(3.6 - dd, 0, 1) * cl(dd - 1.1, 0, 1);
      if (ring > 0) paint(rgb, p, ring, 0.86, 0.88, 0.92);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.gKey) return;
  const { rgb, col, G, J, tr } = S;
  for (let i = 0; i < 4; i++) hsv(S.hue + HUES[i], i === 3 ? 0.55 : 0.78, 1, col, i * 3);
  rgb.fill(0);
  tr.fill(0);

  // The crank's circle, dotted and faint: it runs through O only when the
  // crank's pivot is in place.
  const nd = max(24, round((2 * PI * G.r) / 2.6));
  for (let i = 0; i < nd; i++) {
    const a = (2 * PI * i) / nd, x = floor(G.qx + G.r * cos(a)), y = floor(OY + G.r * sin(a));
    if (x >= 0 && x < W && y >= 0 && y < H) paint(rgb, y * W + x, 0.6, col[6], col[7], col[8]);
  }

  // The rail: the straight line P' runs on with the pivot in place, at d
  // from O and as long as the stroke, glowing.
  const lx = OX + G.d, top = OY - S.stroke - 2, bot = OY + S.stroke + 2;
  for (let y = max(0, floor(top)); y <= min(H - 1, ceil(bot)); y++) {
    const end = cl(y + 1 - top, 0, 1) * cl(bot - y, 0, 1);
    for (let x = max(0, floor(lx - 4)); x <= min(W - 1, ceil(lx + 4)); x++) {
      const dx = abs(x + 0.5 - lx), v = (cl(1.25 - dx, 0, 1) * 0.85 + 0.22 * Math.exp(-dx * dx / 3)) * end;
      if (v > 0) paint(rgb, y * W + x, min(1, v), col[9], col[10], col[11]);
    }
  }

  // P's own track over the last five seconds, a white line one LED wide,
  // newest brightest. With the pivot in place it lies on the rail's centre.
  for (let n = 0; n + 1 < S.tn; n++) {
    const i = (S.ti - 1 - n + TRAIL) % TRAIL, j = (i - 1 + TRAIL) % TRAIL, a = 1 - (0.75 * n) / TRAIL;
    const x0 = S.tx[i], y0 = S.ty[i], x1 = S.tx[j], y1 = S.ty[j], steps = max(1, ceil(hypot(x1 - x0, y1 - y0) * 2));
    for (let m = 0; m < steps; m++) {
      const f = m / steps, tx = x0 + (x1 - x0) * f, ty = y0 + (y1 - y0) * f, x = floor(tx), y = floor(ty);
      if (x >= 0 && x < W && y >= 0 && y < H) tr[y * W + x] = max(tr[y * W + x], a * cl(1.3 - abs(x + 0.5 - tx), 0, 1));
    }
  }
  for (let p = 0; p < N; p++) if (tr[p] > 0) paint(rgb, p, tr[p], 1, 1, 1);

  // Bars, back to front: arms, crank, rhombus.
  bar(rgb, OX, OY, J.ax, J.ay, HW_ARM, col, 0);
  bar(rgb, OX, OY, J.bx, J.by, HW_ARM, col, 0);
  bar(rgb, G.qx, OY, J.px, J.py, HW_CR, col, 6);
  bar(rgb, J.ax, J.ay, J.px, J.py, HW_RH, col, 3);
  bar(rgb, J.px, J.py, J.bx, J.by, HW_RH, col, 3);
  bar(rgb, J.bx, J.by, J.qx, J.qy, HW_RH, col, 3);
  bar(rgb, J.qx, J.qy, J.ax, J.ay, HW_RH, col, 3);
  joint(rgb, J.ax, J.ay, 2.4, col, 0);
  joint(rgb, J.bx, J.by, 2.4, col, 0);
  joint(rgb, J.px, J.py, 2.4, col, 6);
  joint(rgb, J.qx, J.qy, 2.6, col, 9);
  anchor(rgb, OX, OY);
  anchor(rgb, G.qx, OY);

  for (let p = 0, q = 0; p < N; p++, q += 3) display.setPixel(p % W, (p / W) | 0, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
