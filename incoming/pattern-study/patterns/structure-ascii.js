// ===== Patternflow pattern =====
// Title:   Structure ASCII
// Family:  type
// Idea:    The outline of a big letter sways and melts from A to S to & to the Hangul syllable 글 behind a grid of character cells, and each cell the outline crosses takes the ASCII character whose strokes lie nearest the piece of outline inside it, so slashes, bars, underscores, parentheses and ticks join into the letter's contour, as in structure-based ASCII art; a fourth setting picks by ink instead, as tone-based ASCII art does.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Structure-based ASCII Art (Xuemiao Xu, Linling Zhang and Tien-Tsin Wong, SIGGRAPH 2010), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..3, Cell=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the straight strokes are turquoise, curves and angles azure, corners and crossings green, dots and ticks lilac, and the outline under them a dim blue; at 0.5 the strokes are red.
// Knob 2: Speed. At 2 a letter holds 4.5 s and melts into the next in 1.5 s, so the four take 24 s, while the drawing sways 0.12 radian (about 7 degrees) each way every 9 s. At 0.2 it all takes ten times as long, at 3 two thirds as long.
// Knob 3: Set. The characters a cell may take, each set with the space. At 0 the 27 of the structure set (. , ' ` " - _ = | / \ ( ) < > ^ v ~ o + L J 7 T Y V X); at 1 twelve of them (/ \ | - _ . ' , ( ) < >); at 2 only / \ | and -. At 3 the tone ramp . : - = + * # % @, picked by how much of the cell the outline darkens, not by its shape.
// Knob 4: Cell. The size of a character cell in LEDs: 5 by 8 at 0 (a grid of 12 by 16), 4 by 6 at 1 (16 by 21), 3 by 5 at 2 (21 by 25), and 7 by 11 at 3 (9 by 11), where each character is big enough to read.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The paper (Xu, Zhang and Wong 2010) compares a cell and a character with an
// alignment-insensitive shape similarity and also deforms the drawing to suit
// the characters. Here the drawing is never deformed, and the comparison is a
// symmetric chamfer distance that lets the character slide by up to two LEDs
// across (one in a 3 by 5 cell) and one up or down, at 0.12 for each LED of
// slide; the character is still drawn in its own cell.

