// ===== Patternflow pattern =====
// Title:   Perspective Crawl
// Family:  space
// Idea:    Short lines of 3 by 5 capitals are written on a plane lying away from the viewer and crawl up it toward the vanishing point, large and readable at the foot of the panel and squeezing into a faint line and then a point as they climb, each LED finding by the inverse of the perspective projection the point of the text plane it looks at.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rolling title of the serial films (1930s), the geometry of perspective (Leon Battista Alberti, De pictura, 1435), the 3 by 5 capitals of Saccades (pattern round 106), copied from kasiski-examination.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Lie=0..1, Size=1..1.8
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the letters are gold and the page they are written on, a dim field as wide as the plane, azure; the page's hue is always 0.45 of a turn from the letters', and both go darker with distance and the letters paler.
// Knob 2: Speed. How fast the lines crawl up the plane: 2.5 cells a second per unit, so 5 at 2, which is 8.6 LEDs a second at the foot of the panel and a new line every 1.6 s there. At 0.5 a line takes 6.4 s to come and at 4 it takes 0.8 s. The text is 38 lines long, the empty ones between stanzas counted, and then comes round again.
// Knob 3: Lie. How far down the camera looks: the horizon, where the plane's lines vanish, is at row 8 at 0, row 36 at 0.5 and row 64 at 1. The letters at the foot of the panel keep their width whatever the lie, and lying it down squeezes their height from 8.6 rows at 0 to 6.6 at 0.5 and 4.6 at 1, packs the rest of the plane into the rows below the horizon and leaves the sky above it dark.
// Knob 4: Size. How big the letters are at the foot of the panel: a cell of the face is 1.3 LEDs wide at 1, which fits a line of 12 letters across the foot and shows the sides of a line of 14 only higher up, and 2.3 LEDs at 1.8, where only the middle 7 letters of a line fit.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall, copied from kasiski-examination.js (from saccades.js).
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};

// What the crawl says: lines of 10 to 14 letters, an empty line between stanzas.
const LINES = [
  "CHAPTER NINE", "",
  "THE LONG WAY", "DOWN TO THE", "LIGHTHOUSE", "",
  "THE KEEPER HAS", "NOT SLEPT FOR", "SIX NIGHTS AND", "THE LAMP WILL", "NOT BURN WITH", "OUT HIS HAND", "",
  "A SHIP IS DUE", "BEFORE DAWN", "WITH ONE BOX", "OF GLASS AND", "A LETTER NO", "ONE WILL OPEN", "",
  "THE TIDE TURNS", "AT FOUR AND", "THE LIGHT MUST", "BE LIT BEFORE", "THE FOG COMES", "UP THE STAIRS", "",
  "SOMEONE KNOCKS", "ON THE LOWER", "DOOR TWICE AND", "THE KEEPER", "DOES NOT ASK", "WHO IT MAY BE", "",
  "NEXT WEEK THE", "BOX IS OPENED", "", "",
];

// The plane, written as cells: each line takes LH rows of cells with its 5 rows
// of capitals below 2 of space, and TW columns across, the letters 3 cells wide
// with 1 between them and each line centred.
const LH = 8, TW = 64, V = LINES.length * LH;
const TEX = new Uint8Array(V * TW);
LINES.forEach((line, i) => {
  const x0 = floor((TW - (line.length * 4 - 1)) / 2);
  for (let c = 0; c < line.length; c++) {
    const g = FACE[line[c]];
    if (!g) continue;
    const rows = g.split("|");
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (rows[r][q] === "#") TEX[(i * LH + 2 + r) * TW + x0 + c * 4 + q] = 1;
  }
});
// The running sums down each column of the plane, so that the mean of the cells
// under an LED's footprint is a difference of two of them whatever its size.
const PV = new Float32Array((V + 1) * TW);
for (let v = 0; v < V; v++) for (let u = 0; u < TW; u++) PV[(v + 1) * TW + u] = PV[v * TW + u] + TEX[v * TW + u];

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, lie: 0, size: 1, buf: new Uint8Array(NP * 3), row: new Float32Array(TW), ph: new Float32Array(TW + 1) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.lie = cl(k[2], 0, 1);
  S.size = cl(k[3], 1, 1.8);
  S.t += d * S.speed * 2.5; // cells of the plane gone by
}

