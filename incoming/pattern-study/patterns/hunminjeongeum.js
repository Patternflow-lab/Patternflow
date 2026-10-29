// ===== Patternflow pattern =====
// Title:   Hunminjeongeum
// Family:  type
// Idea:    The letter-making chapter of the Hunminjeongeum Haerye grows down the panel as a family tree: the five basic consonants are drawn, each column copies its letter one step down and adds a stroke that lights up as it is drawn (ㄱ to ㅋ, ㄴ to ㄷ to ㅌ, ㅁ to ㅂ to ㅍ, ㅅ to ㅈ to ㅊ, ㅇ to ㆆ to ㅎ), the three letters of a different body (ㆁ, ㄹ, ㅿ) fade in apart, and below them the dot of heaven, the line of earth and the line of man fly together into the eight vowels.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Jejahae, the chapter on how the letters were made, in the Hunminjeongeum Haerye (King Sejong; Jeong In-ji and seven scholars, 1446), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Style=0..1, Weight=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the strokes a letter takes over are warm gold, the stroke it adds and the vowels' dots are cyan, a stroke being drawn glows near white, and the three letters of a different body are lilac.
// Knob 2: Speed. At 2 the eight basic letters are drawn stroke by stroke in the first 1.3 s, the second row of each tree grows from 1.05 s, the third from 2.1 s, and the odd three fade in from 3.3 s; from 4.5 s a glow runs down the trees every 2.5 s, and at 15 s everything but the basic letters fades and grows again. At 0.2 ten times slower; at 3 one and a half times faster.
// Knob 3: Style. 0 is the Haerye's own letterforms of 1446: geometric strokes of one weight, ㅇ a circle, the vowels' dots round and apart from their stem, ㅅ an even pair of legs, a short upright tick on ㅊ and ㅎ, in a warm ink. Turning it moves them to today's forms: the dots stretch into short strokes off the stem, the right leg of ㅅ, ㅈ and ㅊ starts from the middle of the left, the ticks lie flat, the ink cools to white, and the four letters no longer used (ㆍ, ㆁ, ㆆ, ㅿ) fade to an eighth.
// Knob 4: Weight. The stroke, from 1.5 LED at 0 (1.6 at the opening 0.06) to 3.3 LED at 1; the dots stay rounder than the stroke and grow less.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, exp, atan2, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// Strokes in a unit box, y down. C is a capsule from (x0, y0) to (x1, y1)
// with r times the pen's half width, and a second set of numbers gives
// today's form where it differs; a dot is a capsule of length 0 and a large
// r. O is a ring (centre, radius). A stroke with "from" is taken over from
// another letter, [letter, stroke]; one with add: 1 is the stroke this letter
// adds; acc: 1 is drawn in the accent colour.
const C = (x0, y0, x1, y1, o = {}) => ({ ...o, k: "C", h: [x0, y0, x1, y1, o.r || 1], m: o.m ? [...o.m, o.mr || 1] : [x0, y0, x1, y1, o.mr || o.r || 1] });
const O = (cx, cy, r, o = {}) => ({ ...o, k: "O", h: [cx, cy, r] });
const DOT = 2.1;