// ---- The characters. Each is drawn as pen strokes in a unit cell, across
// then down in tenths, so (0,0) is the top left corner and (10,10) the
// bottom right; a stroke of one point is a dot. Strokes run to the cell's
// edge where the character's line would go on into its neighbour, so two
// slashes side by side meet. The second field is a class for colour:
// 0 straight lines, 1 curves and angles, 2 corners and crossings, 3 dots.
const GLYPHS = [
  [" ", 3, []],
  [".", 3, [[5, 10]]],
  [",", 3, [[6, 8, 4, 10]]],
  ["'", 3, [[5, 0, 5, 2]]],
  ["`", 3, [[3, 0, 6, 3]]],
  ['"', 3, [[2, 0, 2, 2], [8, 0, 8, 2]]],
  [":", 3, [[5, 3], [5, 8]]],
  ["-", 0, [[0, 5, 10, 5]]],
  ["_", 0, [[0, 10, 10, 10]]],
  ["=", 0, [[0, 3, 10, 3], [0, 7, 10, 7]]],
  ["|", 0, [[5, 0, 5, 10]]],
  ["/", 0, [[0, 10, 10, 0]]],
  ["\\", 0, [[0, 0, 10, 10]]],
  ["(", 1, [[8, 0, 4, 2, 2, 5, 4, 8, 8, 10]]],
  [")", 1, [[2, 0, 6, 2, 8, 5, 6, 8, 2, 10]]],
  ["<", 1, [[10, 0, 0, 5, 10, 10]]],
  [">", 1, [[0, 0, 10, 5, 0, 10]]],
  ["^", 1, [[0, 5, 5, 0, 10, 5]]],
  ["v", 1, [[0, 4, 5, 10, 10, 4]]],
  ["~", 1, [[0, 6, 3, 4, 7, 6, 10, 4]]],
  ["o", 1, [[3, 4, 7, 4, 9, 6, 9, 8, 7, 10, 3, 10, 1, 8, 1, 6, 3, 4]]],
  ["+", 2, [[0, 5, 10, 5], [5, 1, 5, 9]]],
  ["L", 2, [[0, 0, 0, 10, 10, 10]]],
  ["J", 2, [[10, 0, 10, 10, 0, 10]]],
  ["7", 2, [[0, 0, 10, 0, 3, 10]]],
  ["T", 2, [[0, 0, 10, 0], [5, 0, 5, 10]]],
  ["Y", 2, [[0, 0, 5, 5, 10, 0], [5, 5, 5, 10]]],
  ["V", 2, [[0, 0, 5, 10, 10, 0]]],
  ["X", 2, [[0, 0, 10, 10], [10, 0, 0, 10]]],
  ["*", 2, [[5, 2, 5, 8], [1, 3, 9, 7], [9, 3, 1, 7]]],
  ["#", 2, [[3, 1, 3, 9], [7, 1, 7, 9], [0, 3, 10, 3], [0, 7, 10, 7]]],
  ["%", 2, [[10, 0, 0, 10], [1, 1], [9, 9]]],
  ["@", 2, [[10, 10, 0, 10, 0, 0, 10, 0, 10, 7, 4, 7, 4, 4, 7, 4]]],
];
const GI = {};
GLYPHS.forEach((g, i) => (GI[g[0]] = i));
const pick = (s) => Array.from(s, (c) => GI[c]);
// The character sets, each with the space: 27 characters for structure, 12
// of them, the four straight strokes, and a tone ramp of nine by ink.
const SETS = [
  pick(" .,'`\"-_=|/\\()<>^v~o+LJ7TYVX"),
  pick(" /\\|-_.',()<>"),
  pick(" /\\|-"),
  pick(" .:-=+*#%@"),
];
const RAMP = SETS[3];

// The cell sizes: width, height.
const CELLS = [
  [5, 8],
  [4, 6],
  [3, 5],
  [7, 11],
];
// The distance is capped at CAP LEDs; a shift of the character by one LED
// across or down costs SHIFT.
const CAP = 3, SHIFT = 0.12;
const SX = (cw) => (cw >= 4 ? 2 : 1), SY = 1;

// Each character at each cell size: its bitmap, its lit LEDs, and the
// distance from each LED of the cell and a border round it to the nearest
// lit LED, so it can be compared shifted.
function raster(strokes, cw, ch) {
  const bm = new Uint8Array(cw * ch);
  for (const pl of strokes) {
    const P = [];
    for (let i = 0; i < pl.length; i += 2) P.push([(pl[i] / 10) * (cw - 1), (pl[i + 1] / 10) * (ch - 1)]);
    if (P.length === 1) bm[round(P[0][1]) * cw + round(P[0][0])] = 1;
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      const n = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0))));
      for (let k = 0; k <= n; k++) bm[floor(y0 + ((y1 - y0) * k) / n + 0.5) * cw + floor(x0 + ((x1 - x0) * k) / n + 0.5)] = 1;
    }
  }
  return bm;
}
const FONT = CELLS.map(([cw, ch]) => {
  const bx = SX(cw), by = SY, ew = cw + 2 * bx, eh = ch + 2 * by;
  return GLYPHS.map((g) => {
    const bm = raster(g[2], cw, ch);
    const ink = [];
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (bm[j * cw + i]) ink.push(i, j);
    const dist = new Float32Array(ew * eh);
    for (let b = 0; b < eh; b++)
      for (let a = 0; a < ew; a++) {
        let d = CAP * CAP;
        for (let k = 0; k < ink.length; k += 2) {
          const dx = a - bx - ink[k], dy = b - by - ink[k + 1];
          d = min(d, dx * dx + dy * dy);
        }
        dist[b * ew + a] = sqrt(d);
      }
    return { bm, ink, dist };
  });
});

