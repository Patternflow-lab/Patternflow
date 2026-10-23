// ===== Patternflow pattern =====
// Title:   Pin Art
// Family:  toy
// Idea:    A pin-art desk toy seen from the front fills the panel with four thousand steel pins in a staggered grid, and a spread hand, a key, a seashell, a toy car and a face press in from behind one after another, each relief rising out of the dim pins into a raking lamp until the toy is tilted and the pins slide flat again in a ripple.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after Ward Fleming's pinscreen desk toy (1985)
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Metal=0..1, Speed=0.2..3, Object=0..4, Light=0..1
//
// Knob 1: Metal. The finish of the pins and the colour the lamp gives them: blue steel at 0, turning through violet and pink to brass in the middle, then through green back to blue steel at 1.
// Knob 2: Speed. How fast things press in, hold and are tilted flat again: at 2 an object takes 3 s to press in and a round is 8 s; at 0.2 it all runs ten times slower.
// Knob 3: Object. What presses in next: a spread hand, a key, a seashell, a toy car or a face, the rest following in that order. Turning it tilts the toy flat and brings the new one.
// Knob 4: Light. Where the desk lamp stands, going once round the toy from its left side, upper left at the start. The relief shines on the lamp's side and throws its shadow away from it, and the flat pins are brighter nearer the lamp.
// Buttons: K1 tap tilts the toy flat now and presses the next object in.

const W = 64;
const H = 128;
const N = W * H;
const NOBJ = 5;
// The round at Speed 2, in seconds: press in, hold, tilt flat, rest.
const TP = 3.0;
const TH = 3.3;
const TW = 1.25;
const TR = 0.5;
const TC = TP + TH + TW + TR;
const { min, max, sqrt, sin, cos, exp, abs, round, hypot, atan2, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// A fixed hash, so the pins are the same uneven pins on every run.
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Distances to shapes, negative inside. seg() leaves how far along the
// segment the nearest point lies in T.
let T = 0;
function seg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  T = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return hypot(px - ax - dx * T, py - ay - dy * T);
}
function box(px, py, cx, cy, hx, hy, r) {
  const qx = abs(px - cx) - hx + r;
  const qy = abs(py - cy) - hy + r;
  return hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r;
}
function ell(px, py, cx, cy, rx, ry) {
  return (hypot((px - cx) / rx, (py - cy) / ry) - 1) * min(rx, ry);
}
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
// A soft round bump, near enough a Gaussian, that ends 2 radii out.
const bump = (px, py, cx, cy, rx, ry) => {
  const q = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
  return q < 4 ? (1 - q / 4) ** 3 : 0;
};
// A rounded edge: 0 at the outline, 1 once r LEDs inside it.
const prof = (d, r) => {
  const t = clamp(-d / r, 0, 1);
  return sqrt(t * (2 - t));
};
// Pins next to the outline are dragged a little way out with it.
const halo = (d) => (d < 5 ? 0.17 * exp(-d / 1.6) : 0);

// Each object is a height above the pins' rest plane, 0..1, at an LED.
// The fingers: base and tip of each, and the radius.
const FING = [
  [15, 84, 3, 56, 6],
  [20, 61, 10, 22, 5.8],
  [30, 58, 29, 9, 6],
  [39, 59, 47, 15, 5.8],
  [47, 65, 59, 35, 5.2],
];
function hand(x, y) {
  let d = box(x, y, 32, 77, 19, 17, 9);
  let crease = 0;
  for (let f = 0; f < 5; f++) {
    const [ax, ay, bx, by, r] = FING[f];
    const e = seg(x, y, ax, ay, bx, by) - r;
    if (e < 0) {
      const len = hypot(bx - ax, by - ay);
      const j = f ? [0.4, 0.68] : [0.55, 0.55];
      crease = max(crease, exp(-(((T - j[0]) * len) ** 2) / 0.8), exp(-(((T - j[1]) * len) ** 2) / 0.8));
    }
    d = smin(d, e, 2.5);
  }
  d = smin(d, seg(x, y, 32, 92, 32, 150) - 15.5, 8);
  if (d > 0) return halo(d);
  let r = 0.5 + 0.38 * prof(d, 8);
  // The pads below the fingers, the ball of the thumb, and the lines of the palm.
  r += 0.08 * bump(x, y, 22, 92, 8, 10) + 0.05 * bump(x, y, 34, 66, 14, 4) + 0.05 * bump(x, y, 43, 86, 6, 9);
  r -= 0.1 * crease;
  const heart = abs(y - (68 + 0.012 * (x - 30) ** 2 - 0.1 * (x - 30)));
  const life = abs(hypot(x - 14, y - 92) - 15);
  if (x > 18 && x < 48 && y < 80) r -= 0.1 * exp(-heart * heart);
  if (y > 70 && y < 104 && x > 18) r -= 0.1 * exp(-life * life);
  return clamp(r, 0, 1);
}

