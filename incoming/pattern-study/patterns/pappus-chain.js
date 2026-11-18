// ===== Patternflow pattern =====
// Title:   Pappus Chain
// Family:  geometry
// Idea:    The base AB of an arbelos stands up the left edge 128 LEDs long, so the big half-disc is 64 LEDs in radius, the whole panel width, and a chain of circles that each touch it and the half-disc AC flows toward A with every centre as many of its own diameters from the base as its index, laid out as a tape, while the point C slides along AB and the centres stay on an ellipse.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pappus chain in the arbelos (Pappus of Alexandria, c. 320 CE, Collection Book IV; the arbelos itself from the Book of Lemmas that is credited to Archimedes); pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, C=-1..1, Swing=0..0.3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the big half-disc is pale blue, the circles go from azure at the wide end to magenta at the small end, the half-disc AC is gold and the half-disc CB mint.
// Knob 2: Speed. How fast the chain flows toward A and how fast C slides. At 2 each circle moves on by one index in 4.2 s and C goes once round its slide in 30 s; 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: C. Where the middle of C's slide is, as the share AC / AB: 0.22 at -1, 0.5 at 0 and 0.78 at 1. At 0.22 the circle round the half-disc CB is 50 LEDs in radius, the chain is five circles that are an LED across or more, and the first is 13 LEDs in radius. At 0.78 the first is 14 and the chain is a necklace of twenty circles, the last half an LED in radius.
// Knob 4: Swing. How far C slides to either side of that middle, in lengths of AB, 0 to 0.3. At 0 C stands still and the chain only flows. At 0.06, where it opens, AC / AB goes between 0.44 and 0.56 and the circle round CB between 36 and 28 LEDs in radius. At 0.3 with K3 at 0, AC / AB sweeps from 0.2 to 0.8, the half-discs AC and CB trade places and the whole chain is made over.

const W = 64, H = 128;
const LEN = 128; // AB, in LEDs: the base is the left edge and the big half-disc has radius LEN / 2 = 64
const KMAX = 70; // circles of the chain looked at: the rest are under a tenth of an LED
const FLOW = 0.12; // indices a second per unit of Speed
const SLIDE = 0.1047; // radians a second per unit of Speed: one slide in 30 s at 2
const { floor, min, max, abs, sqrt, sin, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const hh = fr(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.45 + 0.55 * v;
    s *= 0.65;
  }
  hsv(hh, s, v, out);
}