// The column sums down to plane row v, which may be beyond the plane's ends: it repeats.
function down(v, u) {
  const n = floor(v / V), w = v - n * V, i = floor(w), f = w - i;
  return n * PV[V * TW + u] + PV[i * TW + u] + (f > 0 ? f * TEX[i * TW + u] : 0);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, row = S.row, ph = S.ph;
  // The camera: the horizon at row yh, which falls with the lie; the focal
  // length F; and the height h, which keeps a cell of the plane SB LEDs wide at
  // the foot of the panel whatever the lie. The plane's depth at a panel row y
  // is d = h F / (y - yh).
  const yh = 8 + 56 * S.lie, F = 90, SB = 1.3 * S.size, h = (H - yh) / SB;
  const rgb = [0, 0, 0], hb = S.hue + 0.13;
  const d0 = F / SB + 22 + S.t; // the depth of the plane's top row, which the crawl carries away from the foot, where the panel's last row looks
  for (let y = 0; y < H; y++) {
    const c = y + 0.5 - yh;
    if (c <= 0.6) {
      // Above the horizon: dark, with a haze along the horizon and a spark on the vanishing point.
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - W / 2, dy = c;
        const g = 0.2 * exp(dy / 2.5 - (dx * dx) / 400) + 0.8 * exp(-(dy * dy) / 3 - (dx * dx) / 5);
        hsv(hb, 0.35, min(1, g), rgb);
        const o = (y * W + x) * 3;
        buf[o] = rgb[0] * 255; buf[o + 1] = rgb[1] * 255; buf[o + 2] = rgb[2] * 255;
      }
      continue;
    }
    // An LED's footprint on the plane: the depths at its top and foot edges, so the
    // plane cells it spans down the panel (len) and across it (cpp).
    const dn = (h * F) / (c + 0.5), df = (h * F) / (c - 0.5), vlo = d0 - df, vhi = d0 - dn;
    const len = df - dn, cpp = h / c;
    // Near the foot an LED is about a cell and the face reads best sampled by the nearest cell;
    // farther up the mean of the cells under it keeps the lines from shimmering.
    const m = sm((max(cpp, len) - 0.9) / 1.0);
    if (m > 0) {
      for (let u = 0; u < TW; u++) row[u] = (down(vhi, u) - down(vlo, u)) / len;
      ph[0] = 0;
      for (let u = 0; u < TW; u++) ph[u + 1] = ph[u] + row[u];
    }
    const half = max(0.5 * cpp, 0.5), vn = floor(d0 - (h * F) / c), vi = (((vn % V) + V) % V) * TW;
    const at = (u) => {
      if (u <= 0) return 0;
      if (u >= TW) return ph[TW];
      const i = floor(u);
      return ph[i] + (u - i) * row[i];
    };
    const near = c / (H - yh), fog = sm(near) ** 0.5, boost = 1.15 + 1.6 * (1 - near);
    // The page the lines are written on, a dim field of the other hue as wide as the plane.
    const FL = [0, 0, 0], TX = [0, 0, 0];
    hsv(hb + 0.45, 0.85, 0.22 * fog, FL);
    hsv(hb, 0.3 + 0.5 * near, 1, TX);
    for (let x = 0; x < W; x++) {
      const u = TW / 2 + (x + 0.5 - W / 2) * cpp, ui = floor(u);
      const sharp = ui >= 0 && ui < TW ? TEX[vi + ui] : 0;
      const cov = m >= 1 ? (at(u + half) - at(u - half)) / (2 * half) : m <= 0 ? sharp : sharp + (m * ((at(u + half) - at(u - half)) / (2 * half) - sharp));
      const a = min(1, cov * boost) * fog, pg = sm(min(u, TW - u) / max(cpp, 0.001) + 0.5);
      const o = (y * W + x) * 3;
      buf[o] = (FL[0] * pg * (1 - a) + TX[0] * a) * 255;
      buf[o + 1] = (FL[1] * pg * (1 - a) + TX[1] * a) * 255;
      buf[o + 2] = (FL[2] * pg * (1 - a) + TX[2] * a) * 255;
    }
  }
  for (let p = 0; p < NP; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