function face(x, y) {
  let d = ell(x, y, 32, 54, 24 - max(0, y - 60) * 0.24, 35);
  d = smin(d, min(ell(x, y, 7, 56, 3.5, 8), ell(x, y, 57, 56, 3.5, 8)), 1.5);
  const head = d;
  d = smin(d, seg(x, y, 32, 88, 32, 140) - 10.5, 4);
  d = smin(d, ell(x, y, 32, 142, 54, 28), 10);
  if (d > 0) return halo(d);
  let r = 0.42 + 0.24 * prof(d, 12);
  // The neck and shoulders sit back under the jaw.
  r -= 0.2 * sstep(-2, 2, head);
  // Hair, combed back in strands from the hairline.
  const hl = 33 + 0.012 * (x - 32) ** 2;
  if (y < hl) r += 0.04 * sstep(hl, hl - 3, y) + 0.06 * sin(x * 1.25 + (y - 20) * (x - 32) * 0.012);
  // Brows, eye sockets and eyes, the nose, cheeks, lips and chin.
  r += 0.06 * bump(x, y, 32, 36, 16, 9);
  r += 0.12 * (bump(x, y, 22, 44, 7, 1.8) + bump(x, y, 42, 44, 7, 1.8));
  r -= 0.3 * (bump(x, y, 22, 51, 6, 3.4) + bump(x, y, 42, 51, 6, 3.4));
  r += 0.16 * (bump(x, y, 22, 51.5, 3, 1.8) + bump(x, y, 42, 51.5, 3, 1.8));
  r += 0.3 * bump(x, y, 32, 59, 2.4, 9) + 0.18 * bump(x, y, 32, 67.5, 4.5, 2.6);
  r -= 0.14 * (bump(x, y, 29, 70, 1.4, 1.1) + bump(x, y, 35, 70, 1.4, 1.1));
  r += 0.12 * (bump(x, y, 19, 64, 6, 6) + bump(x, y, 45, 64, 6, 6));
  r += 0.14 * bump(x, y, 32, 76.5, 6.5, 1.5) + 0.16 * bump(x, y, 32, 80.5, 5.5, 1.9) - 0.2 * bump(x, y, 32, 78.5, 7.5, 0.7);
  r += 0.12 * bump(x, y, 32, 87, 6, 3);
  return clamp(r, 0, 1);
}

function key(x, y) {
  const rr = hypot(x - 32, y - 25);
  let d = max(rr - 21, 9 - rr);
  d = min(d, box(x, y, 32, 47, 9, 3, 1), box(x, y, 32, 55, 7, 2.5, 1), box(x, y, 32, 83, 4.5, 38, 2));
  let bit = box(x, y, 44, 107, 8, 11, 1);
  bit = max(bit, -box(x, y, 51, 101, 2.5, 2, 0), -box(x, y, 51, 111, 2.5, 2.5, 0), -box(x, y, 44, 106, 1.2, 5, 0));
  d = min(d, bit);
  if (d > 0) return halo(d);
  let r = 0.72 + 0.2 * prof(d, 3);
  // A raised rim round the bow's hole and a groove down the shank.
  r += 0.08 * exp(-((rr - 12) ** 2) / 2);
  if (y > 60 && y < 118) r -= 0.12 * exp(-((x - 32) ** 2) / 1.2);
  return clamp(r, 0, 1);
}

