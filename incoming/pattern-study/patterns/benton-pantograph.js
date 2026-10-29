// ===== Patternflow pattern =====
// Title:   Benton Pantograph
// Family:  type
// Idea:    A stylus runs round the outline of a large pattern letter while a pantograph's bars carry its motion down to a cutter that engraves the same letter at a quarter of the size on a steel blank, slanted and condensed or extended by the knobs past what the plain pantograph would give, and the finished punches of BENTON, PUNCH, MATRIX and FAMILY stand in rows below.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Benton pantograph punch-cutter (Linn Boyd Benton, 1885), the pantograph (Christoph Scheiner, 1603), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slant=0..0.45, Width=-1..1
//
// Knob 1: Hue. Turns the brass of the pattern and the punches round the wheel together with the steel blue of the bars; at 0 the pattern is brass and the cut metal pale gold.
// Knob 2: Speed. At 2 the stylus runs 30 units a second round the outline (the cap height is 14 units), about 94 LEDs of the pattern, so tracing a B takes 3.0 s, BENTON 25.8 s and all four words 94 s; 0.2 is a tenth as fast, 3 half as fast again.
// Knob 3: Slant. Leans the cut letter by this much of its height: 0 is upright, 0.45 leans the top 24 degrees to the right. The pattern stays upright; only the letter being cut and the punches cut after the turn take it.
// Knob 4: Width. Condenses or extends the cut letter: -1 is 55% of the pattern's width, 0 as drawn, 1 is 145%. The punches in the rows keep the width they were cut at.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, sqrt, abs, sin, cos } = Math;
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