// The circle of the Pappus chain at real index n, for C at r = AC / AB.
// With AB = 1 on the x axis it has radius r(1-r) / (2D), and its centre is at
// x = r(1+r) / (2D), y = n r(1-r) / D, where D = n^2 (1-r)^2 + r. Its height
// y is n diameters. n = 0 is the circle round the half-disc CB, and every n,
// whole or not, touches the big half-disc and the half-disc AC, and the circle
// at n + 1. On the panel A is the top of the left edge, x runs down it and y
// runs across it, all times LEN.
function circle(r, n, o) {
  const q = 1 - r, D = n * n * q * q + r, k = LEN / D;
  o.x = k * r * q * n; // across the panel
  o.y = (k * r * (1 + r)) / 2; // down the panel
  o.R = (k * r * q) / 2;
  o.n = n;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, rc: 0.5, amp: 0.06, ph: 0, fl: 0, t: 0, r: 0.5, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.rc = 0.5 + 0.28 * cl(k[2], -1, 1);
  S.amp = cl(k[3], 0, 0.3);
  S.t += d;
  S.ph += d * S.speed * SLIDE;
  S.fl += d * S.speed * FLOW;
  // C slides about the middle the knob sets. The phase starts at 1.05, so at
  // the first seconds it is near the far end of its swing, and comes in.
  S.r = cl(S.rc + S.amp * sin(S.ph + 1.05), 0.1, 0.92);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, r = S.r, s = fr(S.fl), h0 = S.hue + 0.55;
  buf.fill(0);
  const add = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] += c[0] * a;
    buf[o + 1] += c[1] * a;
    buf[o + 2] += c[2] * a;
  };
  // A dot at a real position, shared over the four LEDs round it.
  const dot = (x, y, c, a) => {
    const bx = floor(x - 0.5), by = floor(y - 0.5), fx = x - 0.5 - bx, fy = y - 0.5 - by;
    add(bx, by, c, a * (1 - fx) * (1 - fy));
    add(bx + 1, by, c, a * fx * (1 - fy));
    add(bx, by + 1, c, a * (1 - fx) * fy);
    add(bx + 1, by + 1, c, a * fx * fy);
  };
  // A ring of radius R round (cx, cy) a LED across, with a dim fill inside.
  const ring = (cx, cy, R, c, aRing, aFill) => {
    const x0 = max(0, floor(cx - R - 2)), x1 = min(W - 1, floor(cx + R + 2));
    const y0 = max(0, floor(cy - R - 2)), y1 = min(H - 1, floor(cy + R + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, e = sqrt(dx * dx + dy * dy) - R;
        const line = cl(1 - abs(e) / 0.9, 0, 1) * aRing;
        const fill = aFill > 0 ? cl(0.5 - e, 0, 1) * aFill : 0;
        const a = max(line, fill);
        if (a > 0.004) add(x, y, c, a);
      }
  };
  const col = [0, 0, 0], PALE = [0, 0, 0], GOLD = [0, 0, 0], MINT = [0, 0, 0], WHITE = [1, 1, 1];
  const hp = fr(h0);
  hsv(hp, hp > 0.02 && hp < 0.2 ? 0.1 : 0.3, 1, PALE);
  tint(h0 + 0.58, 0.9, 1, GOLD);
  tint(h0 - 0.2, 0.75, 1, MINT);
  const hueOf = (n) => h0 + 0.4 * (1 - exp(-max(0, n) / 5));

  // The base AB down the left edge, and C where the two small half-discs meet.
  for (let y = 0; y < H; y++) add(0, y, PALE, 0.16);
  const cyC = LEN * r;
  for (let j = -2; j <= 2; j++) dot(1, cyC + j, WHITE, 0.55 * (1 - abs(j) / 3));
  dot(1, 1, PALE, 0.9);
  dot(1, H - 1, PALE, 0.9);

  // The ellipse the centres run on: (X - 1/2)^2 + y^2 / r = 1/4 with X = 2x / (1 + r),
  // from A to the centre of the circle n = 0, drawn dotted.
  for (let i = 0; i <= 160; i += 2) {
    const phi = Math.PI * (1 - i / 160), X = 0.5 + 0.5 * Math.cos(phi), yy = (0.5 * Math.sqrt(r)) * sin(phi);
    dot(LEN * yy, (LEN * (1 + r) * X) / 2, PALE, 0.34);
  }

  // The rulers. A circle at n is n of its own diameters from the base: a line
  // from the base to its centre, and a tick at every whole diameter on it.
  const c = { x: 0, y: 0, R: 0, n: 0 }, prev = { x: 0, y: 0, R: 0, n: 0 };
  for (let k = 0; k <= KMAX; k++) {
    const n = k + s;
    if (n < 0.4) continue;
    circle(r, n, c);
    const dia = 2 * c.R;
    if (dia < 3.2) break;
    tint(hueOf(n), 0.8, 1, col);
    const fade = sm((n - 0.4) / 0.5) * sm((dia - 3.2) / 3);
    const row = floor(c.y);
    for (let y = row - 1; y <= row + 1; y++) {
      const wy = cl(1.15 - abs(y + 0.5 - c.y), 0, 1);
      for (let x = 0; x < c.x; x++) add(x, y, col, (floor((x + 0.5) / dia) % 2 === 0 ? 0.62 : 0.24) * fade * wy * cl(c.x - x, 0, 1));
    }
    for (let j = 1; j <= n; j++) {
      const tx = j * dia, a = fade * sm((n - j) / 0.3);
      for (let y = -2; y <= 2; y++) dot(tx, c.y + y, WHITE, 0.6 * a * (1 - abs(y) / 3));
    }
  }

  // The three half-discs, the big one AB, then AC and CB.
  ring(0, LEN / 2, LEN / 2, PALE, 0.7, 0);
  ring(0, (LEN * r) / 2, (LEN * r) / 2, GOLD, 0.85, 0);
  ring(0, (LEN * (1 + r)) / 2, (LEN * (1 - r)) / 2, MINT, 0.85, 0);

  // The chain, the circle at index 0 being the one round the half-disc CB.
  let have = false;
  for (let k = -1; k <= KMAX; k++) {
    const n = k + s;
    circle(r, n, c);
    if (c.R < 0.04) continue;
    // A circle smaller than an LED fades to a point.
    const lead = sm(c.R / 1.3);
    tint(hueOf(n), 0.8, 1, col);
    const hh = fr(hueOf(n));
    ring(c.x, c.y, c.R, col, 0.95 * lead, (hh > 0.02 && hh < 0.2 ? 0.07 : 0.17) * lead);
    if (n > -0.5 && c.R >= 1.2) {
      const f = sm((c.R - 1.2) / 2);
      // Where it touches the big half-disc, the half-disc AC and the circle before it.
      let ux = c.x, uy = c.y - LEN / 2, ul = sqrt(ux * ux + uy * uy);
      dot((ux / ul) * (LEN / 2), LEN / 2 + (uy / ul) * (LEN / 2), WHITE, 0.8 * f);
      const vr = (LEN * r) / 2, vy = c.y - vr, vl = sqrt(c.x * c.x + vy * vy);
      dot((c.x / vl) * vr, vr + (vy / vl) * vr, WHITE, 0.8 * f);
      if (have && prev.R >= 1.2) {
        const px = prev.x - c.x, py = prev.y - c.y, pl = sqrt(px * px + py * py);
        dot(c.x + (px / pl) * c.R, c.y + (py / pl) * c.R, WHITE, 0.8 * f);
      }
    }
    prev.x = c.x;
    prev.y = c.y;
    prev.R = c.R;
    have = true;
  }

  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, min(255, buf[o] * 255), min(255, buf[o + 1] * 255), min(255, buf[o + 2] * 255));
  }
}
