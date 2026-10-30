// ===== Patternflow pattern =====
// Title:   Floating Letters
// Family:  type
// Idea:    The letters of a word, cut from one board lighter than water, drop one by one into a pool across the middle of the panel, splash, bob and turn until each rests where its centre of buoyancy stands straight under its centre of gravity, the O level, the T on its side, the E on its back beside an A that stays upright, while a curve over each letter draws its potential energy against its angle with a dot that rolls into a valley; then the board soaks up water, the letters ride lower, some roll to new angles, and they sink before the next word drops.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Archimedes, On Floating Bodies (c. 250 BC); the metacentre (Pierre Bouguer, Traité du navire, 1746), pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Density=0.2..0.8, Swell=0..1
//
// Knob 1: Hue. Turns the letters and the water round the wheel together. At 0 the letters run from amber to lime over blue water; at 0.25 from green to sea green over violet; at 0.5 from blue to violet over amber.
// Knob 2: Speed. Simulated seconds to the second, 0.7 for each unit: 1.4 at the opening 2, where a word takes 14 s from the first drop to the last letter sinking. Ten times slower at 0.2, half as fast again at 3.
// Knob 3: Density. The board's density against water, 0.2 to 0.8, which is also the share of each letter under the waterline, and which moves the valleys of every energy curve. At 0.2 the O floats level, the T lies on its side about 20 degrees off flat, the E on its back, the L tips about 15 or about 70 degrees and the A floats upright. At 0.5 the O turns to 45 degrees like a square log, the T lies flat and the L stands on its corner. At 0.8 every curve is the one at 0.2 turned through 180 degrees and a fifth of each letter shows above the water.
// Knob 4: Swell. A swell running left to right on a 48 LED wavelength, 12 LEDs from crest to trough at 1 and 0.7 at the opening 0.06; past 0.57 its crests break white. A big swell rocks the letters and can knock one out of a shallow valley into another.
// Buttons: K1 tap soaks the board at once, and the next word follows.

// Each letter is a 15 by 15 bitmap cut from a board of density rho, water
// being 1, and floats as a rigid body in the plane of the panel. Its weight,
// rho g for each cell, acts at its centre of gravity G. Each cell under the
// surface is pushed up by g times the part of it that is under; together
// that is the weight of the water displaced, acting at the centroid of the
// wet cells, the centre of buoyancy B. While B is off the vertical through
// G the two forces turn the letter. It rests where B stands straight under
// G and a small turn carries B past G's vertical to the side that turns it
// back, Bouguer's metacentre above G. Those rests are the valleys of the
// potential energy, the weight times the height of G less the work the
// water does holding the letter up, and a letter keeps the valley it lands
// in. Water drag on each wet cell, in proportion to its speed, damps the
// bobbing. G is the white dot on each letter and B the pale one below it.
//
// The valleys depend on where the ink is, not how much. The E has 147
// cells and the A 138; both drop upright, the E rolls onto its back and the
// A stays upright in a valley shallower than the one upside down that it
// never reaches. They depend on rho only through rho and 1 - rho, so the
// curve at 0.8 is the one at 0.2 turned through 180 degrees. The square
// glyph matters: one row taller and the O lies on its side at every
// density, as a long log does.
//
// The tank is the panel's 64 columns, so the water rises by what the
// letters displace, 1.1 LEDs for TEA at 0.2. Letters keep an LED apart, each
// cell beside another letter's pushing both along the line between their
// centres. After 8 simulated seconds the board soaks: rho climbs at 0.12 a
// second, the letters ride lower and some roll after their valleys (a T
// from about 70 degrees to about 110, an L onto its corner), then fast past
// 0.95, and they sink.