// A scallop, hinge down: ribs fan out from the hinge to a wavy edge.
function shell(x, y) {
  const dx = x - 32;
  const dy = 92 - y;
  const rho = hypot(dx, dy);
  const th = atan2(dx, dy);
  const rib = cos(th * 48);
  let d = max(rho - 54 * (1 - 0.3 * th * th) - 1.2 * rib, (abs(th) - 0.85) * rho);
  d = smin(d, box(x, y, 32, 94, 15, 5, 2), 3);
  if (d > 0) return halo(d);
  let r = 0.5 + 0.32 * prof(d, 14);
  r += 0.13 * rib * sstep(5, 22, rho) * (dy > 0) + 0.025 * sin(rho * 1.4);
  r -= 0.12 * exp(-((y - 89) ** 2) / 1.5) * (abs(dx) < 14);
  return clamp(r, 0, 1);
}

// A toy car seen from above, its nose at the top.
function car(x, y) {
  let body = box(x, y, 32, 65, 14 + min(3, max(0, y - 14) * 0.12), 52, 11);
  body = smin(body, min(ell(x, y, 18, 36, 5, 12), ell(x, y, 46, 36, 5, 12), ell(x, y, 17, 96, 5, 12), ell(x, y, 47, 96, 5, 12)), 3);
  const tyre = min(box(x, y, 11, 36, 3, 8, 1.5), box(x, y, 53, 36, 3, 8, 1.5), box(x, y, 10, 96, 3, 8, 1.5), box(x, y, 54, 96, 3, 8, 1.5));
  const d = min(body, tyre);
  if (d > 0) return halo(d);
  if (body > 0) return 0.36 + 0.1 * prof(tyre, 2.5);
  let r = 0.5 + 0.16 * prof(body, 4);
  // The cabin: windscreen and rear window sunk between bonnet, roof and boot.
  const xw = abs(x - 32);
  const scr = xw < 12 - (58 - y) * 0.25 && y > 45 && y < 58;
  const rear = xw < 11 && y > 91 && y < 99;
  const roof = box(x, y, 32, 74.5, 11, 16, 3);
  r += 0.14 * sstep(1, -1, roof) - 0.2 * (scr || rear);
  // Bonnet creases, headlights, wing mirrors, the spoiler at the back.
  r -= 0.14 * (exp(-((x - 23) ** 2) / 0.6) + exp(-((x - 41) ** 2) / 0.6)) * (y > 17 && y < 42);
  r += 0.16 * (bump(x, y, 22, 16, 3.5, 2.2) + bump(x, y, 42, 16, 3.5, 2.2)) + 0.18 * (bump(x, y, 15, 56, 3, 2) + bump(x, y, 49, 56, 3, 2));
  r += 0.18 * sstep(1, -1, box(x, y, 32, 112, 16, 2, 1)) - 0.12 * sstep(1, -1, box(x, y, 32, 108, 14, 1, 0.5));
  return clamp(r, 0, 1);
}

const OBJECTS = [hand, key, shell, car, face];

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.pin = { r: F(N), gx: F(N), gy: F(N), ht: F(N), jit: F(N), started: false };
  const P = params.pin;
  for (let i = 0; i < N; i++) P.jit[i] = 0.88 + 0.24 * hash(i);
}

// The object's heights, and their slopes for the lamp.
function load(P, o) {
  const { r, gx, gy } = P;
  const fn = OBJECTS[o];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r[y * W + x] = fn(x + 0.5, y + 0.5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      gx[i] = (r[y * W + min(W - 1, x + 1)] - r[y * W + max(0, x - 1)]) / 2;
      gy[i] = (r[min(H - 1, y + 1) * W + x] - r[max(0, y - 1) * W + x]) / 2;
    }
}

function tilt(P) {
  if (P.c < TP + TH) {
    P.sw = P.s;
    P.c = TP + TH;
  }
}