// The letters: name, place (column, row, area) and strokes. The consonant
// tree has five columns and three rows; the odd three sit in their own row;
// the vowels have the three basic letters on one row and the eight made from
// them on two rows of four.
const L = {};
const def = (id, area, col, row, lev, strokes, extra = {}) => (L[id] = { id, area, col, row, lev, strokes, ...extra });
// Consonants, the Jejahae's five shapes: the tongue root closing the throat,
// the tongue touching the upper gum, the mouth, a tooth, the throat.
def("ㄱ", "c", 0, 0, 0, [C(0.12, 0.15, 0.86, 0.15), C(0.86, 0.15, 0.86, 0.9)]);
def("ㄴ", "c", 1, 0, 0, [C(0.15, 0.1, 0.15, 0.85), C(0.15, 0.85, 0.9, 0.85)]);
def("ㅁ", "c", 2, 0, 0, [C(0.15, 0.15, 0.15, 0.85), C(0.15, 0.15, 0.85, 0.15), C(0.85, 0.15, 0.85, 0.85), C(0.15, 0.85, 0.85, 0.85)]);
def("ㅅ", "c", 3, 0, 0, [C(0.5, 0.12, 0.1, 0.88), C(0.5, 0.12, 0.9, 0.88, { m: [0.31, 0.5, 0.88, 0.88] })]);
def("ㅇ", "c", 4, 0, 0, [O(0.5, 0.5, 0.37)]);
// Each stroke louder by one: ㄱ to ㅋ, ㄴ to ㄷ to ㅌ, ㅁ to ㅂ to ㅍ,
// ㅅ to ㅈ to ㅊ, ㅇ to ㆆ to ㅎ.
def("ㅋ", "c", 0, 1, 1, [C(0.12, 0.15, 0.86, 0.15, { from: ["ㄱ", 0] }), C(0.86, 0.15, 0.86, 0.9, { from: ["ㄱ", 1] }), C(0.12, 0.52, 0.86, 0.52, { add: 1 })]);
def("ㄷ", "c", 1, 1, 1, [C(0.15, 0.15, 0.15, 0.85, { from: ["ㄴ", 0] }), C(0.15, 0.85, 0.88, 0.85, { from: ["ㄴ", 1] }), C(0.15, 0.15, 0.88, 0.15, { add: 1 })]);
def("ㅌ", "c", 1, 2, 2, [C(0.15, 0.15, 0.15, 0.85, { from: ["ㄷ", 0] }), C(0.15, 0.85, 0.88, 0.85, { from: ["ㄷ", 1] }), C(0.15, 0.15, 0.88, 0.15, { from: ["ㄷ", 2] }), C(0.15, 0.5, 0.88, 0.5, { add: 1 })]);
def("ㅂ", "c", 2, 1, 1, [
  C(0.17, 0.45, 0.17, 0.88, { from: ["ㅁ", 0] }), C(0.17, 0.45, 0.83, 0.45, { from: ["ㅁ", 1] }), C(0.83, 0.45, 0.83, 0.88, { from: ["ㅁ", 2] }),
  C(0.17, 0.88, 0.83, 0.88, { from: ["ㅁ", 3] }), C(0.17, 0.1, 0.17, 0.45, { add: 1 }), C(0.83, 0.1, 0.83, 0.45, { add: 1 }),
]);
// ㅍ has as many strokes as ㅂ in the Haerye's own letterforms, so nothing
// is added here: ㅂ's strokes move into ㅍ, and the letter keeps no accent.
def("ㅍ", "c", 2, 2, 2, [
  C(0.33, 0.5, 0.33, 0.85, { from: ["ㅂ", 0] }), C(0.08, 0.15, 0.92, 0.15, { from: ["ㅂ", 1] }), C(0.67, 0.5, 0.67, 0.85, { from: ["ㅂ", 2] }),
  C(0.08, 0.85, 0.92, 0.85, { from: ["ㅂ", 3] }), C(0.33, 0.15, 0.33, 0.5, { from: ["ㅂ", 4] }), C(0.67, 0.15, 0.67, 0.5, { from: ["ㅂ", 5] }),
], { moved: 1 });
def("ㅈ", "c", 3, 1, 1, [
  C(0.5, 0.16, 0.12, 0.88, { from: ["ㅅ", 0] }), C(0.5, 0.16, 0.88, 0.88, { from: ["ㅅ", 1], m: [0.31, 0.52, 0.86, 0.88] }), C(0.1, 0.16, 0.9, 0.16, { add: 1 }),
]);
def("ㅊ", "c", 3, 2, 2, [
  C(0.5, 0.34, 0.14, 0.9, { from: ["ㅈ", 0] }), C(0.5, 0.34, 0.86, 0.9, { from: ["ㅈ", 1], m: [0.33, 0.62, 0.86, 0.9] }), C(0.1, 0.34, 0.9, 0.34, { from: ["ㅈ", 2] }),
  C(0.5, 0.04, 0.5, 0.24, { add: 1, m: [0.32, 0.14, 0.68, 0.14] }),
]);
def("ㆆ", "c", 4, 1, 1, [O(0.5, 0.63, 0.27, { from: ["ㅇ", 0] }), C(0.12, 0.2, 0.88, 0.2, { add: 1 })], { old: 1 });
def("ㅎ", "c", 4, 2, 2, [O(0.5, 0.69, 0.23, { from: ["ㆆ", 0] }), C(0.12, 0.33, 0.88, 0.33, { from: ["ㆆ", 1] }), C(0.5, 0.04, 0.5, 0.22, { add: 1, m: [0.3, 0.14, 0.7, 0.14] })]);
// The three that are not made by adding a stroke: ㆁ takes the throat's
// circle, ㄹ and ㅿ copy the tongue and the tooth with a different body.
def("ㆁ", "x", 0, 0, 3, [C(0.5, 0.04, 0.5, 0.3), O(0.5, 0.63, 0.29)], { old: 1 });
def("ㄹ", "x", 1, 0, 3, [C(0.12, 0.12, 0.86, 0.12), C(0.86, 0.12, 0.86, 0.5), C(0.86, 0.5, 0.14, 0.5), C(0.14, 0.5, 0.14, 0.88), C(0.14, 0.88, 0.88, 0.88)]);
def("ㅿ", "x", 3, 0, 3, [C(0.5, 0.12, 0.1, 0.86), C(0.5, 0.12, 0.9, 0.86), C(0.1, 0.86, 0.9, 0.86)], { old: 1 });
// Vowels: heaven round, earth flat, man upright.
def("ㆍ", "b", 0, 0, 0, [C(0.5, 0.5, 0.5, 0.5, { r: DOT * 1.25, acc: 1, mr: DOT * 1.25 })], { old: 1 });
def("ㅡ", "b", 1, 0, 0, [C(0.06, 0.5, 0.94, 0.5)]);
def("ㅣ", "b", 2, 0, 0, [C(0.5, 0.06, 0.5, 0.94)]);
// First out: one dot with earth or man. Again out: a second dot, from ㅣ.
const dot = (x, y, from, m, add) => C(x, y, x, y, { r: DOT, acc: 1, from, m, add });
def("ㅗ", "v", 0, 0, 1, [C(0.06, 0.7, 0.94, 0.7, { from: ["ㅡ", 0] }), dot(0.5, 0.38, ["ㆍ", 0], [0.5, 0.7, 0.5, 0.4])]);
def("ㅏ", "v", 1, 0, 1, [C(0.36, 0.06, 0.36, 0.94, { from: ["ㅣ", 0] }), dot(0.7, 0.5, ["ㆍ", 0], [0.36, 0.5, 0.68, 0.5])]);
def("ㅜ", "v", 2, 0, 1, [C(0.06, 0.3, 0.94, 0.3, { from: ["ㅡ", 0] }), dot(0.5, 0.62, ["ㆍ", 0], [0.5, 0.3, 0.5, 0.6])]);
def("ㅓ", "v", 3, 0, 1, [C(0.64, 0.06, 0.64, 0.94, { from: ["ㅣ", 0] }), dot(0.3, 0.5, ["ㆍ", 0], [0.32, 0.5, 0.64, 0.5])]);
def("ㅛ", "v", 0, 1, 2, [C(0.06, 0.7, 0.94, 0.7, { from: ["ㅗ", 0] }), dot(0.31, 0.38, ["ㅗ", 1], [0.35, 0.7, 0.35, 0.4]), dot(0.69, 0.38, null, [0.65, 0.7, 0.65, 0.4], 1)]);
def("ㅑ", "v", 1, 1, 2, [C(0.36, 0.06, 0.36, 0.94, { from: ["ㅏ", 0] }), dot(0.7, 0.31, ["ㅏ", 1], [0.36, 0.35, 0.68, 0.35]), dot(0.7, 0.69, null, [0.36, 0.65, 0.68, 0.65], 1)]);
def("ㅠ", "v", 2, 1, 2, [C(0.06, 0.3, 0.94, 0.3, { from: ["ㅜ", 0] }), dot(0.31, 0.62, ["ㅜ", 1], [0.35, 0.3, 0.35, 0.6]), dot(0.69, 0.62, null, [0.65, 0.3, 0.65, 0.6], 1)]);
def("ㅕ", "v", 3, 1, 2, [C(0.64, 0.06, 0.64, 0.94, { from: ["ㅓ", 0] }), dot(0.3, 0.31, ["ㅓ", 1], [0.32, 0.35, 0.64, 0.35]), dot(0.3, 0.69, null, [0.32, 0.65, 0.64, 0.65], 1)]);
const ORDER = Object.keys(L);

