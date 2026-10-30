// ===== Patternflow pattern =====
// Title:   Multiple Master
// Family:  type
// Idea:    The word MASTER is stored as four master outlines, light and black at condensed and extended width, all with the same points in the same order, and the big word on top is the instance made by blending the four point lists bilinearly at the weight and width of the knobs, while it wanders slowly round the knob point on the design-space square below, whose corners hold the four masters of one letter at a time.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Multiple Master fonts (Adobe, 1991; the first faces Myriad MM and Minion MM, 1992), the axis tags wght and wdth of OpenType Font Variations (2016), letters and masters drawn for this pattern, pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Weight=-1..1, Width=-1..1
//
// Knob 1: Hue. Turns the picture round the wheel: at 0 the word is pale azure, the design space blue and the instance dot gold.
// Knob 2: Speed. How fast the instance wanders round the knob point and the corners change letter: at 2 the slowest part of the wander comes round in 14 s and each letter holds the corners 3 s; at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Weight. Where the knob point sits on the weight axis, light at -1 and black at 1; the instance wanders up to 0.24 of the axis either side of it and folds back at the ends. The stems go from 1.6 LEDs to 4.1 at black condensed and 5.6 at black extended, the counters of A, R and S close up and the vertex of M lifts off the base line.
// Knob 4: Width. The same on the width axis, condensed at -1 and extended at 1: the letters and the space between them stretch together, the top line from 29 LEDs of ink at light condensed to 55 at light extended and 58 at black extended.
// Buttons: K3 tap leans the word 8 degrees, or stands it up again: a slant axis, whose ends differ by a shear alone.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The masters. Master m is weight (m >> 1) and width (m & 1): 0 light
// condensed, 1 light extended, 2 black condensed, 3 black extended. Units are
// the cap height, y up from the base line. Each letter is drawn by one
// function from the master's numbers below, so all four come out with the
// same contours of the same point counts; the code checks that and stops if
// they do not. Pieces overlap (an E is a stem and three arms) and fill by
// the nonzero rule, as OpenType variable outlines may; Type 1 MM outlines
// could not overlap.
const SV = [0.072, 0.076, 0.185, 0.255]; // vertical stem
const SB = [0.05, 0.085, 0.042, 0.072]; // side bearing
// Body width of each letter at the four masters, and how much of the side
// bearing it keeps on the left and right (open sides take less).
const BW = {
  M: [0.48, 0.88, 0.64, 0.94],
  A: [0.4, 0.78, 0.52, 0.84],
  S: [0.34, 0.62, 0.5, 0.7],
  T: [0.36, 0.68, 0.44, 0.74],
  E: [0.3, 0.56, 0.42, 0.62],
  R: [0.38, 0.66, 0.5, 0.74],
};
const SIDE = { M: [1, 1], A: [0.25, 0.25], S: [0.8, 0.8], T: [0.3, 0.3], E: [1, 0.6], R: [1, 0.45] };

const rect = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
// A ring between two superellipses from angle a0 to a1 (degrees), n points
// along each edge: the bowls of S and R.
function ring(cx, cy, rxo, ryo, rxi, ryi, a0, a1, n, ex) {
  const o = [], e = 2 / ex;
  const pt = (rx, ry, a) => {
    const c = cos((a * PI) / 180), s = sin((a * PI) / 180);
    o.push(cx + rx * Math.sign(c) * abs(c) ** e, cy + ry * Math.sign(s) * abs(s) ** e);
  };
  for (let i = 0; i < n; i++) pt(rxo, ryo, a0 + ((a1 - a0) * i) / (n - 1));
  for (let i = n - 1; i >= 0; i--) pt(rxi, ryi, a0 + ((a1 - a0) * i) / (n - 1));
  return o;
}
// The horizontal width of a stroke of perpendicular thickness t that rises
// dy over dx: t * length / dy, solved with the stroke's own width in dx.
function slantW(t, dx0, k, dy) {
  let hx = t;
  for (let i = 0; i < 4; i++) {
    const dx = dx0 - k * hx;
    hx = (t * sqrt(dx * dx + dy * dy)) / dy;
  }
  return hx;
}

