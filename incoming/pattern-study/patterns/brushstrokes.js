// ===== Patternflow pattern =====
// Title:   Brushstrokes
// Family:  noise
// Idea:    A night sky is painted and painted again in short thick strokes laid along a swirling flow field, ultramarine and cobalt curling round yellow-white stars and a crescent moon, over a flame-shaped cypress and a village with lit windows.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: after Vincent van Gogh's The Starry Night (1889), painted with strokes traced along the level lines of a stream function
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Palette=0..1, Flow=0.2..3, Length=4..12, Swirl=0..1
//
// Knob 1: Palette. Turns every colour of the painting round the colour wheel together, starting from Van Gogh's blue and yellow.
// Knob 2: Flow. How fast the paint moves: at 2 the whole canvas is painted over every three seconds and the big swirl's arms turn on by a band of colour every second and a half; at 0.2 everything goes ten times slower.
// Knob 3: Length. How long a stroke is, from short dabs four LEDs long to sweeps of twelve; the cypress takes longer strokes and the village shorter ones.
// Knob 4: Swirl. How hard the sky turns: low, the stars sit in their haloes and the sky rolls past in long waves; turned up, the big spiral grows and the waves break into eddies.

const W = 64;
const H = 128;
const N = W * H;
// Regions. A stroke keeps to the region it starts in, so the cypress and the
// houses keep their outlines however many strokes cross the sky beside them.
const SKY = 0;
const TREE = 1;
const HILL = 2;
const WALL = 3;
const ROOF = 4;
const SPIRE = 5;
const LIT = 6;
const SHADE = 7;

// The two swirls in the middle of the sky as x, y, radius, turn; the big one's
// arms rotate. Then the moon and nine stars as x, y, radius.
const SWIRLS = [
  [35, 50, 10, 1],
  [16, 39, 7, -1],
];
const MOON = [50, 14, 5.5];
const STARS = [
  [9, 10, 4.2],
  [27, 8, 3.6],
  [40, 26, 4.8],
  [6, 27, 3.6],
  [59, 39, 4.2],
  [24, 70, 3.6],
  [50, 68, 4.8],
  [41, 85, 3],
  [59, 86, 3.6],
];

// Colours, 0..255. The sky's bands cycle through six blues and one streak of
// pale yellow-green; the stars and the moon go out from their cores through
// yellow to a green-white ring and a pale blue one.
const SKY_BANDS = [
  [12, 28, 150],
  [20, 62, 215],
  [44, 110, 235],
  [100, 150, 240],
  [190, 206, 96],
  [24, 80, 220],
  [16, 90, 180],
];
const STAR_RINGS = [
  [0.45, 255, 250, 200],
  [0.9, 255, 228, 60],
  [1.3, 245, 196, 30],
  [1.65, 205, 220, 90],
  [2.0, 90, 150, 230],
];
const MOON_RINGS = [
  [1.35, 238, 182, 36],
  [1.75, 200, 206, 100],
  [2.2, 100, 150, 222],
];
const MOON_COLS = [
  [255, 248, 170],
  [214, 112, 22],
];
const TREE_COLS = [
  [22, 54, 34],
  [42, 74, 30],
  [70, 58, 26],
  [20, 38, 58],
  [34, 90, 52],
  [14, 30, 26],
];
const HILL_COLS = [
  [24, 40, 130],
  [20, 64, 120],
  [44, 50, 150],
  [22, 76, 96],
];
const WALL_COLS = [
  [54, 80, 140],
  [80, 92, 150],
  [40, 90, 130],
];
const ROOF_COLS = [
  [28, 34, 74],
  [116, 78, 44],
  [40, 52, 96],
];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The cypress: a flame that rises from the foot of the panel to row 42, its
// sides licking in and out.
function cypressHalf(y) {
  if (y < 42) return -1;
  const u = (y - 42) / 86;
  return 10 * Math.pow(u, 0.72) * (1 + 0.22 * Math.sin(y * 0.55 + 1) + 0.1 * Math.sin(y * 1.3));
}
function cypressMid(y) {
  return 13 + 2.4 * Math.sin(y * 0.09 + 0.4);
}
function hillTop(x) {
  return 96 + 4 * Math.sin(x * 0.085 + 0.6) + 1.8 * Math.sin(x * 0.27 + 2);
}