// Boxes on the panel. Consonants: five columns 12.8 LEDs apart, glyphs
// 12 x 14, rows 19 apart. The odd three on row 57. Vowels: the basic three
// on row 77, the eight on rows 94 and 111, glyphs 15 x 15.
function place(g) {
  if (g.area === "c" || g.area === "x") {
    const cx = 6.4 + g.col * 12.8;
    return [cx - 6, g.area === "x" ? 57 : 1 + g.row * 19, 12, 14];
  }
  if (g.area === "b") return [12 + g.col * 20 - 7.5, 77, 15, 15];
  return [8 + g.col * 16 - 7.5, 94 + g.row * 17, 15, 15];
}
for (const id of ORDER) {
  const g = L[id];
  g.box = place(g);
  for (const s of g.strokes) if (s.acc === undefined) s.acc = s.add || 0;
}

// Beats at Speed 2, in seconds of build time.
const TRACE = 0.26, FLY = 0.5, T_LEV = [0, 1.05, 2.1, 3.3], STAG = 0.12, GLOW = 0.7, PULSE = 2.5, T_CYCLE = 15, T_FADE = 1;

function startOf(g) {
  return T_LEV[g.lev] + (g.area === "v" ? 0.3 + g.col * STAG : g.area === "x" ? g.col * 0.25 : g.col * STAG);
}