function design(ch, m) {
  const w = m >> 1, bw = BW[ch][m], sv = SV[m], sh = sv * (w ? 0.84 : 0.92), td = sv * 0.96;
  const c = [];
  if (ch === "M") {
    // Vertex on the base line when light; lifted 0.15 at black condensed so
    // the two notches keep some light.
    const vx = bw / 2, vy = [0, 0, 0.15, 0.05][m], hx = slantW(td, vx, 0, 1 - vy);
    c.push(rect(0, 0, sv, 1), rect(bw - sv, 0, bw, 1));
    c.push([0, 1, hx, 1, vx + hx / 2, vy, vx - hx / 2, vy]);
    c.push([bw, 1, bw - hx, 1, vx - hx / 2, vy, vx + hx / 2, vy]);
  } else if (ch === "A") {
    // Flat apex ft wide; the bar drops as the weight rises so the counter
    // above it is the last thing to close.
    const ft = [0.05, 0.06, 0.12, 0.16][m], yb = [0.27, 0.27, 0.12, 0.2][m];
    const dx = bw / 2 - ft / 2, hx = slantW(td, dx, 0, 1);
    c.push([0, 0, hx, 0, dx + hx, 1, dx, 1]);
    c.push([bw, 0, bw - hx, 0, bw - dx - hx, 1, bw - dx, 1]);
    const yt = yb + sh * 0.9;
    c.push(rect(dx * yt, yb, bw - dx * yt, yt));
  } else if (ch === "S") {
    // Two rings of superellipses, the upper a little narrower, meeting in the
    // spine at y = 0.53, with the terminals cut at a0 degrees.
    const mid = 0.53, a0 = [34, 30, 44, 38][m], ex = [2.2, 2.3, 2.7, 2.8][m];
    const ryU = (1 - mid + sh / 2) / 2, ryL = (mid + sh / 2) / 2, rxU = bw * 0.47, rxL = bw * 0.5;
    c.push(ring(bw / 2, 1 - ryU, rxU, ryU, rxU - sv, ryU - sh, a0, 270, 16, ex));
    c.push(ring(bw / 2, ryL, rxL, ryL, rxL - sv, ryL - sh, 90, a0 - 180, 16, ex));
  } else if (ch === "T") {
    c.push(rect(0, 1 - sh, bw, 1), rect(bw / 2 - sv / 2, 0, bw / 2 + sv / 2, 1));
  } else if (ch === "E") {
    const mE = 0.52;
    c.push(rect(0, 0, sv, 1), rect(0, 1 - sh, bw, 1), rect(0, 0, bw, sh), rect(0, mE - sh / 2, bw * 0.88, mE + sh / 2));
  } else if (ch === "R") {
    const yl = [0.44, 0.44, 0.4, 0.41][m], bowlR = bw * [0.93, 0.9, 0.94, 0.92][m];
    const bx = sv + 0.4 * (bowlR - 2 * sv), rxo = bowlR - bx, ryo = (1 - yl) / 2, ex = [2.2, 2.3, 2.7, 2.8][m];
    c.push(rect(0, 0, sv, 1), rect(0, 1 - sh, bx, 1), rect(0, yl, bx, yl + sh));
    c.push(ring(bx, yl + ryo, rxo, ryo, rxo - sv, ryo - sh, 90, -90, 14, ex));
    const top = yl + sh, lx = bx - 0.3 * td, hx = slantW(td, bw - lx, 1, top);
    c.push([lx, top, lx + hx, top, bw, 0, bw - hx, 0]);
  }
  // Every contour counter-clockwise (y up), so overlapping pieces add.
  for (const p of c) {
    let a = 0;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length;
      a += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    if (a < 0) for (let i = 0, j = p.length - 2; i < j; i += 2, j -= 2) [p[i], p[i + 1], p[j], p[j + 1]] = [p[j], p[j + 1], p[i], p[i + 1]];
  }
  const sb = SB[m];
  return { pts: c.map((p) => Float32Array.from(p)), bw, l: sb * SIDE[ch][0], r: sb * SIDE[ch][1] };
}

const GLYPH = {};
for (const ch of "MASTER") {
  const ms = [0, 1, 2, 3].map((m) => design(ch, m));
  // Same contours, same point counts, in all four masters.
  for (const g of ms) {
    if (g.pts.length !== ms[0].pts.length) throw new Error("Multiple Master: contour count differs in " + ch);
    g.pts.forEach((p, i) => {
      if (p.length !== ms[0].pts[i].length) throw new Error("Multiple Master: point count differs in " + ch);
    });
  }
  GLYPH[ch] = ms;
}
const LINES = ["MAS", "TER"];