const W = 64, H = 128, N = W * H, G = 15;
const { floor, round, min, max, sqrt, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The still waterline, gravity in LEDs per simulated second squared, water
// drag per wet cell, the push between letters and from the panel's sides.
const WL = 62, GRAV = 40, DRAG = 2.4, PUSH = 30, WALL = 60, SUB = 6;
// Swell: 48 LED wavelength, deep water, so omega = sqrt(g k).
const KW = (2 * PI) / 48, OMW = sqrt(GRAV * KW);
// Simulated seconds: release of the first letter, gap between letters, when
// the board starts to soak, how fast rho rises, and when to give up waiting.
const T0 = 0.5, GAP = 0.55, SOAK = 8, SOAKR = 0.12, TMAX = 26;
const HANG = 34, HUE0 = 0.13;
// The energy curves: 48 angles, drawn in rows CY0 to CY1.
const NA = 48, CY0 = 11, CY1 = 25;

const WORDS = ["TEA", "LOT", "BUOY", "FLY", "OIL", "SINK", "KEY"];

// 15 by 15, stroke 3, drawn for this pattern.
const GL = {
  T: `
###############
###############
###############
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......`,
  E: `
###############
###############
###############
###............
###............
###............
#############..
#############..
#############..
###............
###............
###............
###############
###############
###############`,
  A: `
..###########..
.#############.
###############
###.........###
###.........###
###.........###
###.........###
###############
###############
###############
###.........###
###.........###
###.........###
###.........###
###.........###`,
  L: `
###............
###............
###............
###............
###............
###............
###............
###............
###............
###............
###............
###............
###############
###############
###############`,
  O: `
..###########..
.#############.
###############
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###############
.#############.
..###########..`,
  B: `
#############..
##############.
##############.
###........###.
###........###.
###........###.
###############
###############
###############
###.........###
###.........###
###.........###
###############
##############.
#############..`,
  U: `
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###.........###
###############
.#############.
..###########..`,
  Y: `
###.........###
####.......####
#####.....#####
.#####...#####.
..#####.#####..
...#########...
....#######....
.....#####.....
......###......
......###......
......###......
......###......
......###......
......###......
......###......`,
  S: `
..###########..
.#############.
###############
###............
###............
###............
###############
###############
###############
............###
............###
............###
###############
.#############.
..###########..`,
  I: `
..###########..
..###########..
..###########..
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
......###......
..###########..
..###########..
..###########..`,
  N: `
###.........###
####........###
#####.......###
######......###
#######.....###
########....###
###.#####...###
###..#####..###
###...#####.###
###....########
###.....#######
###......######
###.......#####
###........####
###.........###`,
  K: `
###.........###
###.......#####
###......######
###....######..
###..#######...
###.######.....
########.......
#######........
#########......
###..#####.....
###...######...
###.....#####..
###......######
###........####
###.........###`,
  F: `
###############
###############
###############
###............
###............
###............
############...
############...
############...
###............
###............
###............
###............
###............
###............`,
};

// Each glyph once: its cells about the centre of gravity, the moment of
// inertia per unit density, and a bitmap with a clear border to sample.
const GLYPH = {};
for (const ch in GL) {
  const rows = GL[ch].trim().split("\n");
  const xs = [], ys = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (rows[j][i] === "#") xs.push(i + 0.5), ys.push(j + 0.5);
  const n = xs.length;
  let cx = 0, cy = 0;
  for (let k = 0; k < n; k++) (cx += xs[k]), (cy += ys[k]);
  cx /= n;
  cy /= n;
  const dx = new Float32Array(n), dy = new Float32Array(n), bm = new Uint8Array((G + 2) * (G + 2));
  let I = n / 6, R = 0;
  for (let k = 0; k < n; k++) {
    dx[k] = xs[k] - cx;
    dy[k] = ys[k] - cy;
    I += dx[k] * dx[k] + dy[k] * dy[k];
    R = max(R, sqrt(dx[k] * dx[k] + dy[k] * dy[k]) + 0.8);
    bm[(ys[k] + 0.5) * (G + 2) + xs[k] + 0.5] = 1;
  }
  GLYPH[ch] = { n, cx, cy, dx, dy, I, R, bm };
}

// The potential energy of a letter at each of NA angles in still water,
// scaled to 0..1: the height of its centre of gravity times its weight,
// less the work the water does holding it up. The draft at each angle is
// found by halving until the letter displaces its own weight.
function curve(g, rho) {
  const out = new Float32Array(NA), n = g.n, want = rho * n;
  let lo = 1e9, hi = -1e9;
  for (let k = 0; k < NA; k++) {
    const a = -PI + (2 * PI * k) / NA, c = cos(a), s = sin(a);
    let y0 = -12, y1 = 12;
    for (let it = 0; it < 22; it++) {
      const yc = (y0 + y1) / 2;
      let f = 0;
      for (let q = 0; q < n; q++) f += cl(yc + g.dx[q] * s + g.dy[q] * c + 0.5, 0, 1);
      if (f > want) y1 = yc;
      else y0 = yc;
    }
    const yc = (y0 + y1) / 2;
    let U = -want * yc;
    for (let q = 0; q < n; q++) {
      const y = yc + g.dx[q] * s + g.dy[q] * c, t = y + 0.5;
      if (t > 0) U += (t * t - (y > 0.5 ? (y - 0.5) * (y - 0.5) : 0)) / 2;
    }
    out[k] = U;
    lo = min(lo, U);
    hi = max(hi, U);
  }
  for (let k = 0; k < NA; k++) out[k] = hi > lo ? (out[k] - lo) / (hi - lo) : 0;
  return out;
}

// 3 by 5 capitals for the word written plainly at the top.
const SMALL = {
  A: "### #.# ### #.# #.#", B: "##. #.# ##. #.# ##.", E: "### #.. ##. #.. ###", F: "### #.. ##. #.. #..",
  I: "### .#. .#. .#. ###", K: "#.# ##. #.. ##. #.#", L: "#.. #.. #.. #.. ###", N: "##. #.# #.# #.# #.#",
  O: "### #.# #.# #.# ###", S: "### #.. ### ..# ###", T: "### .#. .#. .#. .#.", U: "#.# #.# #.# #.# ###",
  Y: "#.# #.# .#. .#. .#.",
};

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, rho: 0.2, swell: 0.06, t: 0, tw: 0, wi: -1, B: [], drops: [], rise: 0,
    rip: new Float32Array(W), ripv: new Float32Array(W), surf: new Float32Array(W), sf: new Float32Array(W + 1), foam: new Float32Array(W), curves: new Map(),
    grid: new Uint8Array(W * (H + 64)), buf: new Float32Array(N * 3), btn: false,
    lc: [0, 0, 0], wc: [0, 0, 0],
  });
  word(S);
  return S;
}