export function setup(params) {
  params.s = { T: 0, cyc: 0, hue: 0, speed: 2, style: 0, w: 0.8, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.style = cl(kv[2], 0, 1);
  S.w = 0.75 + 0.9 * cl(kv[3], 0, 1);
  S.T += (d * S.speed) / 2;
  // After the hold, everything but the basic letters fades and grows again.
  if (S.T > T_CYCLE + T_FADE) {
    S.T = T_LEV[1] - 0.3;
    S.cyc++;
  }
}

// One stroke's shape on the panel for a letter, at the current style: a
// capsule [x0, y0, x1, y1, r] or a ring [cx, cy, R, 0, 0] in LEDs.
function shape(S, g, s, out) {
  const [bx, by, bw, bh] = g.box, st = S.style;
  if (s.k === "O") {
    out[0] = bx + s.h[0] * bw;
    out[1] = by + s.h[1] * bh;
    out[2] = s.h[2] * min(bw, bh);
    out[3] = out[4] = 0;
    return out;
  }
  for (let i = 0; i < 4; i++) {
    const v = s.h[i] + (s.m[i] - s.h[i]) * st;
    out[i] = (i & 1 ? by + v * bh : bx + v * bw);
  }
  // A dot is rounder than the pen and grows less with Weight.
  const rad = (k) => (k > 1.5 ? (k > 2.2 ? 0.95 + 1.2 * S.w : 0.75 + S.w) : S.w);
  out[4] = rad(s.h[4]) + (rad(s.m[4]) - rad(s.h[4])) * st;
  return out;
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
  const t = l > 0 ? cl(((px - x0) * dx + (py - y0) * dy) / l, 0, 1) : 0;
  const ex = x0 + t * dx - px, ey = y0 + t * dy - py;
  return sqrt(ex * ex + ey * ey);
}

// Paints one stroke: coverage over a 1-LED edge, plus a soft halo when it
// glows. u is how much of it is drawn (a capsule from its start, a ring
// from the top going left, the way ㅇ is written).
function paint(S, k, g5, u, rgb, alpha, glow, w) {
  const buf = S.buf, ring = k === "O";
  let x0 = g5[0], y0 = g5[1], x1 = g5[2], y1 = g5[3], r = g5[4];
  if (!ring && u < 1) (x1 = x0 + (x1 - x0) * u), (y1 = y0 + (y1 - y0) * u);
  const R = ring ? g5[2] : 0, pr = ring ? w : r, halo = glow > 0.01 ? 2.6 : 0;
  const ext = (ring ? R + pr : pr) + halo + 1;
  const xa = max(0, floor((ring ? x0 : min(x0, x1)) - ext)), xb = min(W - 1, Math.ceil((ring ? x0 : max(x0, x1)) + ext));
  const ya = max(0, floor((ring ? y0 : min(y0, y1)) - ext)), yb = min(H - 1, Math.ceil((ring ? y0 : max(y0, y1)) + ext));
  const sweep = u * 2 * PI;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, py = y + 0.5;
      let d;
      if (ring) {
        const dx = px - x0, dy = py - y0;
        let a = atan2(-dx, -dy);
        if (a < 0) a += 2 * PI;
        if (u >= 1 || a <= sweep) d = abs(sqrt(dx * dx + dy * dy) - R);
        else {
          const ex = x0 - R * sin(sweep), ey = y0 - R * cos(sweep);
          d = min(sqrt((px - x0) ** 2 + (py - y0 + R) ** 2), sqrt((px - ex) ** 2 + (py - ey) ** 2));
        }
      } else d = segDist(px, py, x0, y0, x1, y1);
      const cov = cl(pr + 0.5 - d, 0, 1) * alpha;
      let v = cov;
      if (halo) v = max(v, glow * 0.55 * exp(-((d - pr) * (d - pr)) / 2.2) * alpha);
      if (v <= 0.004) continue;
      const o = (y * W + x) * 3;
      buf[o] = max(buf[o], rgb[0] * v);
      buf[o + 1] = max(buf[o + 1], rgb[1] * v);
      buf[o + 2] = max(buf[o + 2], rgb[2] * v);
    }
}