// ---- Size. The widest line at any master, with the full slant added, sets
// the cap height: MAS at black extended is 2.65 caps of ink, plus 0.14 of
// lean, so 62 LEDs hold a cap height of 22.
const SLANT = 0.14;
function inkWidth(line, m) {
  let a = 0;
  for (const ch of line) a += GLYPH[ch][m].l + GLYPH[ch][m].bw + GLYPH[ch][m].r;
  return a - GLYPH[line[0]][m].l - GLYPH[line[line.length - 1]][m].r;
}
let widest = 0;
for (const line of LINES) for (let m = 0; m < 4; m++) widest = max(widest, inkWidth(line, m));
const CAP = floor(62 / (widest + SLANT));
const BASE = [5 + CAP, 14 + 2 * CAP];

// ---- The design-space square: width across, weight down, corners at
// (SQ_X0, SQ_Y0) and (SQ_X0 + SQ, SQ_Y0 + SQ); the master glyphs sit
// outside each corner, 11 LEDs high.
const SQ = 32, SQ_X0 = 16, SQ_Y0 = BASE[1] + 21, MCAP = 11;
// A 3 by 5 pixel font for the four letters of the axis names.
const TINY = {
  W: ["#.#", "#.#", "###", "###", "#.#"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  G: [".##", "#..", "#.#", "#.#", ".##"],
};
for (const k in TINY) TINY[k] = TINY[k].join("");

// ---- Fill with anti-aliased coverage. Five sub-rows a row; on each, the
// crossings with every edge are sorted and walked with the nonzero rule,
// and each span adds its exact horizontal overlap with every LED.
const SUB = 5, EDGE = new Float32Array(5 * 1200), XS = new Float32Array(256), DS = new Int8Array(256), ROW = new Float32Array(W);
function fill(cov, polys, wgt) {
  let ne = 0, ylo = 1e9, yhi = -1e9;
  for (const p of polys)
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length, y0 = p[i + 1], y1 = p[j + 1];
      if (y0 === y1) continue;
      const o = ne * 5;
      EDGE[o] = p[i], EDGE[o + 1] = y0, EDGE[o + 2] = p[j], EDGE[o + 3] = y1, EDGE[o + 4] = y1 > y0 ? 1 : -1;
      ne++;
      ylo = min(ylo, y0, y1), yhi = max(yhi, y0, y1);
    }
  const r0 = max(0, floor(ylo)), r1 = min(H - 1, ceil(yhi));
  for (let r = r0; r <= r1; r++) {
    ROW.fill(0);
    for (let s = 0; s < SUB; s++) {
      const ys = r + (s + 0.5) / SUB;
      let n = 0;
      for (let e = 0; e < ne; e++) {
        const o = e * 5, y0 = EDGE[o + 1], y1 = EDGE[o + 3];
        if (y0 < y1 ? ys < y0 || ys >= y1 : ys < y1 || ys >= y0) continue;
        const x = EDGE[o] + ((ys - y0) * (EDGE[o + 2] - EDGE[o])) / (y1 - y0);
        let k = n++;
        while (k > 0 && XS[k - 1] > x) (XS[k] = XS[k - 1]), (DS[k] = DS[k - 1]), k--;
        XS[k] = x, DS[k] = EDGE[o + 4];
      }
      let wind = 0, xa = 0;
      for (let k = 0; k < n; k++) {
        const was = wind;
        wind += DS[k];
        if (was === 0 && wind !== 0) xa = XS[k];
        else if (was !== 0 && wind === 0) span(xa, XS[k]);
      }
    }
    const o = r * W;
    for (let x = 0; x < W; x++) if (ROW[x] > 0) cov[o + x] = min(1, cov[o + x] + (ROW[x] / SUB) * wgt);
  }
}
function span(a, b) {
  a = max(0, a), b = min(W, b);
  if (b <= a) return;
  const ia = floor(a), ib = floor(b);
  if (ia === ib) return void (ROW[ia] += b - a);
  ROW[ia] += ia + 1 - a;
  for (let i = ia + 1; i < ib; i++) ROW[i] += 1;
  if (ib < W) ROW[ib] += b - ib;
}