function word(S) {
  S.wi = (S.wi + 1) % WORDS.length;
  S.tw = 0;
  S.soaked = false;
  const w = WORDS[S.wi], n = w.length;
  S.B = [...w].map((ch, i) => ({
    ch, g: GLYPH[ch], x: ((i + 0.5) * W) / n, y: HANG, a: 0, vx: 0, vy: 0, w: 0, fx: 0, fy: 0, tq: 0,
    rho: S.rho, on: T0 + GAP * i, free: false, wet: false, gone: false, bx: 0, by: 0, sub: 0, hue: i * 0.035,
  }));
}

// The surface: the still level, raised by the water the letters displace
// across the 64 LED tank, the swell, and the ripples splashes leave. Set
// once a step at every whole x and read between.
function level(S) {
  const sf = S.sf, a = S.swell * 6, ph = OMW * S.t;
  for (let x = 0; x <= W; x++) sf[x] = WL - S.rise + a * sin(KW * x - ph) + S.rip[min(x, W - 1)];
}
function surface(S, x) {
  if (x <= 0) return S.sf[0];
  if (x >= W) return S.sf[W];
  const i = floor(x), f = x - i;
  return S.sf[i] * (1 - f) + S.sf[i + 1] * f;
}

function splash(S, x, v, n) {
  for (let k = 0; k < n; k++) {
    const sp = v * (0.25 + 0.35 * Math.random()), an = -PI / 2 + (Math.random() - 0.5) * 1.6;
    S.drops.push({ x: x + (Math.random() - 0.5) * 12, y: WL - S.rise - 1, vx: cos(an) * sp, vy: sin(an) * sp });
  }
  const i = cl(round(x), 1, W - 2);
  for (let d = -6; d <= 6; d++) if (i + d >= 0 && i + d < W) S.ripv[i + d] += v * 0.05 * (1 - abs(d) / 7);
}

