// ===== Patternflow pattern =====
// Title:   Peg Light
// Family:  toy
// Idea:    Translucent coloured pegs are pushed one at a time into the holes of a black peg board, following a printed template of a rocket, a sailboat, a flower pot, a fish, a house or a clown, each peg lit by the bulb behind, and when the picture is done it holds, the pegs are pushed out and the next sheet goes on.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after Lite-Brite, the peg board Hasbro brought out in 1967
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Bulb=0..1, Speed=0.2..3, Picture=0..5, Glow=0..1
//
// Knob 1: Bulb. The bulb behind the board, from a full warm white at 0 down a dimmer to a low orange glow at 1, where the blue and violet pegs go dark first.
// Knob 2: Speed. Pegs pushed in per second, 10 at 0.2, 100 at 2 and 150 at 3; the pull-out sweep runs faster with it too.
// Knob 3: Picture. Which template goes on: rocket, sailboat, flower pot, fish, house or clown; turning it pushes the pegs out and starts that sheet, and after it the sheets follow in that order.
// Knob 4: Glow. How far each peg's light spills onto the black board round it, from a clean dot at 0 to a soft lit patch at 1.
// Buttons: K1 tap pushes every peg out and starts the same picture again.

const W = 64;
const H = 128;
const N = W * H;
// The nine peg colours at full strength: red, orange, yellow, green, blue,
// violet, pink, white (milky) and clear (the bare bulb). Index 0 is no peg.
const PEG = [
  null,
  [255, 26, 18],
  [255, 112, 8],
  [255, 214, 16],
  [24, 224, 40],
  [28, 84, 255],
  [150, 36, 255],
  [255, 70, 150],
  [222, 222, 228],
  [255, 250, 236],
];
// A lit peg's brightest channel at the board's centre, and the printed
// template dot behind an empty hole (under 20 of 255: barely there).
const LEVEL = 0.88;
const GHOST = 15 / 255;
// Pegs pushed in per second for each unit of Speed.
const RATE = 50;
const HOLD = 4;
const PULL = 1.8;
const SWAP = 0.8;
const FILL = 0;
const HOLDING = 1;
const PULLING = 2;
const SWAPPING = 3;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function inPoly(x, y, q) {
  let inside = false;
  for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) {
    const xi = q[i];
    const yi = q[i + 1];
    const xj = q[j];
    const yj = q[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(x, y, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const u = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - x0 - u * dx, y - y0 - u * dy);
}

// The six template sheets, painted with discs, boxes, polygons, thick lines
// and rings in the order a child would fill them. Colour 0 rubs out.
const SHEETS = [
  // Rocket: a moon, a ringed planet, stars, the rocket and its smoke.
  (D, R, T, L, put) => {
    const stars = [5, 32, 26, 6, 40, 9, 58, 44, 6, 52, 12, 70, 57, 66, 4, 92, 58, 90, 9, 108, 56, 108, 20, 36, 46, 4, 60, 4, 2, 4, 14, 58, 50, 56, 8, 80, 54, 80];
    for (let i = 0; i < stars.length; i += 2) D(i % 4 ? 9 : 8, stars[i], stars[i + 1], i % 6 ? 1.5 : 0.6);
    D(3, 12, 15, 9);
    D(0, 16, 12, 7.5);
    D(6, 51, 25, 7.5);
    put(2, (x, y) => {
      const e = ((x - 51) / 14) ** 2 + ((y - 25) / 3.4) ** 2;
      return e > 0.55 && e < 1 && (y >= 25 || ((x - 51) / 7.5) ** 2 + ((y - 25) / 7.5) ** 2 > 1);
    });
    T(1, 32, 22, 43, 44, 21, 44);
    R(8, 21, 44, 43, 92);
    D(5, 32, 57, 6);
    D(9, 30, 55, 1.5);
    D(5, 32, 72, 3.5);
    R(1, 21, 80, 43, 83);
    T(1, 21, 70, 21, 94, 9, 103, 9, 86);
    T(1, 43, 70, 43, 94, 55, 103, 55, 86);
    R(6, 30, 86, 34, 100);
    R(2, 25, 93, 39, 97);
    T(2, 23, 98, 41, 98, 32, 124);
    T(3, 27, 98, 37, 98, 32, 116);
    T(9, 30, 98, 34, 98, 32, 108);
    D(8, 16, 121, 9, 6);
    D(8, 48, 122, 10, 6);
    D(9, 4, 126, 7, 4);
    D(9, 60, 126, 7, 4);
  },
  // Sailboat: sun, cloud, gulls, two sails, a red hull and the sea.
  (D, R, T, L, put) => {
    D(3, 50, 14, 8.5);
    for (let a = 0; a < 8; a++) L(3, 50 + 11 * Math.cos(a * 0.785), 14 + 11 * Math.sin(a * 0.785), 50 + 15 * Math.cos(a * 0.785), 14 + 15 * Math.sin(a * 0.785), 0.9);
    D(8, 14, 16, 10, 4.5);
    D(8, 20, 12, 7, 4);
    D(9, 8, 13, 5, 3);
    for (const [gx, gy] of [[9, 34], [20, 42], [52, 38]]) {
      L(8, gx - 4, gy - 2, gx, gy, 0.8);
      L(8, gx, gy, gx + 4, gy - 2, 0.8);
    }
    L(2, 31, 20, 31, 90, 1.1);
    T(1, 32, 17, 32, 25, 42, 21);
    T(8, 34, 26, 34, 86, 60, 86);
    put(1, (x, y) => y >= 64 && y <= 69 && inPoly(x, y, [34, 26, 34, 86, 60, 86]));
    T(7, 28, 32, 28, 86, 4, 86);
    T(1, 2, 89, 62, 89, 54, 103, 10, 103);
    R(8, 6, 93, 58, 94);
    for (let x = 16; x < 50; x += 8) D(3, x, 98, 1.5);
    put(5, (x, y) => y >= 105 && (y + 2.4 * Math.sin(x * 0.42 + y * 0.2)) % 6 < 3.6);
    put(8, (x, y) => y >= 105 && (y + 2.4 * Math.sin(x * 0.42 + y * 0.2)) % 6 >= 3.6 && (y + 2.4 * Math.sin(x * 0.42 + y * 0.2)) % 6 < 4.4);
    put(4, (x, y) => y >= 122);
  },
  // Flower pot: three flowers on stems with leaves, a butterfly, the pot.
  (D, R, T, L, put) => {
    L(4, 32, 88, 32, 40, 1.3);
    L(4, 31, 72, 14, 46, 1.2);
    L(4, 33, 66, 50, 32, 1.2);
    T(4, 32, 80, 18, 70, 12, 58, 26, 66);
    T(4, 32, 76, 46, 68, 54, 56, 40, 62);
    T(4, 32, 60, 22, 54, 18, 44, 28, 50);
    for (const [cx, cy, r, c] of [[32, 34, 11, 1], [14, 42, 9, 6], [50, 28, 9, 7]]) {
      for (let a = 0; a < 6; a++) D(c, cx + r * 0.55 * Math.cos(a * 1.047), cy + r * 0.55 * Math.sin(a * 1.047), r * 0.48);
      D(3, cx, cy, r * 0.36);
    }
    T(5, 10, 8, 18, 15, 10, 20);
    T(5, 26, 8, 18, 15, 26, 20);
    L(8, 18, 10, 18, 20, 0.7);
    R(2, 10, 88, 54, 95);
    T(2, 13, 96, 51, 96, 45, 124, 19, 124);
    put(7, (x, y) => y >= 104 && y <= 108 && inPoly(x, y, [13, 96, 51, 96, 45, 124, 19, 124]));
    for (let x = 22; x <= 42; x += 5) D(3, x, 114, 1.5);
    R(6, 2, 125, 61, 127);
  },
  // Fish: a big striped fish, a small one, bubbles, weed and sand.
  (D, R, T, L, put) => {
    for (const [bx, by, r] of [[18, 10, 3.5], [10, 20, 2.5], [22, 26, 2], [48, 64, 3], [56, 80, 2.5]]) put(9, (x, y) => Math.abs(Math.hypot(x - bx, y - by) - r) < 0.8);
    T(2, 50, 58, 63, 42, 63, 74);
    D(2, 30, 58, 23, 16);
    T(2, 22, 43, 40, 43, 34, 34);
    T(2, 26, 72, 38, 72, 30, 80);
    put(3, (x, y) => ((x - 30) / 23) ** 2 + ((y - 58) / 16) ** 2 <= 1 && (Math.abs(x - 24) < 2.2 || Math.abs(x - 36) < 2.2));
    D(8, 15, 54, 4.5);
    D(5, 14, 54, 2.2);
    L(1, 7, 62, 12, 63, 1);
    D(6, 44, 22, 9, 5.5);
    T(6, 52, 22, 60, 15, 60, 29);
    D(8, 39, 21, 1.5);
    for (const sx of [8, 20, 46, 58]) L(4, sx, 120, sx + 3 * Math.sin(sx), 92 - (sx % 3) * 6, 1.6);
    put(4, (x, y) => y > 86 && y < 120 && [8, 20, 46, 58].some((s) => Math.abs(x - s - 2.5 * Math.sin(y * 0.35 + s)) < 1.6));
    put(3, (x, y) => y >= 118 + 2 * Math.sin(x * 0.3));
    D(7, 30, 121, 3.5);
    D(1, 50, 122, 2.5);
  },
  // House: sun, cloud, red roof, chimney smoke, yellow walls, a garden.
  (D, R, T, L, put) => {
    D(3, 10, 10, 7.5);
    D(8, 42, 10, 9, 4);
    D(9, 50, 7, 6, 3.5);
    R(1, 44, 24, 50, 44);
    D(8, 47, 19, 3);
    D(8, 51, 13, 2.5);
    T(1, 32, 22, 60, 50, 4, 50);
    R(3, 9, 50, 55, 98);
    R(2, 27, 74, 37, 98);
    D(3, 35, 86, 1);
    for (const wx of [13, 41]) {
      R(5, wx, 58, wx + 10, 69);
      L(8, wx + 5, 58, wx + 5, 69, 0.6);
      L(8, wx, 63.5, wx + 10, 63.5, 0.6);
      R(7, wx - 1, 70, wx + 11, 72);
    }
    D(5, 32, 38, 4);
    put(4, (x, y) => y >= 99 && y <= 110);
    T(8, 27, 99, 37, 99, 44, 127, 20, 127);
    for (const [fx, fy, c] of [[6, 104, 1], [14, 108, 6], [50, 105, 7], [58, 109, 3]]) {
      L(4, fx, fy, fx, fy + 12, 0.7);
      D(c, fx, fy, 2.6);
    }
    put(4, (x, y) => y >= 120 && (x < 20 || x > 44));
  },
  // Clown: hat and pompom, orange hair, white face, nose, smile, bow tie.
  (D, R, T, L, put) => {
    T(6, 18, 30, 46, 30, 32, 6);
    D(3, 32, 6, 4.5);
    for (const [hx, hy] of [[28, 22], [36, 26], [32, 14]]) D(8, hx, hy, 1.5);
    for (const s of [-1, 1]) {
      D(2, 32 + s * 21, 46, 8);
      D(2, 32 + s * 24, 58, 7);
      D(2, 32 + s * 20, 68, 6);
    }
    D(8, 32, 54, 18, 23);
    for (const s of [-1, 1]) {
      D(5, 32 + s * 7, 47, 3.5, 4.5);
      L(6, 32 + s * 4, 39, 32 + s * 11, 39, 0.8);
      D(7, 32 + s * 12, 62, 3.5);
    }
    D(1, 32, 57, 5);
    put(1, (x, y) => {
      const d = Math.hypot(x - 32, y - 60);
      return d > 7.5 && d < 10.5 && y > 64;
    });
    T(5, 32, 86, 12, 78, 12, 96);
    T(5, 32, 86, 52, 78, 52, 96);
    D(1, 32, 86, 3.5);
    for (const [bx, by] of [[18, 82], [17, 91], [46, 82], [47, 91]]) D(3, bx, by, 1.5);
    put(3, (x, y) => y >= 98 && ((y >> 2) & 1) === 0 && Math.abs(x - 32) < 14 + (y - 98) * 0.5);
    put(1, (x, y) => y >= 98 && ((y >> 2) & 1) === 1 && Math.abs(x - 32) < 14 + (y - 98) * 0.5);
  },
];

// Paint one sheet: each hole's colour, then the order the pegs go in, one
// colour after another as it first appears, top to bottom with a little
// wander so the work has a ragged front.
function buildSheet(art) {
  const col = new Uint8Array(N);
  const firsts = [];
  const put = (c, f) => {
    if (c && !firsts.includes(c)) firsts.push(c);
    for (let y = 0; y < H; y++) for (let x = y & 1; x < W; x += 2) if (f(x, y)) col[y * W + x] = c;
  };
  const D = (c, cx, cy, rx, ry) => put(c, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / (ry || rx)) ** 2 <= 1);
  const R = (c, x0, y0, x1, y1) => put(c, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const T = (c, ...q) => put(c, (x, y) => inPoly(x, y, q));
  const L = (c, x0, y0, x1, y1, w) => put(c, (x, y) => segDist(x, y, x0, y0, x1, y1) <= w);
  art(D, R, T, L, put);
  const order = [];
  for (const c of firsts) {
    const run = [];
    for (let p = 0; p < N; p++) if (col[p] === c) run.push([p, Math.floor(p / W) + 7 * Math.random() + (p % W) * 0.04]);
    run.sort((a, b) => a[1] - b[1]);
    for (const r of run) order.push(r[0]);
  }
  return { col, order: Int32Array.from(order) };
}

export function setup(params) {
  const P = params;
  P.sheets = SHEETS.map(buildSheet);
  P.buf = new Float32Array(N * 3);
  P.born = new Float32Array(N);
  P.out = new Float32Array(N);
  P.jit = new Float32Array(N);
  P.vig = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = Math.floor(p / W);
    P.jit[p] = Math.random();
    // One bulb behind the middle of the board: the corners get about 70%.
    P.vig[p] = 1 - 0.24 * (((x - 31.5) / 40) ** 2 + ((y - 63.5) / 80) ** 2);
  }
  P.t = 0;
  P.started = false;
}