// The village, the same on every load: a back row of houses up the slope and
// a front row along the foot of the panel, each house a wall under a pitched
// roof with a window or two, and the church's spire standing up between them.
function house(P, x, top, w, bottom, b, win) {
  const reg = P.reg;
  const mat = P.mat;
  const wc = Math.floor(hash(b, 4) * WALL_COLS.length);
  const rc = Math.floor(hash(b, 5) * ROOF_COLS.length);
  for (let y = top; y < bottom; y++) {
    const r = y - top;
    for (let c = x; c < x + w && c < W; c++) {
      const p = y * W + c;
      if (reg[p] === TREE) continue;
      if (r < 2) {
        if (r === 0 && (c === x || c === x + w - 1)) continue;
        reg[p] = ROOF;
        mat[p] = rc;
      } else {
        reg[p] = WALL;
        mat[p] = wc;
      }
      win[p] = 0;
    }
  }
  const n = 1 + Math.floor(hash(b, 6) * 2.4);
  for (let i = 0; i < n; i++) {
    const c = x + 1 + Math.floor(hash(b, 10 + i) * (w - 2));
    const y = top + 3 + Math.floor(hash(b, 20 + i) * Math.max(1, bottom - top - 5));
    if (c < W && y < H && reg[y * W + c] === WALL) win[y * W + c] = 1;
  }
}

function buildVillage(P) {
  const reg = P.reg;
  const mat = P.mat;
  const win = new Uint8Array(N);
  // The church's spire and tower first, so the houses stand in front of it.
  for (let y = 84; y < 112; y++) {
    const half = y < 97 ? 0 : 1;
    for (let c = 45 - half; c <= 45 + half; c++) {
      reg[y * W + c] = SPIRE;
      mat[y * W + c] = 0;
    }
  }
  win[104 * W + 45] = 1;
  let b = 0;
  for (let row = 0; row < 2; row++) {
    let x = row ? 20 : 24;
    while (x < W - 2) {
      const w = 4 + Math.floor(hash(b, 1) * 4);
      const top = (row ? 113 : 103) + Math.floor(hash(b, 2) * 5);
      const bottom = row ? H : top + 7 + Math.floor(hash(b, 3) * 3);
      if (!(row === 0 && x <= 45 && x + w > 44)) house(P, x, top, w, bottom, b, win);
      x += w + (hash(b, 7) < 0.45 ? 1 + Math.floor(hash(b, 8) * 3) : 0);
      b++;
    }
  }
  const wins = [];
  for (let p = 0; p < N; p++) if (win[p] && (reg[p] === WALL || reg[p] === SPIRE)) wins.push(p);
  P.wins = Int32Array.from(wins);
}

export function setup(params) {
  const P = params;
  P.canvas = new Float32Array(N * 3);
  P.reg = new Uint8Array(N);
  P.mat = new Uint8Array(N);
  P.col = new Float32Array(3);
  P.m = new Float32Array(9);
  for (let y = 0; y < H; y++) {
    const half = cypressHalf(y);
    const mid = cypressMid(y);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const mx = x + 0.5 - MOON[0];
      const my = y + 0.5 - MOON[1];
      const cx = mx - 2.6;
      const cy = my + 1.8;
      if (half > 0 && Math.abs(x + 0.5 - mid) < half) P.reg[p] = TREE;
      else if (y >= hillTop(x)) P.reg[p] = HILL;
      else if (mx * mx + my * my < MOON[2] * MOON[2]) P.reg[p] = cx * cx + cy * cy > 20 ? LIT : SHADE;
      else P.reg[p] = SKY;
      P.mat[p] = Math.floor(hash(x >> 2, y >> 1) * 4);
    }
  }
  buildVillage(P);
  P.t = 0;
  P.hue = 0;
  P.flow = 2;
  P.len = 4;
  P.swirl = 0.06;
  P.debt = 0;
  P.started = false;
}