// ---- The big letters, as centre lines in a box 52 by 108 LEDs about the
// panel's middle, y down; the outline is where the distance to the centre
// line equals the stroke's half width.
function arc(cx, cy, rx, ry, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * PI) / 180;
    pts.push(cx + rx * cos(a), cy + ry * sin(a));
  }
  return pts;
}
const LETTERS = [
  { r: 7, lines: [[-22, 52, 0, -50, 22, 52], [-12, 18, 12, 18]] },
  { r: 7, lines: [[...arc(1, -28, 20, 24, -25, -270, 12), ...arc(0, 25, 22, 27, -90, 155, 12)]] },
  { r: 6, lines: [[23, 52, -10, 0, ...arc(-3, -32, 12, 19, 130, 405, 12), -16, 8, ...arc(-4, 32, 20, 21, 210, 60, 10), 21, 18]] },
  { r: 4.5, lines: [[-22, -52, 20, -52, 20, -31], [-27, -14, 27, -14], [-20, 5, 20, 5, 20, 26, -20, 26, -20, 47, 22, 47]] },
];
for (const L of LETTERS) {
  const s = [];
  for (const pl of L.lines) for (let i = 0; i + 3 < pl.length; i += 2) s.push(pl[i], pl[i + 1], pl[i + 2], pl[i + 3]);
  L.seg = new Float32Array(s);
}

function lineDist(seg, x, y) {
  let best = 1e9;
  for (let i = 0; i < seg.length; i += 4) {
    const ax = seg[i], ay = seg[i + 1], bx = seg[i + 2] - ax, by = seg[i + 3] - ay;
    const px = x - ax, py = y - ay, L = bx * bx + by * by;
    let t = L > 0 ? (px * bx + py * by) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - t * bx, dy = py - t * by, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return sqrt(best);
}

const LW = W + 1, LH = H + 1, CW = 33, CH = 65;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, set: 0, cell: 0,
    // The field on every second LED corner, then on every corner.
    g: new Float32Array(CW * CH), f: new Float32Array(LW * LH),
    // The outline's piece in each LED square: up to two segments.
    sq: new Float32Array(W * H * 8), nsq: new Uint8Array(W * H),
    // Per cell: its character, and a hash of the LEDs the outline crossed.
    ch: new Int16Array(32 * 32), sig: new Int32Array(32 * 32),
    dt: new Float32Array(32 * 32), segs: new Float32Array(400), tl: new Int16Array(200),
    rgb: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.t += cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) / 2;
  S.set = cl(round(k[2]), 0, 3);
  const c = cl(round(k[3]), 0, CELLS.length - 1);
  if (c !== S.cell || S.set !== S.lastSet) { S.ch.fill(0); S.sig.fill(0); }
  S.cell = c;
  S.lastSet = S.set;
}

// One letter holds HOLD units of the clock, then melts into the next in MELT.
const HOLD = 4.5, MELT = 1.5, PER = HOLD + MELT;

function field(S) {
  const n = floor(S.t / PER), u = S.t - n * PER;
  const A = LETTERS[n % LETTERS.length], B = LETTERS[(n + 1) % LETTERS.length];
  const m = smooth((u - HOLD) / MELT);
  const th = 0.12 * sin((2 * PI * S.t) / 9), cs = cos(th), sn = sin(th), sc = 1 / 0.9;
  const g = S.g, f = S.f;
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const X = 2 * i - 32, Y = 2 * j - 64;
      const x = (cs * X + sn * Y) * sc, y = (-sn * X + cs * Y) * sc;
      let v = lineDist(A.seg, x, y) - A.r;
      if (m > 0) v = (1 - m) * v + m * (lineDist(B.seg, x, y) - B.r);
      g[j * CW + i] = v;
    }
  // In between, the mean of the neighbours on the coarse lattice.
  for (let j = 0; j < LH; j++) {
    const j0 = j >> 1, j1 = (j + 1) >> 1;
    for (let i = 0; i < LW; i++) {
      const i0 = i >> 1, i1 = (i + 1) >> 1;
      f[j * LW + i] = 0.25 * (g[j0 * CW + i0] + g[j0 * CW + i1] + g[j1 * CW + i0] + g[j1 * CW + i1]);
    }
  }
}