// Put a sheet on the board with no pegs in it yet.
function begin(P, s) {
  P.sheet = s;
  P.k = 0;
  P.placed = 0;
  P.born.fill(-1);
  P.out.fill(1e9);
  P.phase = SWAPPING;
  P.until = P.t + SWAP;
  P.ghostFrom = P.t;
}

function startPull(P, dur) {
  if (P.phase === PULLING || P.phase === SWAPPING) return;
  P.phase = PULLING;
  const { order } = P.sheets[P.sheet];
  for (let i = 0; i < P.k; i++) {
    const p = order[i];
    P.out[p] = P.t + dur * (0.85 * Math.floor(p / W) / H + 0.15 * P.jit[p]);
  }
  P.until = P.t + dur + 0.4;
}

function step(P, dt, speed) {
  P.t += dt;
  const n = P.sheets[P.sheet].order.length;
  if (P.phase === FILL) {
    P.placed += dt * RATE * speed;
    const { order } = P.sheets[P.sheet];
    while (P.k < n && P.k < P.placed) P.born[order[P.k++]] = P.t;
    if (P.k >= n) {
      P.phase = HOLDING;
      P.until = P.t + HOLD;
    }
  } else if (P.phase === HOLDING) {
    if (P.t >= P.until) startPull(P, PULL * Math.sqrt(2 / speed));
  } else if (P.phase === PULLING) {
    if (P.t >= P.until) {
      begin(P, P.next >= 0 ? P.next : (P.sheet + 1) % SHEETS.length);
      P.next = -1;
    }
  } else if (P.t >= P.until) {
    P.phase = FILL;
    P.placed = P.k;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.bulb = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0.2, 3);
  const pick = Math.round(clamp(k[2], 0, 5));
  P.glow = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    P.pick = pick;
    P.next = -1;
    begin(P, pick);
    // The child has been at it a while when the panel opens: all but the
    // last 1200 pegs are in, and five more seconds go by at the knob's pace,
    // so at Speed 2 the picture is finished seven seconds in.
    const { order } = P.sheets[pick];
    P.phase = FILL;
    P.k = Math.max(0, order.length - 1200);
    P.placed = P.k;
    for (let i = 0; i < P.k; i++) P.born[order[i]] = -20;
    for (let i = 0; i < 150; i++) step(P, 1 / 30, speed);
  }
  if (pick !== P.pick) {
    // A new sheet: a blank one goes straight on, a pegged one is cleared.
    P.pick = pick;
    if (P.phase === SWAPPING) begin(P, pick);
    else {
      P.next = pick;
      startPull(P, 0.7);
    }
  }
  if (input.btnPressed && input.btnPressed[0] && (P.phase === FILL || P.phase === HOLDING)) {
    P.next = P.sheet;
    startPull(P, 1);
  }
  step(P, dt, speed);
}