// The stream function: rolling bands across the sky, and a bump round each
// swirl, star and the moon. Strokes run along its level lines, and the sky's
// colour is picked by its value, so a stroke stays inside its band of colour.
function psi(P, x, y) {
  const t = P.t;
  const g = 0.8 + 2.4 * P.swirl;
  let v = y + 5 * Math.sin(x * 0.11 + y * 0.05 + t * 0.07) + 2.5 * Math.sin(x * 0.05 - y * 0.09 - t * 0.05);
  for (let i = 0; i < SWIRLS.length; i++) {
    const s = SWIRLS[i];
    const R = s[2] * (0.9 + 0.5 * P.swirl);
    const dx = x - s[0];
    const dy = y - s[1];
    v += s[3] * 3.2 * R * g * Math.exp(-(dx * dx + dy * dy) / (2 * R * R));
  }
  const mr = MOON[2] * 1.7;
  const mx = x - MOON[0];
  const my = y - MOON[1];
  v += 2.6 * mr * Math.exp(-(mx * mx + my * my) / (2 * mr * mr));
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const R = s[2] * 1.2;
    const dx = x - s[0];
    const dy = y - s[1];
    const d2 = dx * dx + dy * dy;
    if (d2 > 50 * R * R) continue;
    v += (i & 1 ? -2.6 : 2.6) * R * Math.exp(-d2 / (2 * R * R));
  }
  return v;
}

// Which way a stroke goes at (x, y), as a unit vector in out[0], out[1].
function dirAt(P, reg, x, y, out) {
  let dx;
  let dy;
  if (reg === SKY || reg >= LIT) {
    const e = 0.5;
    dx = psi(P, x, y + e) - psi(P, x, y - e);
    dy = psi(P, x - e, y) - psi(P, x + e, y);
    // Swirl also stirs a wobble into the flow, so the long waves break up.
    const a = P.swirl * 1.3 * Math.sin(x * 0.31 + y * 0.17 + P.t * 0.4) * Math.sin(y * 0.23 - x * 0.07);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rx = dx * c - dy * s;
    dy = dx * s + dy * c;
    dx = rx;
  } else if (reg === TREE) {
    // The cypress licks upward like a flame.
    dx = 0.45 * Math.sin(y * 0.21 + x * 0.35 + P.t * 0.3);
    dy = -1;
  } else if (reg === HILL) {
    dx = 1;
    dy = 0.35 * Math.cos(x * 0.085 + 0.6) + 0.4 * Math.sin(y * 0.4 + x * 0.2);
  } else if (reg === SPIRE) {
    dx = 0;
    dy = 1;
  } else {
    dx = 1;
    dy = 0.15 * Math.sin(x + y);
  }
  const l = Math.hypot(dx, dy) || 1;
  out[0] = dx / l;
  out[1] = dy / l;
}

function ringCol(rings, d, out) {
  for (let i = 0; i < rings.length; i++) {
    if (d < rings[i][0]) {
      out[0] = rings[i][1];
      out[1] = rings[i][2];
      out[2] = rings[i][3];
      return true;
    }
  }
  return false;
}