// Another letter's cell on this LED or the four beside it: its index + 1.
function touch(S, grid, gx, gy, me) {
  for (const [ox, oy] of NB) {
    const x = gx + ox, y = gy + oy;
    if (x < 0 || x >= W || y < 0 || y >= H + 64) continue;
    const o = grid[y * W + x];
    if (o && o !== me) return o;
  }
  return 0;
}
const NB = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

function step(S, h) {
  S.t += h;
  S.tw += h;
  const grid = S.grid;
  grid.fill(0);
  // Ripples: a damped wave along the surface.
  const rip = S.rip, rv = S.ripv;
  for (let i = 0; i < W; i++) {
    const l = rip[i > 0 ? i - 1 : 0], r = rip[i < W - 1 ? i + 1 : W - 1];
    rv[i] += h * (400 * (l + r - 2 * rip[i]) - 20 * rip[i] - 3 * rv[i]);
  }
  for (let i = 0; i < W; i++) rip[i] = cl(rip[i] + h * rv[i], -4, 4);
  level(S);
  const B = S.B;
  let disp = 0;
  for (let bi = 0; bi < B.length; bi++) {
    const b = B[bi];
    if (b.gone) continue;
    if (!b.free) {
      if (S.tw < b.on) continue;
      b.free = true;
      b.a = (Math.random() - 0.5) * 0.5;
      b.w = (Math.random() - 0.5) * 2;
      b.vx = (Math.random() - 0.5) * 4;
    }
    // Soaking, rho climbs slowly to just under 1 and then fast.
    b.rho = S.soaked ? min(2.4, b.rho + SOAKR * h * (b.rho < 0.95 ? 1 : 6)) : S.rho;
    const g = b.g, n = g.n, m = b.rho * n, c = cos(b.a), s = sin(b.a);
    let fx = 0, fy = m * GRAV, tq = 0, sub = 0, sx = 0, sy = 0;
    for (let k = 0; k < n; k++) {
      const rx = g.dx[k] * c - g.dy[k] * s, ry = g.dx[k] * s + g.dy[k] * c;
      const px = b.x + rx, py = b.y + ry;
      const vx = b.vx - b.w * ry, vy = b.vy + b.w * rx;
      let Fx = 0, Fy = 0;
      const f = cl(py - surface(S, px) + 0.5, 0, 1);
      if (f > 0) {
        Fx -= DRAG * f * vx;
        Fy -= GRAV * f + DRAG * f * vy;
        sub += f;
        sx += f * px;
        sy += f * py;
      } else {
        Fx -= 0.02 * vx;
        Fy -= 0.02 * vy;
      }
      if (px < 0.5) Fx += WALL * (0.5 - px);
      else if (px > W - 0.5) Fx -= WALL * (px - W + 0.5);
      // Letters keep one LED apart: a cell next to another letter's pushes
      // both along the line between their centres.
      const gx = round(px - 0.5), gy = round(py - 0.5) + 32;
      const o = touch(S, grid, gx, gy, bi + 1);
      if (o) {
        const q = B[o - 1];
        let nx = b.x - q.x, ny = b.y - q.y;
        const d = sqrt(nx * nx + ny * ny) || 1;
        nx /= d;
        ny /= d;
        const P = PUSH - 2 * min(0, (b.vx - q.vx) * nx + (b.vy - q.vy) * ny);
        Fx += P * nx;
        Fy += P * ny;
        q.fx -= P * nx;
        q.fy -= P * ny;
        q.tq += (py - q.y) * P * nx - (px - q.x) * P * ny;
      }
      if (gx >= 0 && gx < W && gy >= 0 && gy < H + 64) grid[gy * W + gx] = bi + 1;
      fx += Fx;
      fy += Fy;
      tq += rx * Fy - ry * Fx;
    }
    b.sub = sub;
    disp += sub;
    if (sub > 0) (b.bx = sx / sub), (b.by = sy / sub);
    // First touch of the water throws a splash as big as the letter is fast.
    if (sub > 0 && !b.wet) {
      b.wet = true;
      splash(S, b.x, abs(b.vy), round(cl(abs(b.vy) / 4, 4, 16)));
    }
    b.fx += fx;
    b.fy += fy;
    b.tq += tq;
  }
  S.rise = disp / W;
  for (const b of B) {
    if (!b.free || b.gone) continue;
    const m = b.rho * b.g.n, I = b.rho * b.g.I;
    b.vx += (h * b.fx) / m;
    b.vy += (h * b.fy) / m;
    b.w += (h * b.tq) / I;
    b.x += h * b.vx;
    b.y += h * b.vy;
    b.a += h * b.w;
    b.a -= 2 * PI * floor((b.a + PI) / (2 * PI));
    b.fx = b.fy = b.tq = 0;
    if (b.y > H + b.g.R) b.gone = true;
  }
  for (const d of S.drops) {
    d.vy += GRAV * h;
    d.x += d.vx * h;
    d.y += d.vy * h;
    if (d.vy > 0 && d.y > surface(S, d.x)) d.gone = true;
  }
  S.drops = S.drops.filter((d) => !d.gone && d.x > -2 && d.x < W + 2);
  if (!S.soaked && S.tw > SOAK) S.soaked = true;
  if (B.every((b) => b.gone) || S.tw > TMAX) word(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.rho = cl(k[2] == null ? 0.2 : k[2], 0.2, 0.8);
  S.swell = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn && !S.soaked) {
    S.soaked = true;
    for (const b of S.B) if (!b.free) b.gone = true;
  }
  S.btn = btn;
  const h = (d * S.speed * 0.7) / SUB;
  for (let i = 0; i < SUB; i++) step(S, h);
}

