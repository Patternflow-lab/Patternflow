// ===== Patternflow pattern =====
// Title:   Navon Letters
// Family:  type
// Idea:    A big capital that fills the panel is made of small capitals, each of them made of smaller capitals again; the figure rests, then the view zooms into one small letter until it fills the panel as the next big letter, so the levels read down a phrase a letter at a time, F made of O made of R for FOREST BEFORE TREES, and the small letters can disagree with the letter they build, as in Navon's H made of S, or copy it, leaving only the letter the zoom is heading for as the odd one out.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Navon figures, large letters made of small letters (David Navon, Forest before trees: the precedence of global features in visual perception, Cognitive Psychology, 1977), here nested without end as a zoom loop; 5 by 5 capitals on cells twice as tall as wide drawn for this pattern; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Agree=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each level of the text has its own hue, 0.27 of a turn on from the level above, for the strokes of its letters and, faintly, for the cells of its big letter. At 0 the opening F glows dim lime behind small aqua O, and the R inside each O are violet; at 0.5 the O are red and the R green.
// Knob 2: Speed. At 2 one level takes 7 s: the figure rests 2.1 s, then for 4.9 s the view eases 5.9 times larger, the step from a big letter to the small letters it is made of, while the chosen small letter slides to the middle; 70 s at 0.2 and 4.7 s at 3.
// Knob 3: Text. What the levels spell, one letter a level down: at 0 FORESTBEFORETREES, the title of Navon's paper, 17 levels and two minutes at Speed 2; at 1 H and S in turn, his own pair of letters; at 2 GLOBALLOCAL; at 3 the alphabet.
// Knob 4: Agree. Below 0.1 every small letter is the next letter of the text, the big F of small O, a conflicting Navon figure. Turned up, more and more small letters copy the letter they build, in a fixed order, until at 1 every small letter is the big letter again, an F made of F, except the one the zoom is heading for, which stands out in its own colour.

// A letter is a 5 by 5 grid of cells twice as tall as they are wide, so
// a letter has the panel's shape and the big one fills it. Each lit cell
// holds a whole letter at 0.85 of the cell's size, which leaves a gap of
// 0.15 of a cell between neighbours, so a letter is 5 / 0.85 = 5.9 times
// the size of the letters it is made of, and those are made of letters 5.9
// times smaller again, down past one LED.
//
// The loop: the path is a chain of letters, the text read one letter a
// level, each sitting in one lit cell of the one above it, picked at random
// with cells near the middle and among lit neighbours the likelier. The
// camera looks at the big letter through
// x = 32 + 64 Z^t (u - cu(t)), y = 64 + 128 Z^t (v - cv(t)),
// u and v from 0 to 1 across it, Z = 5.9 and t the zoom from 0 to 1. The
// point (cu, cv) the panel centres on slides from the middle of the big
// letter to the middle of the path cell along a smoothstep, so at t = 1
// the small letter fills the panel exactly as the big one did at t = 0,
// one level down the text, with no seam. t itself rests at 0 for the first
// 0.3 of a level and then follows a smoothstep, so the zoom stops dead
// between levels.
//
// Every LED is worked out in 2 by 2 samples by walking down from the big
// letter: at each level the sample is in a lit cell, in the gap round the
// small letter there, or off it. A level whose cells are under 0.45 LED
// wide counts as solid ink, and between 0.45 and 0.9 its gaps fade in. A
// letter's colour takes over from the one it builds as its cells grow from
// 0.9 to 2.2 LEDs wide, about where its shape can be read, and the cells
// of a letter whose cells are 8 to 28 LEDs wide glow at 0.2 in its colour,
// fading in from 2.5 and out by 70.
//
// Letters off the path are worked out from a hash of where they sit under
// the path, so the same letter is in the same place on every frame and in
// every loop; Agree compares that hash with its value.