// Marching squares on the LED corners: the outline's piece in each LED square.
function contour(S) {
  const f = S.f, sq = S.sq, nsq = S.nsq;
  const P = new Float32Array(8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = f[y * LW + x], b = f[y * LW + x + 1], c = f[(y + 1) * LW + x + 1], d = f[(y + 1) * LW + x];
      const q = y * W + x, ia = a < 0, ib = b < 0, ic = c < 0, id = d < 0;
      nsq[q] = 0;
      if (ia === ib && ib === ic && ic === id) continue;
      // Where the outline crosses the top, right, bottom and left edges.
      let np = 0;
      if (ia !== ib) { P[np++] = x + a / (a - b); P[np++] = y; }
      if (ib !== ic) { P[np++] = x + 1; P[np++] = y + b / (b - c); }
      if (id !== ic) { P[np++] = x + d / (d - c); P[np++] = y + 1; }
      if (ia !== id) { P[np++] = x; P[np++] = y + a / (a - d); }
      const o = q * 8;
      for (let k = 0; k < np; k++) sq[o + k] = P[k];
      if (np === 8 && (a + b + c + d < 0) !== ia) {
        // A saddle: pair top with left and right with bottom.
        sq[o + 2] = P[6]; sq[o + 3] = P[7]; sq[o + 4] = P[2]; sq[o + 5] = P[3]; sq[o + 6] = P[4]; sq[o + 7] = P[5];
      }
      nsq[q] = np >> 2;
    }
}