function line(S, x0, y0, x1, y1, rgb, a) {
  paint(S, "C", [x0, y0, x1, y1, 0.35], 1, rgb, a, 0, 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, T = S.T, st = S.style, h = S.hue;
  buf.fill(0);
  // The ink cools from the warm tone of the printed page to plain white.
  const ink = hsv(h + 0.11 - 0.03 * st, 0.55 - 0.45 * st, 0.9, [0, 0, 0]);
  const acc = hsv(h + 0.5, 0.72, 1, [0, 0, 0]);
  const odd = hsv(h + 0.78, 0.38, 0.8, [0, 0, 0]);
  const hot = hsv(h + 0.5, 0.15, 1, [0, 0, 0]);
  const dim = hsv(h + 0.5, 0.5, 0.3, [0, 0, 0]);
  // Fade of everything grown, at the end of a cycle.
  const fadeAll = T > T_CYCLE ? 1 - (T - T_CYCLE) / T_FADE : 1;
  const tmp = [0, 0, 0, 0, 0], src = [0, 0, 0, 0, 0], g5 = [0, 0, 0, 0, 0], col = [0, 0, 0];
  // Rules between consonants, the odd three and vowels.
  if (T > T_LEV[3] - 0.2) {
    const a = cl((T - T_LEV[3] + 0.2) / 0.6, 0, 1) * fadeAll * 0.5;
    for (let x = 2; x < 62; x += 3) line(S, x, 54.5, x + 1, 54.5, dim, a);
  }
  const ar = cl(T / 0.8, 0, 1) * 0.5;
  for (let x = 2; x < 62; x += 3) line(S, x, 74, x + 1, 74, dim, ar);
  // The last pulse of the hold: a glow that runs down each tree.
  const tEnd = T_LEV[3] + 1.2, pT = T > tEnd ? T - tEnd - floor((T - tEnd) / PULSE) * PULSE : -9;
  for (const id of ORDER) {
    const g = L[id], t0 = startOf(g), lt = g.lev === 0 && S.cyc > 0 ? 99 : T - t0;
    if (lt < 0) continue;
    const grown = g.lev > 0 ? fadeAll : 1;
    const oldDim = g.old ? 1 - 0.88 * st : 1;
    const isOdd = g.area === "x";
    // The tree's branch from the letter above.
    if (g.area === "c" && g.lev > 0) {
      const [bx, by] = g.box, cx = bx + 6, u = ease(lt / FLY);
      line(S, cx, by - 4.2, cx, by - 4.2 + 3.4 * u, dim, grown * 0.8);
    }
    let nAdd = 0;
    for (let i = 0; i < g.strokes.length; i++) {
      const s = g.strokes[i];
      shape(S, g, s, g5);
      let u = 1, alpha = grown * oldDim, glow = 0, rgb = ink;
      if (isOdd) {
        alpha *= ease(lt / 0.9);
        rgb = odd;
      } else if (g.lev === 0) {
        // Basic letters: drawn stroke by stroke.
        const a = lt - i * TRACE;
        if (a < 0) continue;
        u = ease(a / TRACE);
        glow = a < TRACE ? 1 : exp(-(a - TRACE) / GLOW) * 0.6;
        rgb = s.acc ? acc : ink;
      } else if (s.from) {
        // Taken over: flies from the letter it came from.
        const f = L[s.from[0]];
        shape(S, f, f.strokes[s.from[1]], src);
        const e = ease(lt / FLY);
        for (let j = 0; j < 5; j++) tmp[j] = src[j] + (g5[j] - src[j]) * e;
        for (let j = 0; j < 5; j++) g5[j] = tmp[j];
        rgb = s.acc ? acc : ink;
        // ㅍ's strokes and the vowels' dots light as they land.
        if (g.moved || s.acc) glow = lt < FLY ? 0.5 * e : exp(-(lt - FLY) / GLOW);
      } else {
        // The added stroke: drawn after the rest has landed, glowing.
        const a = lt - FLY - nAdd * TRACE;
        nAdd++;
        if (a < 0) continue;
        u = ease(a / TRACE);
        glow = a < TRACE ? 1 : exp(-(a - TRACE) / GLOW);
        rgb = acc;
      }
      if (pT >= 0 && !isOdd && (s.add || (g.moved && g.lev > 0) || (s.acc && g.lev > 0))) {
        const q = pT - (g.lev - 1) * 0.45 - (g.area === "v" ? 0.2 : 0);
        if (q >= 0) glow = max(glow, exp(-q / 0.45) * 0.9);
      }
      if (glow > 0.02) {
        const k = min(1, glow) * 0.8;
        for (let j = 0; j < 3; j++) col[j] = rgb[j] + (hot[j] - rgb[j]) * k;
        paint(S, s.k, g5, u, col, alpha, glow, S.w);
      } else paint(S, s.k, g5, u, rgb, alpha, 0, S.w);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
    }
}