// The colour the painter loads for a stroke that starts at (x, y).
function colourAt(P, reg, p, x, y, out) {
  if (reg === TREE) return pick(TREE_COLS, P.mat[p] + Math.floor(Math.random() * 3), out);
  if (reg === HILL) return pick(HILL_COLS, P.mat[p] + Math.floor(Math.random() * 2), out);
  if (reg === WALL) return pick(WALL_COLS, P.mat[p], out);
  if (reg === ROOF) return pick(ROOF_COLS, P.mat[p], out);
  if (reg === SPIRE) return pick(ROOF_COLS, 0, out);
  // The moon: a crescent lit on its lower left, its shadowed part glowing orange.
  if (reg === LIT) return pick(MOON_COLS, 0, out);
  if (reg === SHADE) return pick(MOON_COLS, 1, out);
  const mx = x - MOON[0];
  const my = y - MOON[1];
  const md = Math.sqrt(mx * mx + my * my) / MOON[2];
  if (ringCol(MOON_RINGS, md, out)) return;
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const dx = x - s[0];
    const dy = y - s[1];
    // Each star's halo breathes on its own clock.
    const r = s[2] * (1 + 0.12 * Math.sin(P.t * (0.5 + 0.13 * i) + i * 2.1));
    if (ringCol(STAR_RINGS, Math.sqrt(dx * dx + dy * dy) / r, out)) return;
  }
  // The sky: bands picked by the stream function, and round the big swirl
  // two spiral arms that turn as the clock runs.
  const s = SWIRLS[0];
  const dx = x - s[0];
  const dy = y - s[1];
  const near = Math.exp(-(dx * dx + dy * dy) / 300);
  const k = psi(P, x, y) * 0.14 + near * (Math.atan2(dy, dx) / Math.PI + P.t * 0.12) + P.t * 0.02;
  const band = SKY_BANDS[((Math.floor(k * 3) % 7) + 7) % 7];
  out[0] = band[0];
  out[1] = band[1];
  out[2] = band[2];
}

function pick(list, i, out) {
  const c = list[i % list.length];
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
}

const DIR = new Float32Array(2);
const SAT = 1.15;

// One stroke: load the brush, then walk half its length each way along the
// flow from where it starts, one or two LEDs wide, until it runs off its region.
function stroke(P, x0, y0) {
  const p0 = Math.floor(y0) * W + Math.floor(x0);
  const reg = P.reg[p0];
  const col = P.col;
  colourAt(P, reg, p0, x0, y0, col);
  // Each stroke mixes its own shade: a little lighter or darker, a little warmer or cooler.
  const v = 0.82 + 0.34 * Math.random();
  const warm = (Math.random() - 0.5) * 34;
  const r = col[0] * v + warm;
  const g = col[1] * v + (Math.random() - 0.5) * 22;
  const b = col[2] * v - warm * 0.6;
  let len = P.len * (0.7 + 0.6 * Math.random());
  if (reg === TREE) len *= 1.4;
  else if (reg >= WALL) len *= 0.45;
  const wide = reg !== SPIRE && Math.random() < 0.55;
  const c = P.canvas;
  for (let side = -1; side <= 1; side += 2) {
    let x = x0;
    let y = y0;
    const steps = Math.ceil(len * 0.5 / 0.6);
    for (let s = 0; s < steps; s++) {
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || px >= W || py < 0 || py >= H) break;
      const p = py * W + px;
      if (P.reg[p] !== reg) break;
      dirAt(P, reg, x, y, DIR);
      // Bristle grain: about one LED in eight picks up a lighter or darker fleck.
      const q = Math.random() < 0.13 ? 1 + (Math.random() - 0.5) * 0.16 : 1;
      c[p * 3] = r * q;
      c[p * 3 + 1] = g * q;
      c[p * 3 + 2] = b * q;
      if (wide) {
        const nx = Math.floor(x - DIR[1] * 0.9);
        const ny = Math.floor(y + DIR[0] * 0.9);
        const n = ny * W + nx;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && P.reg[n] === reg) {
          const q2 = Math.random() < 0.13 ? 0.9 + (Math.random() - 0.5) * 0.16 : 0.9;
          c[n * 3] = r * q2;
          c[n * 3 + 1] = g * q2;
          c[n * 3 + 2] = b * q2;
        }
      }
      x += DIR[0] * 0.6 * side;
      y += DIR[1] * 0.6 * side;
    }
  }
}

