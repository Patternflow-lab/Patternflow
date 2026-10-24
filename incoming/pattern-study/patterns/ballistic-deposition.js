// ===== Patternflow pattern =====
// Title:   Ballistic Deposition
// Family:  particle
// Idea:    Particles fall straight down on to 64 columns and stick at the first thing they touch, the top of their own column or the side of a taller neighbour, so a porous deposit grows up the panel in coloured bands whose boundaries are the old fronts, rough and getting rougher, while the camera climbs with the front.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ballistic deposition (Marjorie J. Vold, 1959), whose surface is in the Kardar-Parisi-Zhang class (1986), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slip=0..1, Layers=6..24
//
// Knob 1: Hue. Turns both band colours round the wheel together. At 0 the bands alternate cyan and violet, and over every ten bands the pair wanders to azure and pink and back; at 0.5 they are red and green.
// Knob 2: Speed. Particles a second: 4 at 0.2, so each one can be followed down, 64 at 2, one layer a second with the front climbing 2 rows a second, and 300 at 3, a hail that pushes the deposit off the bottom 10 rows a second.
// Knob 3: Slip. The chance that a particle slides past a taller neighbour's side and lands on its own column. At 0 every one sticks: the deposit fills 47% of its cells and the front's width settles near 4.5 rows after about 30 layers. At 1 it is random deposition: no holes, no sideways reach, needles of every length, and a width that grows as the square root of time without end, 10 rows after 100 layers and 30 after 1000.
// Knob 4: Layers. How many layers of 64 particles each colour band holds: 6 at the start, a band about 13 rows thick in the porous deposit, up to 24, about 50 rows.
// Buttons: K1 tap lays a flat white lid across the panel one row above the highest particle. The particles in the air land on it, and the front starts flat again and roughens above it, band by band.

