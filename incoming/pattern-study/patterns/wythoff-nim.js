// ===== Patternflow pattern =====
// Title:   Wythoff Nim
// Family:  algo
// Idea:    The table of Sprague-Grundy values of Wythoff's game stands on its corner, the losing positions in gold along two golden-ratio rays, and a sweep lights every position of value 0, then 1, then 2 and on, so each value flashes along its own pair of rays and fades back into the table.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wythoff's game (Willem Abraham Wythoff, 1907) and its Sprague-Grundy values (Roland Sprague 1935, Patrick Grundy 1939), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Zoom=1..4, Glow=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the positions of value 0 are gold, the small values round them crimson and the large ones navy going to teal; at 0.25 the zeros are green on red and purple.
// Knob 2: Speed. How fast the sweep climbs through the values; it lingers on the small ones and hurries through the large. At 2 it lights value 1 after 0.4 s, value 10 after 3 s and value 50 after 8 s, and at Zoom 1 it reaches 102, the largest value on the panel, after 11 s and starts again from 0. At 0.2 it all takes ten times as long. The game slows down only by half.
// Knob 3: Zoom. LEDs to a unit of the table, 1 to 4 in whole steps. At 1 the panel holds every position of up to 126 counters, a cell to each pair of LEDs; at 4 it holds the corner up to about 30 counters as diamonds eight LEDs across with a dark line between them, and the zeros can be counted along their rays.
// Knob 4: Glow. How much of the light comes from the sweep. At 0 the whole table shows in its colours and the sweep runs over it as sparks; at 1 the table stands dark but for its zeros, and each position lights in its own colour when the sweep reaches its value and fades over about two seconds.
// Buttons: K1 tap drops a counter, a white diamond, low on the table and plays the game out to the corner: the winner's moves, each onto a position of value 0, light up gold, the loser's blue.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, abs, exp, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Two heaps of x and y counters. A move takes any number from one heap, or
// the same number from both; whoever takes the last counter wins. A
// position's Grundy value is the smallest number not among the values one
// move away: left along its row, up its column, up its diagonal. The
// positions of value 0 are the ones to move to: (floor(n phi),
// floor(n phi^2)) and their mirror images, on two rays of slopes phi and
// 1/phi. Every other value gathers along the same two rays, wobbling off
// them without ever falling into a period (Dress, Flammenkamp and Pink,
// 1999), and down the middle the values grow like x + y.
const T = 82;
const G = new Int16Array(T * T);
let GALL = 0;
{
  const mark = new Int32Array(4 * T);
  for (let y = 0, id = 1; y < T; y++)
    for (let x = 0; x < T; x++, id++) {
      for (let i = 0; i < x; i++) mark[G[y * T + i]] = id;
      for (let j = 0; j < y; j++) mark[G[j * T + x]] = id;
      for (let d = 1; d <= min(x, y); d++) mark[G[(y - d) * T + x - d]] = id;
      let m = 0;
      while (mark[m] === id) m++;
      G[y * T + x] = m;
      GALL = max(GALL, m);
    }
}
// The cells of each value, for the sweep.
const BY = Array.from({ length: GALL + 1 }, () => []);
for (let c = 0; c < T * T; c++) BY[G[c]].push(c);