// A letter's energy curve at its density, from the cache; flat once it is
// heavier than water, when every angle is the same to it.
function curveOf(S, b) {
  const q = round(min(b.rho, 1) * 50), key = b.ch + q;
  let c = S.curves.get(key);
  if (!c) S.curves.set(key, (c = q >= 50 ? new Float32Array(NA) : curve(b.g, q / 50)));
  return c;
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] = r;
  buf[p + 1] = g;
  buf[p + 2] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, lc = S.lc, wc = S.wc;
  hsv(S.hue + 0.6, 0.85, 1, wc);
  const surf = S.surf, foam = S.foam;
  level(S);
  // The swell's height over its length is Swell / 4; past 1 in 7, at
  // Swell 0.57, its crests break white.
  const br = cl((S.swell - 0.57) / 0.3, 0, 1);
  for (let x = 0; x < W; x++) {
    surf[x] = surface(S, x + 0.5);
    foam[x] = br * max(0, -sin(KW * (x + 0.5) - OMW * S.t));
  }
  // Sky dark, water a tint that fades with depth, the surface a line.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, dpt = y + 0.5 - surf[x];
      let v = 0, wh = 0;
      if (dpt > -0.5) v = dpt < 0.5 ? 0.7 * (dpt + 0.5) : dpt < 1.5 ? 0.7 : 0.11 + 0.3 * max(0, 1 - dpt / 50) ** 2;
      if (dpt > -0.5 && dpt < 2.5) wh = foam[x] * (dpt < 0.5 ? dpt + 0.5 : 1) * (1 - max(0, dpt - 0.5) / 2);
      buf[p] = wc[0] * v * (1 - wh) + wh;
      buf[p + 1] = wc[1] * v * (1 - wh) + wh;
      buf[p + 2] = wc[2] * v * (1 - wh) + wh;
    }
  // The letters, each LED sampled from the glyph turned back; under the
  // surface seen dimmer through the water.
  for (const b of S.B) {
    if (b.gone) continue;
    const g = b.g, c = cos(b.a), s = sin(b.a), R = g.R;
    hsv(S.hue + HUE0 + b.hue, 0.8, 1, lc);
    const x0 = max(0, floor(b.x - R)), x1 = min(W - 1, floor(b.x + R)), y0 = max(0, floor(b.y - R)), y1 = min(H - 1, floor(b.y + R));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const X = x + 0.5 - b.x, Y = y + 0.5 - b.y;
        const u = X * c + Y * s + g.cx + 0.5, v = -X * s + Y * c + g.cy + 0.5;
        if (u < 0 || v < 0 || u >= G + 1 || v >= G + 1) continue;
        const i = floor(u), j = floor(v), fu = u - i, fv = v - j, o = j * (G + 2) + i;
        let a = (g.bm[o] * (1 - fu) + g.bm[o + 1] * fu) * (1 - fv) + (g.bm[o + G + 2] * (1 - fu) + g.bm[o + G + 3] * fu) * fv;
        if (a <= 0.05) continue;
        a = a >= 0.9 ? 1 : a * a * (3 - 2 * a);
        const p = (y * W + x) * 3, dpt = y + 0.5 - surf[x];
        const k = dpt > 0 ? 0.5 - 0.3 * min(1, dpt / 50) : 1;
        for (let q = 0; q < 3; q++) buf[p + q] = buf[p + q] * (1 - a * (dpt > 0 ? 0.6 : 1)) + lc[q] * k * a;
      }
  }
  // G and B: the centre of gravity white, the centre of buoyancy in the
  // water's colour, which settles straight under it.
  for (const b of S.B) {
    if (!b.free || b.gone) continue;
    put(buf, floor(b.x), floor(b.y), 1, 1, 1);
    if (b.sub > 0.5) put(buf, floor(b.bx), floor(b.by), 0.4 + 0.6 * wc[0], 0.4 + 0.6 * wc[1], 0.4 + 0.6 * wc[2]);
  }
  for (const d of S.drops) put(buf, floor(d.x), floor(d.y), 0.5 + 0.5 * wc[0], 0.5 + 0.5 * wc[1], 0.5 + 0.5 * wc[2]);
  // At the top, the word written plainly, and over each letter's place its
  // potential energy against its angle, -180 to 180 degrees, with a dot
  // where the letter is now: it rolls into a valley as the letter settles.
  const B = S.B, n = B.length, cw = floor(W / n);
  for (let i = 0; i < n; i++) {
    const b = B[i], cu = curveOf(S, b), x0 = floor((i * W) / n) + floor((W / n - cw) / 2) + 1, wd = cw - 2;
    hsv(S.hue + HUE0 + b.hue, 0.45, 0.7, lc);
    let py = -1;
    for (let x = 0; x < wd; x++) {
      const t = (x / (wd - 1)) * NA, k0 = floor(t) % NA, f = t - floor(t);
      const u = cu[k0] * (1 - f) + cu[(k0 + 1) % NA] * f, y = round(CY1 - u * (CY1 - CY0));
      const ya = py < 0 ? y : y > py ? py + 1 : y, yb = py < 0 ? y : y < py ? py - 1 : y;
      for (let yy = min(ya, yb, y); yy <= max(ya, yb, y); yy++) put(buf, x0 + x, yy, lc[0], lc[1], lc[2]);
      py = y;
    }
    put(buf, x0 + floor((wd - 1) / 2), CY1 + 2, lc[0] * 0.6, lc[1] * 0.6, lc[2] * 0.6);
    const t = ((b.a + PI) / (2 * PI)) * NA, k0 = floor(t) % NA, f = t - floor(t);
    const u = cu[k0] * (1 - f) + cu[(k0 + 1) % NA] * f;
    const bx = x0 + round(((b.a + PI) / (2 * PI)) * (wd - 1)), by = round(CY1 - u * (CY1 - CY0)) - 1;
    put(buf, bx, by, 1, 1, 1);
    put(buf, bx, by - 1, 1, 1, 1);
  }
  const w = WORDS[S.wi], lx = floor((W - (w.length * 4 - 1)) / 2);
  hsv(S.hue + HUE0, 0.6, 0.75, lc);
  for (let i = 0; i < w.length; i++) {
    const rows = SMALL[w[i]].split(" ");
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (rows[r][q] === "#") put(buf, lx + i * 4 + q, 2 + r, lc[0], lc[1], lc[2]);
  }
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p - x) / W;
    display.setPixel(x, y, round(cl(buf[p * 3], 0, 1) * 255), round(cl(buf[p * 3 + 1], 0, 1) * 255), round(cl(buf[p * 3 + 2], 0, 1) * 255));
  }
}