// One glyph at the blend c (four master weights) into panel polygons: x0 is
// the left of its body, base the base line, cap the cap height in LEDs.
function place(ch, c, x0, base, cap, lean, out) {
  const g = GLYPH[ch];
  for (let k = 0; k < g[0].pts.length; k++) {
    const a = g[0].pts[k], b = g[1].pts[k], d = g[2].pts[k], e = g[3].pts[k];
    const p = new Float32Array(a.length);
    for (let i = 0; i < a.length; i += 2) {
      const x = c[0] * a[i] + c[1] * b[i] + c[2] * d[i] + c[3] * e[i];
      const y = c[0] * a[i + 1] + c[1] * b[i + 1] + c[2] * d[i + 1] + c[3] * e[i + 1];
      p[i] = x0 + (x + lean * (y - 0.5)) * cap;
      p[i + 1] = base - y * cap;
    }
    out.push(p);
  }
}
const mix = (c, ch, key) => c[0] * GLYPH[ch][0][key] + c[1] * GLYPH[ch][1][key] + c[2] * GLYPH[ch][2][key] + c[3] * GLYPH[ch][3][key];

export function setup(params) {
  params.s = {
    ph: 2.1, lc: 0, u: 0.5, v: 0.5, u0: 0.5, v0: 0.5, hue: 0, lean: 0, leanT: 0,
    trail: [], word: new Float32Array(N), map: new Float32Array(N), rgb: new Float32Array(N * 3),
  };
}