// The table stands on its corner: position (x, y) is drawn at u = x - y
// across and v = x + y down, s LEDs to a unit, with (0, 0) at the top.
// Taking from one heap moves up and to the side at 45 degrees; taking from
// both moves straight up, and the two rays run down from the corner 13
// degrees either side of the middle. At Zoom 1 a cell is the LED at its
// centre and the one above it.
function place(P, s) {
  P.s = s;
  P.vis = 0;
  const top = 0.5 + s;
  for (let p = 0; p < N; p++) {
    const u = ((p % W) + 0.5 - 32.5) / s, v = (floor(p / W) + 0.5 - top) / s + 1e-3;
    const xf = (u + v) / 2, yf = (v - u) / 2, x = round(xf), y = round(yf);
    if (x < 0 || y < 0 || x >= T || y >= T) {
      P.ci[p] = -1;
      continue;
    }
    const c = y * T + x;
    P.ci[p] = c;
    P.vis = max(P.vis, G[c]);
    // How far into the cell, in LEDs, for the lines between cells.
    P.edge[p] = min(0.5 - abs(xf - x), 0.5 - abs(yf - y)) * 1.414 * s;
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

export function setup(params) {
  const P = (params.s = {
    ts: 0, K: -1, hue: -1, glow: 0.06, s: 0, vis: 0,
    ci: new Int32Array(N), edge: new Float32Array(N),
    L: new Float32Array(T * T), pw: new Float32Array(T * T), pl: new Float32Array(T * T),
    pal: new Float32Array((GALL + 1) * 3), pb: new Float32Array((GALL + 1) * 3), game: null,
  });
  place(P, 1);
}

// The sweep's value climbs slowly through the small values, where the rays
// are, and faster through the large ones: K = 12 (e^(2.5 t / 12) - 1), t in
// seconds at Speed 2.
const C = 12, RATE = 2.5;

function light(P, g) {
  if (g >= 0 && g <= GALL) for (const c of BY[g]) P.L[c] = 1;
}

// A move: to a position of value 0 if there is one (the winner's move),
// otherwise a few counters from a heap or both (the loser's).
function nextMove(x, y) {
  if (G[y * T + x] !== 0) {
    for (let i = 0; i < x; i++) if (G[y * T + i] === 0) return [i, y, 1];
    for (let j = 0; j < y; j++) if (G[j * T + x] === 0) return [x, j, 1];
    for (let q = min(x, y); q > 0; q--) if (G[(y - q) * T + x - q] === 0) return [x - q, y - q, 1];
  }
  for (;;) {
    const kind = floor(random() * 3), a = kind === 0 ? x : kind === 1 ? y : min(x, y);
    if (a < 1) continue;
    const q = 1 + floor(random() * min(a, 9));
    return [kind === 1 ? x : x - q, kind === 0 ? y : y - q, 0];
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const s = round(cl(k[2], 1, 4));
  if (abs(s - P.s) > 1e-3) place(P, s);
  if (k[0] !== P.hue) {
    P.hue = k[0];
    hsv(P.hue + 0.13, 0.8, 1, P.pal, 0);
    hsv(P.hue + 0.13, 0.5, 1, P.pb, 0);
    for (let g = 1; g <= GALL; g++) {
      const h = P.hue + 0.1 - 0.5 * (1 - exp(-g / 14)) - g / 900;
      hsv(h, 0.85, 0.17 + 0.6 * exp(-g / 35), P.pal, g * 3);
      hsv(h, 0.5, 1, P.pb, g * 3);
    }
  }
  P.glow = cl(k[3], 0, 1);
  const sp = cl(k[1], 0.2, 3) / 2, ds = d * sp;

  // The sweep.
  const fade = exp(-ds / (0.45 + 1.6 * P.glow));
  for (let c = 0; c < T * T; c++) P.L[c] *= fade;
  const k0 = P.K;
  P.ts += ds;
  P.K = P.ts < 0 ? -1 : floor(C * (exp((P.ts * RATE) / C) - 1) + 1e-6);
  for (let g = max(k0 + 1, 0); g <= P.K; g++) light(P, g);
  if (P.K > P.vis + 2) (P.ts = -0.8), (P.K = -1);

  // The game.
  const gd = d * (0.5 + 0.5 * sp), gone = exp(-d / (P.game ? 8 : 1.2));
  for (let c = 0; c < T * T; c++) (P.pw[c] *= gone), (P.pl[c] *= gone);
  if (input.btnPressed && input.btnPressed[0]) {
    const vmax = (H - 1.5 - P.s) / P.s, v = round(vmax * (0.6 + 0.35 * random()));
    let u = round((random() - 0.5) * 1.6 * min(v, 31 / P.s));
    if ((u + v) & 1) u += u > 0 ? -1 : 1;
    const x = (u + v) >> 1, y = (v - u) >> 1;
    P.game = { x, y, cx: x, cy: y, m: nextMove(x, y), f: 0, wait: 0.4 };
  }
  const gm = P.game;
  if (gm) {
    if (gm.wait > 0) gm.wait -= gd * 2;
    else {
      const [tx, ty, win] = gm.m, len = max(abs(tx - gm.x), abs(ty - gm.y));
      gm.f = min(1, gm.f + (gd * 30) / (len + 8));
      const sx = Math.sign(tx - gm.x), sy = Math.sign(ty - gm.y), at = round(gm.f * len);
      for (let i = 0; i <= at; i++) (win ? P.pw : P.pl)[(gm.y + sy * i) * T + gm.x + sx * i] = 1;
      gm.cx = gm.x + sx * gm.f * len;
      gm.cy = gm.y + sy * gm.f * len;
      if (gm.f >= 1) {
        gm.x = tx;
        gm.y = ty;
        gm.f = 0;
        gm.wait = 0.5;
        if (win) P.L[ty * T + tx] = 1;
        if (tx === 0 && ty === 0) P.game = null;
        else gm.m = nextMove(tx, ty);
      }
    }
  }
}

const WIN = [255, 226, 130], LOSE = [90, 180, 255];

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const base = 1 - 0.85 * P.glow, grid = P.s > 2 ? 0.6 : 0, gm = P.game, S = P.s;
  // The counter, a diamond of light where the game stands.
  const ux = gm ? 32 + S * (gm.cx - gm.cy) : -99, vy = gm ? S + S * (gm.cx + gm.cy) - (S === 1 ? 0.5 : 0) : -99;
  for (let p = 0; p < N; p++) {
    const c = P.ci[p], X = p % W, Y = floor(p / W);
    if (c < 0) {
      display.setPixel(X, Y, 0, 0, 0);
      continue;
    }
    const q = G[c] * 3, l = P.L[c], a = P.pw[c] * 0.8, b = P.pl[c] * 0.75, f = q ? base : 0.6 + 0.4 * base;
    const e = 1 - grid * cl(1 - P.edge[p] * 1.6, 0, 1);
    // A lit cell flashes white, fades to its own colour at full strength
    // and then down into the table.
    const m = min(1, l * 1.5), wt = l * l * l;
    let r = P.pal[q] * f, g = P.pal[q + 1] * f, bl = P.pal[q + 2] * f;
    r += (P.pb[q] + (255 - P.pb[q]) * wt - r) * m;
    g += (P.pb[q + 1] + (255 - P.pb[q + 1]) * wt - g) * m;
    bl += (P.pb[q + 2] + (255 - P.pb[q + 2]) * wt - bl) * m;
    r += (LOSE[0] - r) * b + (WIN[0] - r) * a;
    g += (LOSE[1] - g) * b + (WIN[1] - g) * a;
    bl += (LOSE[2] - bl) * b + (WIN[2] - bl) * a;
    const k = cl(S + 1.6 - abs(X - ux) - abs(Y - vy), 0, 1.6) / 1.6;
    if (k > 0) (r += (255 - r) * k), (g += (255 - g) * k), (bl += (255 - bl) * k);
    display.setPixel(X, Y, r * e, g * e, bl * e);
  }
}