export function update(dt, input, params) {
  if (!params.pin) setup(params);
  const P = params.pin;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  P.hue = clamp(k[0], 0, 1);
  P.rate = clamp(k[1], 0.2, 3) / 2;
  const base = clamp(round(k[2]), 0, NOBJ - 1);
  P.lamp = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    P.base = base;
    P.count = -1;
    // Open on the last object of the round, just as the toy is tilted.
    load(P, (base + NOBJ - 1) % NOBJ);
    P.c = TP + TH - 0.05;
    P.s = 1;
    P.sw = 1;
  }
  if (base !== P.base) {
    P.base = base;
    P.count = -1;
    tilt(P);
  }
  if (input.btnPressed && input.btnPressed[0]) tilt(P);
  P.c += dt * P.rate;
  if (P.c >= TC) {
    P.c -= TC;
    P.count++;
    load(P, (P.base + P.count + NOBJ * 8) % NOBJ);
  }
  if (P.c < TP) {
    const u = P.c / TP;
    P.s = u * (1.3 - 0.3 * u);
  } else if (P.c < TP + TH) P.s = 1;
}

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function draw(display, params) {
  const P = params.pin;
  if (!P || !P.started) return;
  const { r, gx, gy, ht, jit } = P;
  const lift = 1 - P.s;
  // The tilt: a front runs down the panel, the pins behind it slide back and
  // rattle a little as they go.
  const wt = P.c - TP - TH;
  const wiping = wt >= 0;
  const yf = -16 + (wt / TW) * 170;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!wiping) {
        const h = r[i] - lift;
        ht[i] = h > 0 ? h : 0;
        continue;
      }
      const dd = yf - y - 5 * sin(x * 0.19 + 1.3) - 3 * sin(x * 0.47);
      let h = r[i] - (1 - P.sw);
      h = h > 0 ? h * (1 - sstep(0, 12, dd)) : 0;
      if (dd > 0) h += 0.16 * max(0, sin(dd * 0.6)) * exp(-dd / 22);
      ht[i] = h;
    }

  // The lamp, low and to one side.
  const ang = PI * (0.87 - 2 * P.lamp);
  const lx = cos(ang);
  const ly = -sin(ang);
  const tint = hsv((0.6 + P.hue) % 1, 0.85, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const h = ht[i];
      // Shadow: does a taller pin stand between this one and the lamp?
      let ex = 0;
      for (let j = 1; j <= 7; j++) {
        const sx = round(x + j * 1.5 * lx);
        const sy = round(y + j * 1.5 * ly);
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) break;
        const e = ht[sy * W + sx] - h - j * 0.12;
        if (e > ex) ex = e;
      }
      const shadow = 1 - 0.34 * sstep(0, 0.12, ex);
      const q = clamp(0.5 + ((x - 31.5) * lx + (y - 63.5) * ly) / 140, 0, 1);
      let v;
      let wh;
      if (((x + y) & 1) === 0) {
        const flat = 106 * (0.72 + 0.56 * q) * jit[i];
        const up = sstep(0, 0.1, h);
        const shade = clamp(1.02 - 4.5 * (gx[i] * lx + gy[i] * ly), 0.5, 1.3);
        const raised = min(255, 255 * (0.66 + 0.4 * min(1, h)) * shade);
        v = (flat + (raised - flat) * up) * shadow;
        wh = 0.3 + 0.4 * clamp((v - 90) / 165, 0, 1);
      } else {
        // A gap: dark, unless the pins round it stand out and show their shafts.
        const n = (ht[i - (x > 0 ? 1 : 0)] + ht[i + (x < W - 1 ? 1 : 0)] + ht[i - (y > 0 ? W : 0)] + ht[i + (y < H - 1 ? W : 0)]) / 4;
        const shade = clamp(0.92 - 3 * (gx[i] * lx + gy[i] * ly), 0.35, 1.15);
        v = 175 * sstep(0.02, 0.3, n) * shade * shadow;
        wh = 0.15;
      }
      display.setPixel(x, y, v * (tint[0] + (1 - tint[0]) * wh), v * (tint[1] + (1 - tint[1]) * wh), v * (tint[2] + (1 - tint[2]) * wh));
    }
}