// ---- The pattern letters, a heavy gothic drawn as outlines: cap height 14
// units, stems 3, y down from the cap line, x from the left side bearing.
// Each glyph is [width, contour, hole, ...]; filled even-odd.
const GLYPH = {
  B: [10.5, [0, 0, 7.8, 0, 10, 2, 10, 5.2, 8.7, 6.6, 10.5, 8.2, 10.5, 12, 8.5, 14, 0, 14], [3, 2.8, 6.8, 2.8, 7.2, 3.3, 7.2, 5, 6.8, 5.5, 3, 5.5], [3, 8.3, 7.2, 8.3, 7.6, 8.8, 7.6, 10.7, 7.2, 11.2, 3, 11.2]],
  E: [9.5, [0, 0, 9.5, 0, 9.5, 2.8, 3, 2.8, 3, 5.6, 8.2, 5.6, 8.2, 8.4, 3, 8.4, 3, 11.2, 9.5, 11.2, 9.5, 14, 0, 14]],
  N: [11, [0, 0, 3.2, 0, 8, 8.6, 8, 0, 11, 0, 11, 14, 7.8, 14, 3, 5.4, 3, 14, 0, 14]],
  T: [11, [0, 0, 11, 0, 11, 2.8, 7, 2.8, 7, 14, 4, 14, 4, 2.8, 0, 2.8]],
  O: [11.5, [3.2, 0, 8.3, 0, 11.5, 3.2, 11.5, 10.8, 8.3, 14, 3.2, 14, 0, 10.8, 0, 3.2], [4.3, 2.8, 7.2, 2.8, 8.5, 4.1, 8.5, 9.9, 7.2, 11.2, 4.3, 11.2, 3, 9.9, 3, 4.1]],
  P: [10.3, [0, 0, 7.8, 0, 10.3, 2.4, 10.3, 6.4, 7.8, 8.8, 3, 8.8, 3, 14, 0, 14], [3, 2.8, 6.9, 2.8, 7.4, 3.3, 7.4, 5.5, 6.9, 6, 3, 6]],
  U: [11, [0, 0, 3, 0, 3, 10.3, 3.9, 11.2, 7.1, 11.2, 8, 10.3, 8, 0, 11, 0, 11, 11, 8, 14, 3, 14, 0, 11]],
  C: [11, [3.2, 0, 8, 0, 11, 3, 11, 4.6, 8, 4.6, 8, 4.1, 6.7, 2.8, 4.3, 2.8, 3, 4.1, 3, 9.9, 4.3, 11.2, 6.7, 11.2, 8, 9.9, 8, 9.4, 11, 9.4, 11, 11, 8, 14, 3.2, 14, 0, 10.8, 0, 3.2]],
  H: [11, [0, 0, 3, 0, 3, 5.6, 8, 5.6, 8, 0, 11, 0, 11, 14, 8, 14, 8, 8.4, 3, 8.4, 3, 14, 0, 14]],
  M: [13, [0, 0, 3.6, 0, 6.5, 7.5, 9.4, 0, 13, 0, 13, 14, 10, 14, 10, 5.5, 7.8, 11.5, 5.2, 11.5, 3, 5.5, 3, 14, 0, 14]],
  A: [12, [4, 0, 8, 0, 12, 14, 8.9, 14, 8.1, 11, 3.9, 11, 3.1, 14, 0, 14], [4.6, 8.4, 7.4, 8.4, 6.2, 3.8, 5.8, 3.8]],
  R: [10.8, [0, 0, 7.8, 0, 10.3, 2.4, 10.3, 6.2, 8.4, 8.2, 10.8, 14, 7.6, 14, 5.6, 8.8, 3, 8.8, 3, 14, 0, 14], [3, 2.8, 6.9, 2.8, 7.4, 3.3, 7.4, 5.5, 6.9, 6, 3, 6]],
  I: [3, [0, 0, 3, 0, 3, 14, 0, 14]],
  X: [12, [0, 0, 3.4, 0, 6, 4.6, 8.6, 0, 12, 0, 7.8, 7, 12, 14, 8.6, 14, 6, 9.4, 3.4, 14, 0, 14, 4.2, 7]],
  F: [9.5, [0, 0, 9.5, 0, 9.5, 2.8, 3, 2.8, 3, 5.8, 8.2, 5.8, 8.2, 8.6, 3, 8.6, 3, 14, 0, 14]],
  L: [9, [0, 0, 3, 0, 3, 11.2, 9, 11.2, 9, 14, 0, 14]],
  Y: [12, [0, 0, 3.4, 0, 6, 5.2, 8.6, 0, 12, 0, 7.5, 8.6, 7.5, 14, 4.5, 14, 4.5, 8.6]],
};
// Arc length along each glyph's contours, for the stylus.
const PATH = {};
for (const ch in GLYPH) {
  const cs = GLYPH[ch].slice(1), out = [];
  let total = 0;
  for (const c of cs) {
    const n = c.length / 2, cum = [0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      cum.push(cum[i] + sqrt((c[2 * j] - c[2 * i]) ** 2 + (c[2 * j + 1] - c[2 * i + 1]) ** 2));
    }
    out.push({ c, n, cum, len: cum[n] });
    total += cum[n];
  }
  PATH[ch] = { cs: out, total };
}
function along(ch, d) {
  // The point at distance d along contour after contour.
  for (const k of PATH[ch].cs) {
    if (d <= k.len) {
      let i = 0;
      while (i < k.n - 1 && k.cum[i + 1] < d) i++;
      const j = (i + 1) % k.n, f = (d - k.cum[i]) / max(1e-6, k.cum[i + 1] - k.cum[i]);
      return [k.c[2 * i] + (k.c[2 * j] - k.c[2 * i]) * f, k.c[2 * i + 1] + (k.c[2 * j + 1] - k.c[2 * i + 1]) * f];
    }
    d -= k.len;
  }
  const k = PATH[ch].cs[PATH[ch].cs.length - 1];
  return [k.c[0], k.c[1]];
}

// ---- The machine. The pattern's cap line at y = 5 and baseline at 49, so
// a unit is 44/14 = 3.14 LEDs, centred on x = 36. The fixed pivot O at
// (4, 90). Bars O-J of 52 and J-T of 50 LEDs, elbow to the right: over the
// whole pattern J stays inside x 31..56, y 46..101. Collars at A on O-J and
// D on J-T, a share s from O and from J, carry the links that meet at
// P = O + s (T - O), the plain pantograph's point: a copy s times the size,
// scaled about O, upright and as wide as drawn. Benton's machine added the
// motions that condense, extend and slant; here they are a stage between P
// and the cutter C, about the copy's baseline origin.
const PS = 44 / 14, PY = 5, PCX = 36, OX = 4, OY = 90, L1 = 52, L2 = 50;
const WORDS = ["BENTON", "PUNCH", "MATRIX", "FAMILY"];
// Each word cut at its own ratio, so the collars slide between words: cap
// heights 11.4, 9.7, 13.2 and 10.6 LEDs.
const RATIO = [0.26, 0.22, 0.3, 0.24];
const V = 30, SLIDE = 0.5, LIFT = 0.25, ROUT = 0.45, XFER = 0.6, HOLD = 1, SHIFT = 0.8;
// The rows of finished punches: the last word above, baselines 112 and 126.
const ROWY = [112, 126];