// The chamfer distance between a character shifted by sx, sy and the
// outline is the distance from each of its lit LEDs to the outline, plus
// the distance from each LED the outline crosses to its nearest lit LED,
// over the count of both, plus SHIFT for each LED of shift. The shifts of
// each cell size, cheapest first: sx, sy, cost.
const SHIFTS = CELLS.map(([cw]) => {
  const L = [];
  for (let sy = -SY; sy <= SY; sy++) for (let sx = -SX(cw); sx <= SX(cw); sx++) L.push([sx, sy, SHIFT * (abs(sx) + abs(sy))]);
  return L.sort((a, b) => a[2] - b[2]).flat();
});

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  field(S);
  contour(S);
  const [cw, ch] = CELLS[S.cell], font = FONT[S.cell];
  const cols = floor(W / cw), rows = floor(H / ch);
  const ox = floor((W - cols * cw) / 2), oy = floor((H - rows * ch) / 2);
  const set = SETS[S.set], tone = S.set === 3, shifts = SHIFTS[S.cell];
  const bx = SX(cw), by = SY, ew = cw + 2 * bx, eh = ch + 2 * by;
  const sq = S.sq, nsq = S.nsq, rgb = S.rgb, dT = S.dt, segs = S.segs, tl = S.tl;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  const h0 = 0.47 + S.hue;
  // The outline itself, faint.
  hsv(h0 + 0.18, 0.7, 0.24, rgb);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (nsq[y * W + x]) display.setPixel(x, y, rgb[0] | 0, rgb[1] | 0, rgb[2] | 0);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const gx = ox + c * cw, gy = oy + r * ch, id = r * 32 + c;
      // The outline's pieces in this cell, and the LEDs they cross.
      let ns = 0, nt = 0;
      for (let j = 0; j < ch; j++)
        for (let i = 0; i < cw; i++) {
          const q = (gy + j) * W + gx + i;
          if (!nsq[q]) continue;
          tl[nt++] = j * ew + i + by * ew + bx;
          for (let k = 0; k < nsq[q] * 4; k += 4) {
            const o = q * 8 + k;
            segs[ns++] = sq[o] - gx; segs[ns++] = sq[o + 1] - gy; segs[ns++] = sq[o + 2] - gx; segs[ns++] = sq[o + 3] - gy;
          }
        }
      if (!nt) { S.ch[id] = 0; continue; }
      // Only a cell whose crossed LEDs changed is matched again.
      let sig = nt;
      for (let k = 0; k < nt; k++) sig = (sig * 31 + tl[k]) | 0;
      if (sig === S.sig[id] && S.ch[id]) { paint(display, S, S.ch[id], font, gx, gy, cw, ch, h0); continue; }
      S.sig[id] = sig;
      // Distance from each LED centre of the cell and its border to the outline.
      for (let b = 0; b < eh; b++)
        for (let a = 0; a < ew; a++) {
          const px = a - bx + 0.5, py = b - by + 0.5;
          let best = CAP * CAP;
          for (let i = 0; i < ns; i += 4) {
            const ax = segs[i], ay = segs[i + 1], ux = segs[i + 2] - ax, uy = segs[i + 3] - ay;
            const vx = px - ax, vy = py - ay, L = ux * ux + uy * uy;
            let t = L > 0 ? (vx * ux + vy * uy) / L : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const dx = vx - t * ux, dy = vy - t * uy, d = dx * dx + dy * dy;
            if (d < best) best = d;
          }
          dT[b * ew + a] = sqrt(best);
        }
      let g = 0;
      if (tone) {
        // Tone: how much of the cell the outline darkens, on the ramp from the space.
        let ink = 0;
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) ink += max(0, 1 - dT[(j + by) * ew + i + bx]);
        g = RAMP[min(9, round((ink / (cw * ch)) * 22))];
      } else {
        // Each character of the set at every shift, the cell's last character
        // first; a shift is given up as soon as its sum cannot win.
        const prev = S.ch[id];
        let bestC = 1e9, prevC = 1e9;
        for (let k = -1; k < set.length; k++) {
          const gi = k < 0 ? prev : set[k];
          if (k >= 0 && gi === prev) continue;
          const G = font[gi], ink = G.ink, dist = G.dist, n = ink.length / 2 + nt;
          let cbest = 1e9;
          for (let m = 0; m < shifts.length; m += 3) {
            const sx = shifts[m], sy = shifts[m + 1], pen = shifts[m + 2];
            const lim = ((k < 0 ? cbest : min(cbest, bestC)) - pen) * n;
            if (lim <= 0) break;
            let cost = 0;
            const io = (sy + by) * ew + sx + bx;
            for (let i = 0; i < ink.length && cost < lim; i += 2) cost += dT[ink[i + 1] * ew + ink[i] + io];
            const so = -sy * ew - sx;
            for (let i = 0; i < nt && cost < lim; i++) cost += dist[tl[i] + so];
            if (cost < lim) cbest = cost / n + pen;
          }
          if (k < 0) prevC = cbest;
          if (cbest < bestC) { bestC = cbest; g = gi; }
        }
        // Hold on to the last character unless a new one fits clearly better.
        if (prevC < bestC + 0.08) g = prev;
      }
      S.ch[id] = g;
      if (g) paint(display, S, g, font, gx, gy, cw, ch, h0);
    }
}

function paint(display, S, g, font, gx, gy, cw, ch, h0) {
  const G = GLYPHS[g], bm = font[g].bm, rgb = S.rgb;
  hsv(h0 + [0, 0.12, -0.1, 0.3][G[1]], G[1] === 3 ? 0.5 : 0.85, 1, rgb);
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) if (bm[j * cw + i]) display.setPixel(gx + i, gy + j, rgb[0] | 0, rgb[1] | 0, rgb[2] | 0);
}