function paint(P, count) {
  for (let i = 0; i < count; i++) stroke(P, Math.random() * W, Math.random() * H);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  P.flow = Math.max(0.2, Math.min(3, k[1]));
  P.len = Math.max(4, Math.min(12, k[2]));
  P.swirl = Math.max(0, Math.min(1, k[3]));
  if (!P.started) {
    // The canvas is already painted when the panel opens: a ground of flat
    // colour, then enough strokes to cover it three times over while the
    // clock runs four seconds, so the knobs have set the picture.
    P.started = true;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        colourAt(P, P.reg[p], p, x + 0.5, y + 0.5, P.col);
        P.canvas[p * 3] = P.col[0] * 0.9;
        P.canvas[p * 3 + 1] = P.col[1] * 0.9;
        P.canvas[p * 3 + 2] = P.col[2] * 0.9;
      }
    }
    const per = Math.round((3 * N) / (1.55 * P.len) / 40);
    for (let i = 0; i < 40; i++) {
      P.t += 0.1 * P.flow;
      paint(P, per);
    }
  }
  P.t += dt * P.flow;
  // A stroke covers about one and a half times its length in LEDs, so at
  // Flow 2 the canvas is painted over every three seconds whatever the
  // Length: 440 strokes a second at Length 4, 147 at Length 12.
  P.debt += (dt * P.flow * 880) / P.len;
  const n = Math.floor(P.debt);
  P.debt -= n;
  paint(P, n);
}

export function draw(display, params, time) {
  const P = params;
  const c = P.canvas;
  const m = P.m;
  // Palette: a hue rotation that keeps each colour's lightness, with the
  // colours pushed a little further from grey, the way oil paint sits fresh.
  const a = P.hue * Math.PI * 2;
  const cs = Math.cos(a) * SAT;
  const sn = Math.sin(a) * SAT;
  m[0] = 0.213 + cs * 0.787 - sn * 0.213;
  m[1] = 0.715 - cs * 0.715 - sn * 0.715;
  m[2] = 0.072 - cs * 0.072 + sn * 0.928;
  m[3] = 0.213 - cs * 0.213 + sn * 0.143;
  m[4] = 0.715 + cs * 0.285 + sn * 0.14;
  m[5] = 0.072 - cs * 0.072 - sn * 0.283;
  m[6] = 0.213 - cs * 0.213 - sn * 0.787;
  m[7] = 0.715 - cs * 0.715 + sn * 0.715;
  m[8] = 0.072 + cs * 0.928 + sn * 0.072;
  for (let p = 0; p < N; p++) {
    const r = c[p * 3];
    const g = c[p * 3 + 1];
    const b = c[p * 3 + 2];
    const R = m[0] * r + m[1] * g + m[2] * b;
    const G = m[3] * r + m[4] * g + m[5] * b;
    const B = m[6] * r + m[7] * g + m[8] * b;
    display.setPixel(p % W, (p / W) | 0, R < 0 ? 0 : R > 255 ? 255 : R, G < 0 ? 0 : G > 255 ? 255 : G, B < 0 ? 0 : B > 255 ? 255 : B);
  }
  // The village's windows, dabbed on last; one now and then goes dim and comes back.
  const wins = P.wins;
  for (let i = 0; i < wins.length; i++) {
    const p = wins[i];
    const f = Math.sin(time * 0.7 + i * 2.3) > 0.93 ? 0.55 : 1;
    const r = 255 * f;
    const g = 214 * f;
    const b = 72 * f;
    const R = m[0] * r + m[1] * g + m[2] * b;
    const G = m[3] * r + m[4] * g + m[5] * b;
    const B = m[6] * r + m[7] * g + m[8] * b;
    display.setPixel(p % W, (p / W) | 0, Math.max(0, Math.min(255, R)), Math.max(0, Math.min(255, G)), Math.max(0, Math.min(255, B)));
  }
}
