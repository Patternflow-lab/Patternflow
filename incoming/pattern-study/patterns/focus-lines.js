// ===== Patternflow pattern =====
// Title:   Focus Lines
// Family:  comic
// Idea:    Black ink wedges run in from the edges of a flat yellow panel towards one slowly wandering point and stop short of it round a clear oval that glows white, redrawn eight times a second so that they boil, and now and then they all stab inwards and ease back.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: manga focus lines (shuchusen), redrawn on threes like cel animation
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Boil=0..3, Lines=-1..1, Reach=0..1
//
// Knob 1: Hue. The colour of the ground under the ink, from yellow where the knob opens round the wheel; the ink stays black and the middle of the clear oval stays white.
// Knob 2: Boil. How often the lines are redrawn and how far each redrawing strays from the last. At the bottom of the knob one drawing is held still and only the point wanders; it opens on eight redrawings a second, and the top is twelve.
// Knob 3: Lines. How many lines there are: about a dozen heavy wedges at the bottom, about 44 where the knob opens, over a hundred fine ones at the top.
// Knob 4: Reach. How close the tips come to the point. Where the knob opens they stop round a wide clear oval; at the top they nearly meet.

const W = 64;
const H = 128;
// The clear zone is an oval, taller than wide: distances up and down count for this much.
const OVAL = 0.62;
// Redrawings a second at Boil 1. Animation on threes is eight a second, and the knob opens on 2.
const REDRAW = 4;
// Most lines there can be, and how finely the way round the frame is cut to find a line's sector.
const MOST = 128;
const CELLS = 1024;

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(v) {
  v = clamp(v, 0, 1);
  return v * v * (3 - 2 * v);
}

export function setup(params) {
  params.t = 0;
  // The drawing clock counts redrawings, and stands still at Boil 0.
  params.drawn = 0;
  params.hits = 0;
  params.next = 4.3;
  params.age = 99;
  params.n = 0;
  // The way round the frame is cut into sectors of unequal width, one line to a sector: where each starts, and which one each cell is in.
  params.edge = new Float32Array(MOST + 1);
  params.which = new Uint8Array(CELLS);
  // The four sides of the frame, clockwise from the top: how far the point is from each, and where each starts on the way round.
  params.gap = new Float32Array(4);
  params.from = new Float32Array(4);
  params.sum = new Float32Array(5);
  params.on = new Uint8Array(MOST);
  params.ax = new Float32Array(MOST);
  params.ay = new Float32Array(MOST);
  params.ux = new Float32Array(MOST);
  params.uy = new Float32Array(MOST);
  params.tip = new Float32Array(MOST);
  params.inv = new Float32Array(MOST);
  params.wide = new Float32Array(MOST);
  params.col = new Float32Array(3);
}

// Cut the way round into n sectors, the widest `spread` times the narrowest, so that fat wedges and bunches of thin lines fall where they will.
function cut(params, n, spread) {
  const { edge, which } = params;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.pow(spread, hash(i, n));
  let at = 0;
  for (let i = 0; i < n; i++) {
    edge[i] = at;
    at += (Math.pow(spread, hash(i, n)) * CELLS) / sum;
  }
  edge[n] = CELLS;
  for (let c = 0, i = 0; c < CELLS; c++) {
    while (i < n - 1 && edge[i + 1] <= c) i++;
    which[c] = i;
  }
  params.n = n;
}

// The way round the frame is not measured in LEDs of frame but in how wide a stretch of it looks from the point, so that lines one measure apart are the same distance apart where they meet the frame, square on or at a slant.
function measure(params) {
  const { fx, fy, gap, from, sum } = params;
  gap[0] = fy;
  gap[1] = W - fx;
  gap[2] = H - fy;
  gap[3] = fx;
  const ends = [-fx, W - fx, -fy, H - fy, fx - W, fx, fy - H, fy];
  sum[0] = 0;
  for (let s = 0; s < 4; s++) {
    from[s] = Math.asinh(ends[2 * s] / gap[s]);
    sum[s + 1] = sum[s] + gap[s] * (Math.asinh(ends[2 * s + 1] / gap[s]) - from[s]);
  }
}