// ---- The timeline, in seconds at Speed 2: per letter the pattern slides
// in, the stylus traces, the cutter clears round the letter, and the punch
// goes to its row; per word a hold and the rows moving up.
const SEG = [];
let TOTAL = 0;
WORDS.forEach((w, wi) => {
  for (let li = 0; li < w.length; li++) {
    const ch = w[li], tr = PATH[ch].total / V + LIFT * (PATH[ch].cs.length - 1);
    for (const [st, d] of [["slide", SLIDE], ["trace", tr], ["rout", ROUT], ["xfer", XFER]]) {
      SEG.push({ wi, li, st, t0: TOTAL, d });
      TOTAL += d;
    }
  }
  SEG.push({ wi, li: w.length, st: "hold", t0: TOTAL, d: HOLD });
  TOTAL += HOLD;
  SEG.push({ wi, li: w.length, st: "shift", t0: TOTAL, d: SHIFT });
  TOTAL += SHIFT;
});
// A fresh start comes in as the O of BENTON slides in, with B, E, N and T
// in the lower row and FAMILY above, all cut at the knobs as they are.
const START = (() => {
  const g = SEG.find((s) => s.wi === 0 && s.li === 4 && s.st === "slide");
  return g.t0 + 0.2 * g.d;
})();

function elbow(tx, ty) {
  const dx = tx - OX, dy = ty - OY, d = sqrt(dx * dx + dy * dy);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = sqrt(max(0, L1 * L1 - a * a));
  const ux = dx / d, uy = dy / d;
  return [OX + a * ux - uy * h, OY + a * uy + ux * h];
}