// Reflect into the square, so the wander folds back at an edge.
const fold = (x) => cl(x < 0 ? -x : x > 1 ? 2 - x : x, 0, 1);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3);
  S.u0 = (cl(k[2], -1, 1) + 1) / 2;
  S.v0 = (cl(k[3], -1, 1) + 1) / 2;
  if (input.btnPressed && input.btnPressed[2]) S.leanT = 1 - S.leanT;
  S.lean += cl(S.leanT - S.lean, -d * 2, d * 2);
  // The wander: two sines an axis at unrelated rates, 0.24 of the square at
  // most each way, so it never closes into a figure. 0.42 rad/s a unit of
  // Speed: the slowest term comes round in 14 s at 2.
  S.ph += d * speed * 0.42;
  const A = 0.24, p = S.ph;
  S.u = fold(S.u0 + A * (0.62 * sin(0.71 * p + 0.3) + 0.38 * sin(1.37 * p + 2.1)));
  S.v = fold(S.v0 + A * (0.62 * sin(0.53 * p + 1.7) + 0.38 * sin(1.19 * p + 0.6)));
  S.trail.push(S.u, S.v);
  if (S.trail.length > 72) S.trail.splice(0, 2);
  S.lc += (d * speed) / 6;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { word, map, rgb } = S, u = S.u, v = S.v;
  const c = [(1 - u) * (1 - v), (1 - u) * v, u * (1 - v), u * v];
  const lean = SLANT * ss(0, 1, S.lean);
  const hue = 0.54 + S.hue;
  const ink = hsv(hue, 0.4, 1), guide = hsv(hue, 0.7, 0.17), blue = hsv(hue + 0.06, 0.62, 1), gold = hsv(hue + 0.58, 0.68, 1);
  const li = floor(S.lc) % 6, lf = S.lc - floor(S.lc), fresh = ss(0, 0.08, lf);
  const letter = "MASTER"[li], before = "MASTER"[(li + 5) % 6];

  // ---- The instance: two lines, centred on their ink.
  word.fill(0);
  const ticks = [];
  for (let L = 0; L < 2; L++) {
    const line = LINES[L], polys = [];
    let ink0 = 0;
    for (const ch of line) ink0 += mix(c, ch, "l") + mix(c, ch, "bw") + mix(c, ch, "r");
    ink0 -= mix(c, line[0], "l") + mix(c, line[2], "r");
    let x = (W - ink0 * CAP) / 2 - mix(c, line[0], "l") * CAP;
    ticks.push([L, x]);
    for (let i = 0; i < 3; i++) {
      const ch = line[i], l = mix(c, ch, "l"), bw = mix(c, ch, "bw"), r = mix(c, ch, "r");
      place(ch, c, x + l * CAP, BASE[L], CAP, lean, polys);
      if (L * 3 + i === li) ticks.push([L, x + (l + bw / 2) * CAP, 1]);
      x += (l + bw + r) * CAP;
      ticks.push([L, x]);
    }
    fill(word, polys, 1);
  }

  // ---- The masters of one letter at the four corners, the incoming letter
  // fading over the first 0.24 s at Speed 2.
  map.fill(0);
  const corner = (ch, wgt) => {
    for (let m = 0; m < 4; m++) {
      const g = GLYPH[ch][m], cm = [0, 0, 0, 0];
      cm[m] = 1;
      const right = m & 1, low = m >> 1, polys = [];
      const x0 = right ? SQ_X0 + SQ + 3 : SQ_X0 - 3 - g.bw * MCAP;
      const base = low ? SQ_Y0 + SQ + 3 + MCAP : SQ_Y0 - 3;
      place(ch, cm, x0, base, MCAP, lean, polys);
      fill(map, polys, wgt * (0.5 + 0.5 * c[m]));
    }
  };
  corner(letter, fresh);
  if (fresh < 1) corner(before, 1 - fresh);

  rgb.fill(0);
  const add = (x, y, col, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], col[0] * a), rgb[o + 1] = max(rgb[o + 1], col[1] * a), rgb[o + 2] = max(rgb[o + 2], col[2] * a);
  };
  // Cap line and base line of each line of type.
  for (let L = 0; L < 2; L++)
    for (let x = 0; x < W; x++) {
      add(x, BASE[L], guide, 1);
      add(x, BASE[L] - CAP - 1, guide, 1);
    }
  // Side-bearing ticks under the base line, and a gold dot under the letter
  // the corners show.
  for (const [L, x, mark] of ticks) {
    const xi = round(x - 0.5), y = BASE[L] + 2;
    if (mark) {
      add(xi, y + 1, gold, 1), add(xi + 1, y + 1, gold, 1), add(xi, y + 2, gold, 0.5), add(xi + 1, y + 2, gold, 0.5);
    } else for (let j = 0; j < 3; j++) add(xi, y + j, blue, 0.32);
  }
  // The square, its quarter lines, and pale lines from the instance to each
  // master, as bright as that master's share of the blend.
  for (let i = 0; i <= SQ; i++)
    for (const q of [0, 1, 2, 3, 4]) {
      const a = q === 0 || q === 4 ? 0.42 : 0.13;
      add(SQ_X0 + i, SQ_Y0 + (q * SQ) / 4, blue, a);
      add(SQ_X0 + (q * SQ) / 4, SQ_Y0 + i, blue, a);
    }
  // Axis names as the OpenType variation tags spell them: wdth across the
  // top, wght down the left side.
  const label = (s, x, y, dx, dy) => {
    for (let i = 0; i < s.length; i++)
      for (let b = 0; b < 15; b++) if (TINY[s[i]][b] === "#") add(x + i * dx + (b % 3), y + i * dy + floor(b / 3), blue, 0.5);
  };
  label("WDTH", SQ_X0 + SQ / 2 - 7, SQ_Y0 - 7, 4, 0);
  label("WGHT", SQ_X0 - 9, SQ_Y0 + SQ / 2 - 11, 0, 6);
  const px = SQ_X0 + v * SQ, py = SQ_Y0 + u * SQ;
  for (let m = 0; m < 4; m++) {
    const cx = SQ_X0 + (m & 1) * SQ, cy = SQ_Y0 + (m >> 1) * SQ, n = ceil(max(abs(cx - px), abs(cy - py)));
    for (let i = 1; i < n; i++) add(round(px + ((cx - px) * i) / n), round(py + ((cy - py) * i) / n), gold, 0.08 + 0.25 * c[m]);
  }
  // The knob point: a small cross.
  const kx = round(SQ_X0 + S.v0 * SQ), ky = round(SQ_Y0 + S.u0 * SQ);
  for (let j = -2; j <= 2; j++) if (j) add(kx + j, ky, gold, 0.4), add(kx, ky + j, gold, 0.4);
  // Trail, oldest dimmest, then the instance itself.
  const T = S.trail, nt = T.length / 2;
  for (let i = 0; i < nt; i++) add(round(SQ_X0 + T[i * 2 + 1] * SQ), round(SQ_Y0 + T[i * 2] * SQ), gold, 0.1 + 0.5 * (i / nt));
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const dx = round(px) + i + 0.5 - px, dy = round(py) + j + 0.5 - py;
      add(round(px) + i, round(py) + j, gold, cl(1.25 - 0.55 * sqrt(dx * dx + dy * dy), 0, 1));
    }

  // ---- Ink over everything.
  for (let p = 0; p < N; p++) {
    const o = p * 3, a = word[p], b = map[p];
    if (a > 0) for (let q = 0; q < 3; q++) rgb[o + q] = rgb[o + q] * (1 - a) + ink[q] * a;
    if (b > 0) for (let q = 0; q < 3; q++) rgb[o + q] = max(rgb[o + q], ink[q] * b);
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, round(min(1, rgb[p * 3]) * 255), round(min(1, rgb[p * 3 + 1]) * 255), round(min(1, rgb[p * 3 + 2]) * 255));
}