// Rule the lines for this frame: for each sector, where its line is anchored on the frame, where it aims, where its tip is and how wide it is at the rim.
function rule(params, fill, slender, clear, epoch, stray) {
  const { edge, on, fx, fy, n, gap, from, sum } = params;
  const round = sum[4];
  for (let i = 0; i < n; i++) {
    on[i] = 0;
    const room = ((edge[i + 1] - edge[i]) * round) / CELLS;
    // Lines come and go over some seconds. One that goes shrinks back to the rim, keeping its shape.
    const life = smooth((noise1(epoch * 0.03 + hash(i, 5) * 40, i) - 0.22) / 0.14);
    if (life < 0.15 || room < 3) continue;
    // What this drawing of the line strays by from its ruled place.
    const j1 = (hash(i, epoch * 8 + 11) - 0.5) * stray;
    const j2 = (hash(i, epoch * 8 + 12) - 0.5) * stray;
    const j3 = (hash(i, epoch * 8 + 13) - 0.5) * stray;
    const j4 = (hash(i, epoch * 8 + 14) - 0.5) * stray;
    const j5 = (hash(i, epoch * 8 + 15) - 0.5) * stray;
    // No line is under 2 LEDs wide at the rim, and there is always a gap to the next.
    const base = Math.max(2, Math.min(room - 1.2, room * (fill + 0.22 * hash(i, 1)) * (1 + 0.3 * j1)));
    const q = (edge[i] * round) / CELLS + 0.5 * room + (hash(i, 2) - 0.5) * Math.max(0, room - base - 1.2) + 0.7 * j2;
    // The anchor on the frame.
    let s = 0;
    while (s < 3 && q >= sum[s + 1]) s++;
    const along = gap[s] * Math.sinh(from[s] + (q - sum[s]) / gap[s]);
    const cx = s === 0 ? fx + along : s === 1 ? W : s === 2 ? fx - along : 0;
    const cy = s === 0 ? 0 : s === 1 ? fy + along : s === 2 ? H : fy - along;
    // A ruler laid by hand misses the point by a little.
    const ax = fx + 2 * (hash(i, 6) - 0.5) + 1.8 * j3;
    const ay = fy + 2 * (hash(i, 7) - 0.5) + 1.8 * j4;
    const vx = cx - ax;
    const vy = cy - ay;
    const len = Math.sqrt(vx * vx + vy * vy) + 1e-6;
    const ux = vx / len;
    const uy = vy / len;
    // Most tips stop near the clear oval and some stop well short of it.
    const far = 1 + Math.pow(hash(i, 3), 1.7);
    const tip = (clear * far * (1 + 0.24 * j5)) / Math.sqrt(ux * ux + OVAL * OVAL * uy * uy);
    // A thin line is kept short, or most of it would be thinner than an LED.
    const run = Math.min(len - tip, base * slender * (1 + 0.24 * j5)) * life;
    if (run < 2) continue;
    on[i] = 1;
    params.ax[i] = ax;
    params.ay[i] = ay;
    params.ux[i] = ux;
    params.uy[i] = uy;
    params.tip[i] = len - run;
    params.inv[i] = 1 / run;
    // Half the width at the rim. A short line is kept slender.
    params.wide[i] = 0.5 * base * life * Math.min(1, run / 6);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const boil = clamp(k[1], 0, 3);
  const lines = clamp(k[2], -1, 1);
  const reach = clamp(k[3], 0, 1);
  params.t += dt;
  params.drawn += dt * REDRAW * boil;
  const t = params.t;

  // The point wanders on sines that never come back into step.
  params.fx = 32 + 9 * Math.sin(0.153 * t + 1.1) + 5 * Math.sin(0.087 * t + 4.0);
  params.fy = 64 + 17 * Math.sin(0.117 * t + 0.4) + 9 * Math.sin(0.061 * t + 2.3);
  measure(params);

  // An impact comes every five to eleven seconds.
  params.age += dt;
  params.next -= dt;
  if (params.next <= 0) {
    params.hits++;
    params.next = 5 + 6 * hash(params.hits, 77);
    params.age = 0;
  }
  const a = params.age;
  const hit = a < 0.12 ? smooth(a / 0.12) : 1 - smooth((a - 0.12) / 1.2);
  params.flash = a < 0.05 ? a / 0.05 : Math.exp(-(a - 0.05) / 0.16);

  const clear = 11 - 9.5 * reach;
  params.clear = clear;
  const stab = clear * (1 - 0.58 * hit);

  // How many lines, and how unequal: a dozen heavy wedges, 44 or so of all widths, or as many fine ones as the frame has room for.
  const n = Math.round(lines < 0 ? 52 * Math.pow(52 / 15, lines) : 52 * Math.pow(78 / 52, lines));
  if (n !== params.n) cut(params, n, lines < 0 ? 5 + 2 * lines : 5 - 3.2 * lines);
  // How many times its width at the rim a line may be long.
  const slender = 11 + 4 * Math.max(0, lines);
  rule(params, 0.7 + 0.2 * Math.min(0, lines), slender, stab, Math.floor(params.drawn), boil / 2);

  hsv(k[0] + 0.15, 0.9 - 0.4 * params.flash, 0.85 + 0.15 * params.flash, params.col);
}

export function draw(display, params) {
  const { fx, fy, col, clear, edge, which, gap, from, sum, on, ax, ay, ux, uy, tip, inv, wide } = params;
  const cells = CELLS / sum[4];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - fx;
      const dy = y + 0.5 - fy;
      // Which side of the frame the ray from the point through this LED leaves by, how far round that is, and so which sector the LED is in.
      const tx = dx > 0 ? (W - fx) / dx : dx < 0 ? -fx / dx : 1e9;
      const ty = dy > 0 ? (H - fy) / dy : dy < 0 ? -fy / dy : 1e9;
      const s = tx < ty ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      const slant = tx < ty ? dy / dx : dy !== 0 ? -dx / dy : 0;
      const c = clamp((sum[s] + gap[s] * (Math.asinh(slant) - from[s])) * cells, 0, CELLS - 0.001);
      let i = which[c | 0];
      if (c >= edge[i + 1]) i++;
      // How much of this LED the line of its sector covers.
      let ink = 0;
      if (on[i]) {
        const px = x + 0.5 - ax[i];
        const py = y + 0.5 - ay[i];
        const part = (px * ux[i] + py * uy[i] - tip[i]) * inv[i];
        if (part > 0) {
          const half = wide[i] * part;
          const d = Math.abs(px * uy[i] - py * ux[i]);
          ink = clamp(half - d + 0.5, 0, 1) - clamp(0.5 - half - d, 0, 1);
        }
      }
      // The clear oval runs from white at the point to the ground colour at its edge.
      const re = Math.sqrt(dx * dx + OVAL * OVAL * dy * dy);
      const glow = 0.95 * Math.pow(clamp(1 - re / clear, 0, 1), 0.8);
      const paper = 255 * (1 - ink);
      display.setPixel(x, y, paper * (col[0] + (1 - col[0]) * glow), paper * (col[1] + (1 - col[1]) * glow), paper * (col[2] + (1 - col[2]) * glow));
    }
  }
}