export function setup(params) {
  params.s = {
    tau: START, hue: 0, speed: 2, slant: 0, width: 1, dt: 0,
    rec: {}, cov: new Float32Array(NP), rgb: new Float32Array(NP * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.slant = cl(k[2], 0, 0.45);
  S.width = 1 + 0.45 * cl(k[3], -1, 1);
  S.tau += (d * S.speed) / 2;
  S.dt = d;
  // A punch keeps the slant and width it was cut at, from the moment the
  // cutter has cleared round it.
  const g = seg(S.tau);
  if (g.st === "xfer") S.rec[g.wi + "," + g.li] = [S.slant, S.width];
}

function seg(tau) {
  const t = ((tau % TOTAL) + TOTAL) % TOTAL;
  let lo = 0, hi = SEG.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (SEG[m].t0 <= t) lo = m;
    else hi = m - 1;
  }
  const g = SEG[lo];
  return { ...g, e: cl((t - g.t0) / g.d, 0, 1), loc: t - g.t0 };
}

// ---- Drawing helpers.
function add(rgb, p, c, v) {
  rgb[p * 3] += c[0] * v, rgb[p * 3 + 1] += c[1] * v, rgb[p * 3 + 2] += c[2] * v;
}
// A line, sampled every half LED and spread over the four nearest LEDs.
function line(rgb, x0, y0, x1, y1, c, v) {
  const n = max(1, ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 2));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n - 0.5, y = y0 + ((y1 - y0) * i) / n - 0.5;
    const ix = floor(x), iy = floor(y), ax = x - ix, ay = y - iy, a = v / 2;
    if (iy >= 0 && iy < H) {
      if (ix >= 0 && ix < W) add(rgb, iy * W + ix, c, a * (1 - ax) * (1 - ay));
      if (ix + 1 >= 0 && ix + 1 < W) add(rgb, iy * W + ix + 1, c, a * ax * (1 - ay));
    }
    if (iy + 1 >= 0 && iy + 1 < H) {
      if (ix >= 0 && ix < W) add(rgb, (iy + 1) * W + ix, c, a * (1 - ax) * ay);
      if (ix + 1 >= 0 && ix + 1 < W) add(rgb, (iy + 1) * W + ix + 1, c, a * ax * ay);
    }
  }
}
function dot(rgb, x, y, r, c, v) {
  for (let j = max(0, floor(y - r - 1)); j <= min(H - 1, floor(y + r + 1)); j++)
    for (let i = max(0, floor(x - r - 1)); i <= min(W - 1, floor(x + r + 1)); i++) {
      const d = sqrt((i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2), a = cl(r + 0.5 - d, 0, 1);
      if (a > 0) add(rgb, j * W + i, c, v * a);
    }
}
// A glyph placed by its baseline origin (ox, oy), unit size u, width w and
// slant k: unit point (x, y) goes to (ox + u (w x + k (14 - y)), oy - u (14 - y)).
const place = (x, y, ox, oy, u, w, k) => [ox + u * (w * x + k * (14 - y)), oy - u * (14 - y)];
function contours(ch, ox, oy, u, w, k) {
  return GLYPH[ch].slice(1).map((c) => {
    const o = [];
    for (let i = 0; i < c.length; i += 2) o.push(...place(c[i], c[i + 1], ox, oy, u, w, k));
    return o;
  });
}
// Even-odd coverage of a set of contours, four sub-rows a row and exact
// along each sub-row. Returns the box it wrote, cleared first.
function fill(cov, cs) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const c of cs)
    for (let i = 0; i < c.length; i += 2) (x0 = min(x0, c[i])), (x1 = max(x1, c[i])), (y0 = min(y0, c[i + 1])), (y1 = max(y1, c[i + 1]));
  const bx0 = max(0, floor(x0)), bx1 = min(W - 1, floor(x1)), by0 = max(0, floor(y0)), by1 = min(H - 1, floor(y1));
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) cov[y * W + x] = 0;
  const xs = [];
  for (let y = by0; y <= by1; y++)
    for (let sub = 0; sub < 4; sub++) {
      const ys = y + (sub + 0.5) / 4;
      xs.length = 0;
      for (const c of cs) {
        const n = c.length / 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, ya = c[2 * i + 1], yb = c[2 * j + 1];
          if ((ya <= ys && yb > ys) || (yb <= ys && ya > ys)) xs.push(c[2 * i] + ((ys - ya) * (c[2 * j] - c[2 * i])) / (yb - ya));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = max(xs[i], bx0), b = min(xs[i + 1], bx1 + 1);
        for (let x = floor(a); x < b && x <= bx1; x++) cov[y * W + x] += (min(x + 1, b) - max(x, a)) / 4;
      }
    }
  return [bx0, bx1, by0, by1];
}
// Fills that stay put from frame to frame (the pattern at rest, punches in
// their rows, the face being cleared) are kept by key and copied back.
const CACHE = new Map();
function fillK(cov, key, cs) {
  const hit = CACHE.get(key);
  if (hit) {
    const [x0, x1, y0, y1] = hit.r;
    let i = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cov[y * W + x] = hit.v[i++];
    return hit.r;
  }
  const r = fill(cov, cs), v = new Float32Array(max(0, (r[1] - r[0] + 1) * (r[3] - r[2] + 1)));
  let i = 0;
  for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) v[i++] = cov[y * W + x];
  if (CACHE.size > 96) CACHE.clear();
  CACHE.set(key, { r, v });
  return r;
}
function outline(rgb, cs, c, v) {
  for (const k of cs) {
    const n = k.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      line(rgb, k[2 * i], k[2 * i + 1], k[2 * j], k[2 * j + 1], c, v);
    }
  }
}
// The box a placed glyph needs, with a margin of m LEDs.
function box(ch, ox, oy, u, w, k, m) {
  const gw = GLYPH[ch][0];
  return [ox - m, ox + u * (w * gw + k * 14) + m, oy - u * 14 - m, oy + m];
}
// A punch: a steel blank with the letter's face standing bright on it.
function punch(S, ch, ox, oy, u, w, k, a, steel, face, still) {
  const rgb = S.rgb, b = box(ch, ox, oy, u, w, k, 1.2);
  for (let y = max(0, floor(b[2])); y <= min(H - 1, floor(b[3])); y++)
    for (let x = max(0, floor(b[0])); x <= min(W - 1, floor(b[1])); x++) {
      const edge = x === floor(b[0]) || y === floor(b[2]) ? 1.35 : x === floor(b[1]) || y === floor(b[3]) ? 0.6 : 1;
      add(rgb, y * W + x, steel, 30 * edge * a);
    }
  const key = still ? [ch, ox, oy, u, w, k].map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join() : null;
  const cs = contours(ch, ox, oy, u, w, k), r = key ? fillK(S.cov, key, cs) : fill(S.cov, cs);
  for (let y = r[2]; y <= r[3]; y++)
    for (let x = r[0]; x <= r[1]; x++) {
      const v = min(1, S.cov[y * W + x]);
      if (v > 0) add(rgb, y * W + x, face, 200 * v * a);
    }
}