// On 64 columns that wrap round, the front's width grows from a flat start
// as t^(1/3), the KPZ exponent, and stops near 4.5 rows once its bumps are
// as wide as the panel; the bands keep each stage of it as it scrolls by.
const W = 64, H = 128, R = 512, RM = R - 1;
const { min, max, floor, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const MAXF = 1024, MAXL = 256;
const FALL = 70; // rows a second
const FRONT = 0.8; // the camera holds the mean front this far up the panel
const LID = 0x7fffffff;

export function setup(params) {
  params.s = {
    fresh: true,
    h: new Int32Array(W), // rows taken in each column, counting the particles still falling to it
    vh: new Int32Array(W), // the same for the particles that have landed
    cell: new Int32Array(W * R), // particle number, 0 for a hole
    row: new Int32Array(R).fill(-1), // the world row each ring row holds
    n: 0, base: 0, acc: 0, t: 0,
    fx: new Int16Array(MAXF), fy: new Float32Array(MAXF), fto: new Int32Array(MAXF), fn: new Int32Array(MAXF), nf: 0,
    lx: new Int16Array(MAXL), ly: new Int32Array(MAXL), lt: new Float32Array(MAXL).fill(-9), li: 0,
    hue: 0, layers: 6,
    pal: new Float32Array(256 * 3), palKey: new Int32Array(256).fill(-1),
  };
}

// Vold's rule. A particle falling down column x stops on its own column's top
// or, if it sticks sideways, beside the top particle of a taller neighbour:
// h_x <- max(h_{x-1}, h_x + 1, h_{x+1}). The columns wrap round.
function deposit(P, x, stick) {
  const h = P.h;
  let y = h[x];
  if (stick) y = max(y, h[(x + 63) & 63] - 1, h[(x + 1) & 63] - 1);
  h[x] = y + 1;
  return y;
}

// The deposit lives in a ring of 512 rows; a row is wiped when a particle
// first reaches it, and rows far below the camera are written over.
function place(P, x, y, n) {
  const rr = y & RM;
  if (P.row[rr] !== y) {
    if (P.row[rr] > y) return;
    P.row[rr] = y;
    P.cell.fill(0, rr * W, rr * W + W);
  }
  P.cell[rr * W + x] = n;
  if (y >= P.vh[x]) P.vh[x] = y + 1;
}

const meanH = (h) => {
  let s = 0;
  for (let x = 0; x < W; x++) s += h[x];
  return s / W;
};

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 6], d = cl(dt || 0, 0, 0.1);
  const speed = cl(k[1], 0.2, 3), slip = cl(k[2], 0, 1);
  P.hue = k[0];
  P.layers = cl(k[3], 6, 24);
  P.t += d;
  // The opening deposit is laid on a flat floor before the first frame,
  // until its mean front stands at the camera's mark.
  if (P.fresh) {
    P.fresh = false;
    while (meanH(P.h) < FRONT * H)
      for (let i = 0; i < W; i++) {
        const x = floor(random() * W);
        place(P, x, deposit(P, x, random() >= slip), ++P.n);
      }
  }
  // K1: a flat lid one row above the highest particle. The front starts
  // flat again and roughens on top of it.
  if (input.btnPressed && input.btnPressed[0]) {
    let y = 0;
    for (let x = 0; x < W; x++) y = max(y, P.h[x]);
    for (let x = 0; x < W; x++) place(P, x, y, LID), (P.h[x] = y + 1);
    for (let i = 0; i < P.nf; i++) P.fto[i] = deposit(P, P.fx[i], random() >= slip);
  }
  // Each particle's landing is settled the moment it leaves the top, against
  // the deposit as all earlier particles left it, so the order is Vold's
  // one at a time; the fall to that place is only shown.
  P.acc += 4 * Math.pow(75, (speed - 0.2) / 2.8) * d;
  while (P.acc >= 1) {
    P.acc -= 1;
    if (P.nf >= MAXF) continue;
    const i = P.nf++, x = floor(random() * W);
    P.fx[i] = x;
    P.fto[i] = deposit(P, x, random() >= slip);
    P.fn[i] = ++P.n;
    P.fy[i] = max(P.base + H + random() * FALL * d, P.fto[i] + 1);
  }
  for (let i = 0; i < P.nf; i++) {
    P.fy[i] -= FALL * d;
    if (P.fy[i] > P.fto[i]) continue;
    place(P, P.fx[i], P.fto[i], P.fn[i]);
    const j = P.li++ & (MAXL - 1);
    (P.lx[j] = P.fx[i]), (P.ly[j] = P.fto[i]), (P.lt[j] = P.t);
    P.nf--;
    (P.fx[i] = P.fx[P.nf]), (P.fy[i] = P.fy[P.nf]), (P.fto[i] = P.fto[P.nf]), (P.fn[i] = P.fn[P.nf]);
    i--;
  }
  const goal = meanH(P.vh) - FRONT * H;
  if (goal > P.base) P.base += (goal - P.base) * min(1, d * 4);
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const B = round(P.base), per = W * P.layers, pal = P.pal, key = P.palKey;
  // A band is Layers times 64 particles, counted in landing order. Bands
  // alternate between two colours 0.3 of the wheel apart, and the pair
  // wanders 0.125 up the wheel and back over ten bands.
  const colour = (n) => {
    const b = floor((n - 1) / per), q = b & 255;
    if (key[q] !== b) {
      key[q] = b;
      const odd = b & 1, u = b % 10, tri = u < 5 ? u : 10 - u;
      hsv(P.hue + 0.48 + 0.025 * tri + (odd ? 0.3 : 0), odd ? 0.8 : 0.9, odd ? 0.85 : 1, pal, q * 3);
    }
    return q * 3;
  };
  for (let sy = 0; sy < H; sy++) {
    // Older deposit dims with depth, to 55% at the bottom edge.
    const wy = B + H - 1 - sy, rr = wy & RM, ok = wy >= 0 && P.row[rr] === wy, fade = 1 - 0.45 * cl((sy - 30) / 98, 0, 1);
    for (let x = 0; x < W; x++) {
      const n = ok ? P.cell[rr * W + x] : 0;
      if (!n) display.setPixel(x, sy, 0, 0, 0);
      else if (n === LID) display.setPixel(x, sy, 200, 200, 200);
      else {
        const q = colour(n);
        // The top particle of each column, the front itself, burns pale.
        if (wy === P.vh[x] - 1) display.setPixel(x, sy, pal[q] * 0.35 + 166, pal[q + 1] * 0.35 + 166, pal[q + 2] * 0.35 + 166);
        else display.setPixel(x, sy, pal[q] * fade, pal[q + 1] * fade, pal[q + 2] * fade);
      }
    }
  }
  // Fresh landings flash white and settle into their band's colour.
  for (let j = 0; j < MAXL; j++) {
    const age = P.t - P.lt[j];
    if (age > 0.4) continue;
    const y = P.ly[j], sy = B + H - 1 - y, rr = y & RM, n = P.row[rr] === y ? P.cell[rr * W + P.lx[j]] : 0;
    if (sy < 0 || sy >= H || !n || n === LID) continue;
    const q = colour(n), a = age / 0.4, w = 255 * (1 - a);
    display.setPixel(P.lx[j], sy, w + pal[q] * a, w + pal[q + 1] * a, w + pal[q + 2] * a);
  }
  // Particles in flight: a white head and a short grey tail.
  for (let i = 0; i < P.nf; i++) {
    const sy = B + H - 1 - floor(P.fy[i]);
    for (let t = 0; t < 3; t++) {
      const y = sy - t, v = t ? 150 - 45 * t : 255;
      if (y >= 0 && y < H) display.setPixel(P.fx[i], y, v, v, v);
    }
  }
}