const W = 64, H = 128;
const { floor, round, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const K = 0.85, M = (1 - K) / 2, Z = 5 / K, CYCLE = 14, DWELL = 0.3, SS = 2, DEEP = 9, NP = 32;
const RES0 = 0.45, RES1 = 0.9, LEG0 = 0.9, LEG1 = 2.2, BK = 0.2, BK0 = 2.5, BK1 = 8, BK2 = 28, BK3 = 70;
const TEXTS = ["FORESTBEFORETREES", "HS", "GLOBALLOCAL", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

// prettier-ignore
const FONT = [
  ".###.#...#######...##...#", "####.#...#####.#...#####.", ".#####....#....#.....####", "####.#...##...##...#####.",
  "######....####.#....#####", "######....####.#....#....", ".#####....#..###...#.####", "#...##...#######...##...#",
  "#####..#....#....#..#####", "....#....#....##...#.###.", "#...##..#.###..#..#.#...#", "#....#....#....#....#####",
  "#...###.###.#.##...##...#", "#...###..##.#.##..###...#", ".###.#...##...##...#.###.", "####.#...#####.#....#....",
  ".###.#...##.#.##..#..##.#", "####.#...#####.#..#.#...#", ".#####.....###.....#####.", "#####..#....#....#....#..",
  "#...##...##...##...#.###.", "#...##...##...#.#.#...#..", "#...##...##.#.###.###...#", "#...#.#.#...#...#.#.#...#",
  "#...#.#.#...#....#....#..", "#####...#...#...#...#####",
];
const GLYPH = new Uint8Array(26 * 25);
FONT.forEach((g, c) => {
  for (let k = 0; k < 25; k++) GLYPH[c * 25 + k] = g[k] === "#" ? 1 : 0;
});

function hash(h) {
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = { t: 0, n: 0, hue: 0, text: 0, share: 0, seeds: new Map(), pal: new Float32Array(NP * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.text = round(cl(k[2] || 0, 0, 3));
  S.share = cl(((k[3] == null ? 0.06 : k[3]) - 0.1) / 0.9, 0, 1);
  S.t += (d * speed) / CYCLE;
  while (S.t >= 1) {
    S.t -= 1;
    S.n++;
    S.seeds.delete(S.n - 2);
  }
}

// The text letter at level a, as 0 to 25.
const letterAt = (txt, a) => txt.charCodeAt(((a % txt.length) + txt.length) % txt.length) - 65;

// The path cell of level a's letter: a lit cell, the nearer the middle the likelier.
function pathCell(S, txt, a) {
  let seed = S.seeds.get(a);
  if (seed == null) {
    seed = floor(Math.random() * 4294967296);
    S.seeds.set(a, seed);
  }
  const g = letterAt(txt, a) * 25;
  let best = 12, top = -1e9;
  for (let c = 0; c < 25; c++) {
    if (!GLYPH[g + c]) continue;
    const cx = c % 5, cy = (c / 5) | 0, dx = cx - 2, dy = cy - 2;
    let nb = 0;
    for (let v = -1; v <= 1; v++)
      for (let u = -1; u <= 1; u++) {
        const x = cx + u, y = cy + v;
        if ((u || v) && x >= 0 && x < 5 && y >= 0 && y < 5) nb += GLYPH[g + y * 5 + x];
      }
    const sc = hash(seed ^ (c * 0x9e3779b1)) / 4294967296 - 0.25 * (dx * dx + dy * dy) + 0.22 * nb;
    if (sc > top) (top = sc), (best = c);
  }
  return best;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const txt = TEXTS[S.text], n = S.n, pal = S.pal, share = S.share;
  // The figure rests for the first DWELL of a level, then the zoom eases
  // in and out, so the speed is zero at both ends of every level.
  const e = cl((S.t - DWELL) / (1 - DWELL), 0, 1), t = e * e * (3 - 2 * e);
  // A hue for every level of the text, 0.27 of a turn on from the one above.
  for (let q = 0; q < NP; q++) hsv(S.hue + 0.23 + 0.27 * (n + q), 0.8, 1, pal, q * 3);
  // Path cells from the big letter down to DEEP levels below it.
  const pc = [];
  for (let a = n; a <= n + DEEP; a++) pc.push(pathCell(S, txt, a));
  // The camera: the big letter's width and where its corner sits.
  const g = t * t * (3 - 2 * t), tc = pc[0];
  const cx = 0.5 + (((tc % 5) + 0.5) / 5 - 0.5) * g, cy = 0.5 + ((((tc / 5) | 0) + 0.5) / 5 - 0.5) * g;
  const s0 = W * pow(Z, t), ox0 = W / 2 - s0 * cx, oy0 = H / 2 - 2 * s0 * cy;
  const inv = 1 / (SS * SS);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS - 0.5, y = py + (sy + 0.5) / SS - 0.5;
          let ox = ox0, oy = oy0, s = s0, lev = n, idx = n, path = true, h = 0;
          let L = letterAt(txt, idx), q = 0, cr = pal[0], cg = pal[1], cb = pal[2];
          let ink = 0, br = 0, bg = 0, bb = 0;
          for (let dep = 0; dep < 24; dep++) {
            // Cell width; a cell is twice as tall.
            const c = s / 5;
            if (c < RES0) {
              ink = 1;
              break;
            }
            const w = cl((c - LEG0) / (LEG1 - LEG0), 0, 1);
            if (w > 0) {
              const ww = w * w * (3 - 2 * w);
              cr += (pal[q] - cr) * ww;
              cg += (pal[q + 1] - cg) * ww;
              cb += (pal[q + 2] - cb) * ww;
            }
            const f = c < RES1 ? (c - RES0) / (RES1 - RES0) : 1;
            const fx = (x - ox) / c, fy = (y - oy) / (2 * c);
            if (fx < 0 || fy < 0 || fx >= 5 || fy >= 5) {
              ink = 1 - f;
              break;
            }
            const i = fx | 0, j = fy | 0, cell = j * 5 + i, u = fx - i - M, v = fy - j - M;
            if (!GLYPH[L * 25 + cell]) {
              ink = 1 - f;
              break;
            }
            // A lit cell of a big letter glows faintly in that letter's colour.
            const b = BK * cl((c - BK0) / (BK1 - BK0), 0, 1) * cl((BK3 - c) / (BK3 - BK2), 0, 1);
            if (b > 0) (br += b * pal[q]), (bg += b * pal[q + 1]), (bb += b * pal[q + 2]);
            if (u < 0 || v < 0 || u >= K || v >= K) {
              ink = 1 - f;
              break;
            }
            // Into the small letter in this cell.
            if (path && cell === pc[lev - n]) {
              lev++;
              idx = lev;
              if (lev - n >= pc.length) path = false;
            } else {
              h = path ? hash(lev * 7919 + cell * 104729 + 1) : hash(h + cell * 2654435761);
              path = false;
              if (h / 4294967296 >= share) idx++;
            }
            L = letterAt(txt, idx);
            q = (idx - n) * 3;
            ox += (i + M) * c;
            oy += (j + M) * 2 * c;
            s = c * K;
          }
          R += cr * ink + br * (1 - ink);
          G += cg * ink + bg * (1 - ink);
          B += cb * ink + bb * (1 - ink);
        }
      }
      display.setPixel(px, py, round(cl(R * inv, 0, 1) * 255), round(cl(G * inv, 0, 1) * 255), round(cl(B * inv, 0, 1) * 255));
    }
  }
}