// Where a word's punches stand in a row: unit size and each origin, the
// blanks 1 LED apart and the row at most 62 LEDs.
function rowLayout(S, wi) {
  const w = WORDS[wi], u0 = RATIO[wi] * PS;
  const kw = [];
  let sum = 0;
  for (let i = 0; i < w.length; i++) {
    const r = S.rec[wi + "," + i] || [S.slant, S.width];
    kw.push(r);
    sum += r[1] * GLYPH[w[i]][0] + r[0] * 14;
  }
  const u = min(u0, (62 - 3.4 * w.length + 1) / sum);
  let x = (W - (u * sum + 3.4 * w.length - 1)) / 2 + 1.2;
  const o = [];
  for (let i = 0; i < w.length; i++) {
    o.push([x, kw[i][0], kw[i][1]]);
    x += u * (kw[i][1] * GLYPH[w[i]][0] + kw[i][0] * 14) + 3.4;
  }
  return { u, o };
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb;
  rgb.fill(0);
  const g = seg(S.tau), wi = g.wi, word = WORDS[wi];
  const brass = hsv(0.115 + S.hue, 0.62, 1), hot = hsv(0.13 + S.hue, 0.22, 1), steel = hsv(0.6 + S.hue, 0.28, 1), dim = hsv(0.62 + S.hue, 0.5, 1);
  const prevW = (wi + WORDS.length - 1) % WORDS.length;

  // The ratio of the word being cut; the collars slide to the next one
  // while the rows move up.
  const nextR = RATIO[(wi + 1) % WORDS.length];
  const s = g.st === "shift" ? RATIO[wi] + (nextR - RATIO[wi]) * ss(0, 1, g.e) : RATIO[wi];

  // ---- The pattern: cap line and baseline, the letter filled dim with its
  // outline, the part the stylus has passed bright.
  for (const y of [PY - 1, PY + 44])
    for (let x = 0; x < W; x++) add(rgb, y * W + x, dim, x % 4 < 2 ? 22 : 10);
  const li = min(g.li, word.length - 1), ch = word[li], gw = GLYPH[ch][0];
  let off = 0;
  if (g.st === "slide") off = 46 * (1 - ss(0, 1, g.e));
  else if (g.st === "xfer") off = -50 * ss(0, 1, g.e);
  const showPattern = g.st !== "hold" && g.st !== "shift";
  const pox = PCX - (gw * PS) / 2 + off, poy = PY + 44;
  const P = (x, y) => place(x, y, pox, poy, PS, 1, 0);
  let done = 0;
  if (g.st === "trace") done = g.loc * V - 0;
  else if (g.st === "rout" || g.st === "xfer") done = 1e9;
  if (showPattern) {
    const cs = contours(ch, pox, poy, PS, 1, 0);
    const r = off === 0 ? fillK(S.cov, "P" + ch, cs) : fill(S.cov, cs);
    for (let y = r[2]; y <= r[3]; y++)
      for (let x = r[0]; x <= r[1]; x++) {
        const v = min(1, S.cov[y * W + x]);
        if (v > 0) add(rgb, y * W + x, brass, 62 * v);
      }
    outline(rgb, cs, brass, 120);
    // Traced so far: the distance along the outline, less the lifts.
    if (done > 0) {
      let left = g.st === "trace" ? 0 : 1e9;
      if (g.st === "trace") {
        let t = g.loc;
        for (const k of PATH[ch].cs) {
          const need = k.len / V;
          if (t <= need) {
            left += t * V;
            break;
          }
          left += k.len;
          t -= need + LIFT;
          if (t < 0) break;
        }
      }
      let acc = 0;
      for (const k of PATH[ch].cs) {
        for (let i = 0; i < k.n; i++) {
          const a = k.cum[i], b = k.cum[i + 1];
          if (acc + a >= left) break;
          const j = (i + 1) % k.n, f = min(1, (left - acc - a) / max(1e-6, b - a));
          const p0 = P(k.c[2 * i], k.c[2 * i + 1]), p1 = P(k.c[2 * j], k.c[2 * j + 1]);
          line(rgb, p0[0], p0[1], p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, hot, 150);
        }
        acc += k.len;
      }
      S.left = left;
    }
  }

  // ---- The stylus T over the time of this letter.
  const REST = [60, 30];
  let T = REST, cutting = false;
  const startPt = P(...along(ch, 0));
  if (g.st === "slide") {
    const m = ss(0, 1, g.e);
    T = [REST[0] + (startPt[0] - REST[0]) * m, REST[1] + (startPt[1] - REST[1]) * m];
  } else if (g.st === "trace") {
    let t = g.loc, d = 0, lifted = null;
    for (let c = 0; c < PATH[ch].cs.length; c++) {
      const k = PATH[ch].cs[c], need = k.len / V;
      if (t <= need) {
        d += t * V;
        break;
      }
      d += k.len;
      t -= need;
      if (c + 1 < PATH[ch].cs.length && t <= LIFT) {
        lifted = [P(...along(ch, d - 1e-3)), P(...along(ch, d + 1e-3)), ss(0, 1, t / LIFT)];
        break;
      }
      t -= LIFT;
    }
    if (lifted) T = [lifted[0][0] + (lifted[1][0] - lifted[0][0]) * lifted[2], lifted[0][1] + (lifted[1][1] - lifted[0][1]) * lifted[2]];
    else (T = P(...along(ch, d))), (cutting = true);
  } else if (g.st === "rout") {
    // The cutter clears round the letter in six passes, top to bottom.
    const pass = g.e * 6, i = floor(min(5.999, pass)), f = pass - i;
    const xa = pox - 3, xb = pox + gw * PS + 3, y = PY - 2 + ((i + f) / 6) * 48;
    T = [i % 2 ? xb + (xa - xb) * f : xa + (xb - xa) * f, y];
    cutting = true;
  } else if (g.st === "xfer") {
    // From where the clearing ended, lifted, back to rest.
    const end = [pox - off - 3, PY + 46], m = ss(0, 1, g.e);
    T = [end[0] + (REST[0] - end[0]) * m, end[1] + (REST[1] - end[1]) * m];
  }

  // ---- Linkage geometry.
  const J = elbow(T[0], T[1]);
  const A = [OX + s * (J[0] - OX), OY + s * (J[1] - OY)], D = [J[0] + s * (T[0] - J[0]), J[1] + s * (T[1] - J[1])];
  const Pp = [OX + s * (T[0] - OX), OY + s * (T[1] - OY)];
  // The copy's baseline origin under the plain pantograph, and the stage.
  const bo = [OX + s * (pox - off - OX), OY + s * (poy - OY)], u = s * PS;
  const k = S.slant, w = S.width;
  const stage = (x, y) => [bo[0] + w * (x - bo[0]) + k * (bo[1] - y), y];
  const C = stage(Pp[0], Pp[1]);

  // ---- The copy on its blank: the plain pantograph's copy as a faint
  // ghost, the cut outline so far, then the face as the cutter clears.
  if (g.st === "slide" || g.st === "trace" || g.st === "rout") {
    const fadeIn = g.st === "slide" ? ss(0.3, 1, g.e) : 1;
    const b = box(ch, bo[0], bo[1], u, w, k, 1.5);
    const clearY = g.st === "rout" ? C[1] : g.st === "trace" ? -1 : -1;
    for (let y = max(0, floor(b[2])); y <= min(H - 1, floor(b[3])); y++)
      for (let x = max(0, floor(b[0])); x <= min(W - 1, floor(b[1])); x++) add(rgb, y * W + x, steel, (y + 0.5 < clearY ? 16 : 34) * fadeIn);
    outline(rgb, contours(ch, bo[0], bo[1], u, 1, 0), dim, 42 * fadeIn);
    const cs = contours(ch, bo[0], bo[1], u, w, k);
    if (g.st === "rout") {
      const r = fillK(S.cov, ["F", ch, bo[0], bo[1], u, w, k].map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join(), cs);
      for (let y = r[2]; y <= r[3]; y++)
        for (let x = r[0]; x <= r[1]; x++) {
          const v = min(1, S.cov[y * W + x]) * (y + 0.5 < clearY ? 1 : 0.25);
          if (v > 0) add(rgb, y * W + x, hot, 170 * v);
        }
    }
    if (g.st === "trace" || g.st === "rout") {
      const left = g.st === "rout" ? 1e9 : S.left || 0;
      let acc = 0;
      for (let c = 0; c < PATH[ch].cs.length; c++) {
        const kk = PATH[ch].cs[c], pc = cs[c];
        for (let i = 0; i < kk.n; i++) {
          const a = kk.cum[i], bb = kk.cum[i + 1];
          if (acc + a >= left) break;
          const j = (i + 1) % kk.n, f = min(1, (left - acc - a) / max(1e-6, bb - a));
          line(rgb, pc[2 * i], pc[2 * i + 1], pc[2 * i] + (pc[2 * j] - pc[2 * i]) * f, pc[2 * i + 1] + (pc[2 * j + 1] - pc[2 * i + 1]) * f, hot, 190);
        }
        acc += kk.len;
      }
    }
  }

  // ---- Rows of finished punches. During the shift the upper row rises
  // and fades and the lower row moves up into its place.
  const shift = g.st === "shift" ? ss(0, 1, g.e) : 0;
  {
    const L = rowLayout(S, prevW);
    for (let i = 0; i < WORDS[prevW].length; i++) punch(S, WORDS[prevW][i], L.o[i][0], ROWY[0] - 16 * shift, L.u, L.o[i][2], L.o[i][1], 1 - shift, steel, brass, shift === 0);
  }
  {
    const L = rowLayout(S, wi), n = g.st === "hold" || g.st === "shift" ? word.length : g.li;
    for (let i = 0; i < n; i++) punch(S, word[i], L.o[i][0], ROWY[1] - (ROWY[1] - ROWY[0]) * shift, L.u, L.o[i][2], L.o[i][1], 1, steel, brass, shift === 0);
    if (g.st === "xfer") {
      // The finished punch flies from the cutter to its place in the row.
      const m = ss(0, 1, g.e), r = S.rec[wi + "," + g.li] || [k, w];
      const tx = L.o[g.li][0], ty = ROWY[1];
      const ox = bo[0] + (tx - bo[0]) * m, oy = bo[1] + (ty - bo[1]) * m - 10 * sin(m * Math.PI);
      punch(S, ch, ox, oy, u + (L.u - u) * m, r[1], r[0], 1, steel, brass);
    }
  }

  // ---- Bars, collars, pivot, stylus and cutter.
  const bar = (p, q, v) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = sqrt(dx * dx + dy * dy) || 1, nx = (-dy / l) * 0.45, ny = (dx / l) * 0.45;
    line(rgb, p[0] + nx, p[1] + ny, q[0] + nx, q[1] + ny, steel, v);
    line(rgb, p[0] - nx, p[1] - ny, q[0] - nx, q[1] - ny, steel, v);
  };
  bar([OX, OY], J, 95);
  bar(J, T, 95);
  bar(A, Pp, 75);
  bar(D, Pp, 75);
  dot(rgb, A[0], A[1], 1.2, steel, 150);
  dot(rgb, D[0], D[1], 1.2, steel, 150);
  dot(rgb, J[0], J[1], 1.1, steel, 140);
  // The pivot on its bracket.
  for (let y = OY + 1; y <= OY + 5; y++) {
    const hw = (y - OY) * 0.8;
    for (let x = max(0, floor(OX - hw)); x <= min(W - 1, floor(OX + hw)); x++) add(rgb, y * W + x, steel, 55);
  }
  for (let x = 0; x <= 9; x++) add(rgb, (OY + 6) * W + x, steel, x % 2 ? 90 : 45);
  dot(rgb, OX, OY, 1.4, hot, 210);
  // The stage: P where the plain pantograph would cut, a ring; the link to
  // the cutter C.
  if (abs(C[0] - Pp[0]) > 0.6) line(rgb, Pp[0], Pp[1], C[0], C[1], dim, 120);
  dot(rgb, Pp[0], Pp[1], 1.1, steel, 120);
  dot(rgb, T[0], T[1], 1.2, hot, 230);
  line(rgb, T[0] - 3, T[1], T[0] + 3, T[1], hot, 60);
  line(rgb, T[0], T[1] - 3, T[0], T[1] + 3, hot, 60);
  if (cutting) {
    dot(rgb, C[0], C[1], 0.9, hot, 255);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.283, r = 0.8 + Math.random() * 2.2;
      dot(rgb, C[0] + cos(a) * r, C[1] + sin(a) * r, 0.3, hot, 160 * Math.random());
    }
  } else dot(rgb, C[0], C[1], 0.8, steel, 120);

  for (let p = 0; p < NP; p++)
    display.setPixel(p % W, floor(p / W), min(255, rgb[p * 3]) | 0, min(255, rgb[p * 3 + 1]) | 0, min(255, rgb[p * 3 + 2]) | 0);
}