export function draw(display, params) {
  const P = params;
  const buf = P.buf;
  buf.fill(0);
  const t = P.t;
  const { col, order } = P.sheets[P.sheet];
  // The bulb: a warm white at full, redder and dimmer down the dimmer.
  const b = P.bulb;
  const dim = 1 - 0.5 * b;
  const tint = [dim, dim * (0.93 - 0.4 * b), dim * (0.82 - 0.64 * b)];
  const g1 = 0.22 * P.glow;
  const g2 = 0.1 * P.glow;
  const ghost = P.phase === SWAPPING ? clamp((t - P.ghostFrom) / SWAP, 0, 1) : P.phase === PULLING ? 0 : 1;
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const p = order[i];
    const c = PEG[col[p]];
    const x = p % W;
    const y = (p - x) / W;
    if (i >= P.k) {
      if (ghost > 0) for (let ch = 0; ch < 3; ch++) buf[p * 3 + ch] += c[ch] * GHOST * ghost;
      continue;
    }
    if (t >= P.out[p]) {
      // A pushed-out peg drops off the front of the board, no longer lit
      // from behind.
      const a = t - P.out[p];
      const yy = Math.round(y + 130 * a * a);
      if (a < 0.4 && yy < H) for (let ch = 0; ch < 3; ch++) buf[(yy * W + x) * 3 + ch] += c[ch] * 0.3 * (1 - a / 0.4);
      continue;
    }
    // A peg flares as it seats, then settles; the bulb's heat makes it
    // shimmer by a couple of percent.
    const age = t - P.born[p];
    const env = age < 0.1 ? 0.3 + 9 * age : 1 + 0.22 * Math.exp(-(age - 0.1) / 0.25);
    const v = LEVEL * P.vig[p] * env * (1 + 0.035 * Math.sin(t * 9 + 40 * P.jit[p]));
    for (let ch = 0; ch < 3; ch++) {
      const L = c[ch] * tint[ch] * v;
      buf[p * 3 + ch] += L;
      if (g1 > 0) {
        if (x > 0) buf[(p - 1) * 3 + ch] += L * g1;
        if (x < W - 1) buf[(p + 1) * 3 + ch] += L * g1;
        if (y > 0) buf[(p - W) * 3 + ch] += L * g1;
        if (y < H - 1) buf[(p + W) * 3 + ch] += L * g1;
        if (x > 0 && y > 0) buf[(p - W - 1) * 3 + ch] += L * g2;
        if (x < W - 1 && y > 0) buf[(p - W + 1) * 3 + ch] += L * g2;
        if (x > 0 && y < H - 1) buf[(p + W - 1) * 3 + ch] += L * g2;
        if (x < W - 1 && y < H - 1) buf[(p + W + 1) * 3 + ch] += L * g2;
      }
    }
  }
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    display.setPixel(p % W, Math.floor(p / W), Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
  }
}
