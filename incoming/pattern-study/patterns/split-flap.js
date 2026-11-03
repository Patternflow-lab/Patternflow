// ===== Patternflow pattern =====
// Title:   Split-Flap
// Family:  type
// Idea:    A departure board of thirty split-flap modules, five across and six down, each a drum of forty flaps that can only turn forward: to change the page every module rattles through all the letters between the old one and the new, the top half of each flap falling over the hinge to show the next letter's top while its back lands as the bottom, so a new page arrives row by row and letter by letter as the short trips land first and the long ones last.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the split-flap departure boards of Solari di Udine, first installed at Liège-Guillemins station in 1956; 5x7 capitals drawn for this pattern and shown at twice size; pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Board=0..3, Flap=0.03..0.3
//
// Knob 1: Hue. Turns the ink round the wheel. At 0 the names are a warm white and the times and states amber, on flaps of a dark blue-grey; at 0.25 the times are green, at 0.5 blue with the names a cool white and the flaps a dark brown-grey, at 0.75 magenta.
// Knob 2: Speed. The board's clock. At 2 a page holds 3 s after its last module lands, the rows start 0.15 s apart, and a flap takes what K4 says; at 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Board. What the board shows, four pages each. At 0 trains, a destination over its departure time three to a page (UDINE 07:42, PARMA 07:55, SIENA 08:10). At 1 flights, a flight over its state (AZ612 BOARD, LH098 DELAY, OS517 GT 14). At 2 a line of words down the board (EVERY FLAP FALLS ONE WAY ONLY; Z IS THE LONG WAY ROUND). At 3 the drum itself in reading order, every module turning exactly five flaps a page, so the whole alphabet climbs one row.
// Knob 4: Flap. Seconds per flap at Speed 2. At the opening 0.06 a module goes once round its drum of 40 flaps in 2.4 s, the first page of trains settles 3.2 s after the start and a new page lands every 6.2 s, the letters a blur that settles in a ripple; at 0.3 each flap falls slowly enough to watch it fold over the hinge, the first page takes 11.7 s and a page comes every 15.5 s.

// The board. Each module is 12 LEDs wide and 19 tall: a top flap of 9
// rows, the hinge (a dark row with a pin at each end), and a bottom flap of
// 9 rows. Modules sit 1 LED apart across and 2 down, 5 x 6 of them filling
// 64 x 128 with 2 rows to spare top and bottom.
//
// The drum. Blank, A to Z, 0 to 9, colon, hyphen and full stop: 40 flaps.
// As on a real split-flap drum, the front of each flap carries the top half
// of one character and its back the bottom half of the next. Showing
// character c, flap c stands up above the hinge and flap c - 1 hangs below
// it, back out. One step drops flap c over the hinge: as it falls it
// uncovers the top half of c + 1 on the flap behind, foreshortened to
// cos(theta) of its height, and past 90 degrees its back, the bottom half of
// c + 1, unfolds downward over the old bottom half. The angle grows as the
// square of time, a fall. The front darkens as it tips away from the light
// above, and the falling flap casts a short shadow on what it covers.
//
// A module told a new character steps forward one flap at a time until it
// gets there, never back, so from A to B is one flap and from B to A is 39.
// Each row starts 0.15 s after the one above, each module a little later or
// earlier and a little faster or slower than its neighbours (up to 0.1 s and
// 10%), so even modules with the same trip do not move in step.

const W = 64, H = 128, MW = 12, MH = 19, COLS = 5, ROWS = 6, HALF = 9;
const { floor, min, max, round, cos, PI, abs, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.";
const NF = DRUM.length;
const HOLD = 3, ROWDELAY = 0.15;

// 5 x 7 capitals, one string of 35 per character, rows top to bottom.
const FONT = {
  A: ".###.#...##...#######...##...##...#",
  B: "####.#...##...#####.#...##...#####.",
  C: ".###.#...##....#....#....#...#.###.",
  D: "####.#...##...##...##...##...#####.",
  E: "######....#....####.#....#....#####",
  F: "######....#....####.#....#....#....",
  G: ".###.#...##....#.####...##...#.####",
  H: "#...##...##...#######...##...##...#",
  I: ".###...#....#....#....#....#...###.",
  J: "..###...#....#....#....#.#..#..##..",
  K: "#...##..#.#.#..##...#.#..#..#.#...#",
  L: "#....#....#....#....#....#....#####",
  M: "#...###.###.#.##.#.##...##...##...#",
  N: "#...##...###..##.#.##..###...##...#",
  O: ".###.#...##...##...##...##...#.###.",
  P: "####.#...##...#####.#....#....#....",
  Q: ".###.#...##...##...##.#.##..#..##.#",
  R: "####.#...##...#####.#.#..#..#.#...#",
  S: ".#####....#.....###.....#....#####.",
  T: "#####..#....#....#....#....#....#..",
  U: "#...##...##...##...##...##...#.###.",
  V: "#...##...##...##...##...#.#.#...#..",
  W: "#...##...##...##.#.##.#.##.#.#.#.#.",
  X: "#...##...#.#.#...#...#.#.#...##...#",
  Y: "#...##...#.#.#...#....#....#....#..",
  Z: "#####....#...#...#...#...#....#####",
  0: ".###.#...##..###.#.###..##...#.###.",
  1: "..#...##....#....#....#....#...###.",
  2: ".###.#...#....#...#...#...#...#####",
  3: "####.....#....#.###.....#....#####.",
  4: "...#...##..#.#.#..#.#####...#....#.",
  5: "######....####.....#....##...#.###.",
  6: "..##..#...#....####.#...##...#.###.",
  7: "#####....#...#...#...#....#....#...",
  8: ".###.#...##...#.###.#...##...#.###.",
  9: ".###.#...##...#.####....#...#..##..",
  ":": ".......#....#.........#....#.......",
  "-": "...............#####...............",
  ".": "..........................##...##..",
};

// The boards: four pages of six lines, five characters at most; lines
// marked with ^ take the accent ink.
const BOARDS = [
  [
    ["UDINE", "^07:42", "PARMA", "^07:55", "SIENA", "^08:10"],
    ["LUCCA", "^08:24", "BARI", "^08:31", "COMO", "^08:47"],
    ["WIEN", "^09:02", "GRAZ", "^09:15", "LINZ", "^09:30"],
    ["ROMA", "^09:44", "PISA", "^09:58", "LECCE", "^10:12"],
  ],
  [
    ["AZ612", "^BOARD", "LH098", "^DELAY", "OS517", "^GT 14"],
    ["KL361", "^LAST", "IB220", "^GT 03", "TP115", "^CLOSE"],
    ["SN402", "^BOARD", "LX331", "^DELAY", "AF978", "^GT 22"],
    ["EI153", "^LAND", "OK774", "^BOARD", "BA559", "^GT 09"],
  ],
  [
    ["^EVERY", "FLAP", "FALLS", "ONE", "WAY", "ONLY"],
    ["^Z", "IS", "THE", "LONG", "WAY", "ROUND"],
    ["^ALL", "STOP", "WHEN", "THE", "LAST", "LANDS"],
    ["^FROM", "UDINE", "TO", "LIEGE", "1956", ""],
  ],
  null,
];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Is the LED at column x (0-11) and row y (0-8) of a half flap inked for
// character c? Top halves hold glyph rows 0-6 at flap rows 2-8, bottom
// halves glyph rows 7-13 at flap rows 0-6; the glyph sits in columns 1-10.
function ink(c, top, x, y) {
  const g = FONT[DRUM[c]];
  if (!g || x < 1 || x > 10) return false;
  const gy = top ? y - 2 : y + 7;
  if (gy < 0 || gy > 13) return false;
  return g[floor(gy / 2) * 5 + floor((x - 1) / 2)] === "#";
}

// The target page as 30 drum positions, and which lines are accent.
function page(set, n) {
  const t = new Int8Array(COLS * ROWS), acc = new Uint8Array(ROWS);
  if (!BOARDS[set]) {
    for (let i = 0; i < COLS * ROWS; i++) t[i] = (1 + i + 5 * n) % NF;
    return { t, acc };
  }
  const pg = BOARDS[set][n % BOARDS[set].length];
  for (let r = 0; r < ROWS; r++) {
    let line = pg[r] || "";
    if (line[0] === "^") {
      acc[r] = 1;
      line = line.slice(1);
    }
    for (let c = 0; c < COLS; c++) {
      const k = DRUM.indexOf(line[c] || " ");
      t[r * COLS + c] = k < 0 ? 0 : k;
    }
  }
  return { t, acc };
}

export function setup(params) {
  const n = COLS * ROWS;
  const S = (params.s = {
    hue: 0, set: -1, pg: 0, hold: 0, cur: new Int8Array(n), tgt: new Int8Array(n), ph: new Float32Array(n),
    wait: new Float32Array(n), rate: new Float32Array(n), lag: new Float32Array(n), acc: new Uint8Array(ROWS),
  });
  for (let i = 0; i < n; i++) {
    S.rate[i] = 0.9 + 0.2 * Math.random();
    S.lag[i] = 0.1 * Math.random();
  }
}

function go(S) {
  const { t, acc } = page(S.set, S.pg);
  for (let i = 0; i < t.length; i++) {
    S.tgt[i] = t[i];
    // A module caught mid-flap finishes it before it waits its turn.
    S.wait[i] = S.ph[i] > 0 ? 0 : floor(i / COLS) * ROWDELAY + S.lag[i];
  }
  S.acc = acc;
  S.hold = HOLD;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const set = cl(floor(k[2] == null ? 0 : k[2]), 0, 3);
  const flap = cl(k[3] == null ? 0.06 : k[3], 0.03, 0.3);
  const d = (cl(dt || 0, 0, 0.1) * speed) / 2;
  if (set !== S.set) {
    S.set = set;
    S.pg = 0;
    go(S);
  }
  let moving = false;
  for (let i = 0; i < S.cur.length; i++) {
    if (S.cur[i] === S.tgt[i] && S.ph[i] === 0) continue;
    moving = true;
    if (S.wait[i] > 0) {
      S.wait[i] -= d;
      continue;
    }
    S.ph[i] += d / (flap * S.rate[i]);
    while (S.ph[i] >= 1) {
      S.cur[i] = (S.cur[i] + 1) % NF;
      S.ph[i] = S.cur[i] === S.tgt[i] ? 0 : S.ph[i] - 1;
    }
  }
  if (!moving) {
    S.hold -= d;
    if (S.hold <= 0) {
      S.pg++;
      go(S);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.set < 0) return;
  const main = hsv(S.hue + 0.12, 0.12, 1), acc = hsv(S.hue + 0.12, 0.85, 1);
  const face = hsv(S.hue + 0.62, 0.3, 0.17);
  const pin = hsv(S.hue + 0.62, 0.2, 0.4);
  // Clear to black: the board between the modules.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  for (let r = 0; r < ROWS; r++) {
    const y0 = 2 + r * (MH + 2), col = S.acc[r] ? acc : main;
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c, x0 = c * (MW + 1), cur = S.cur[i], nxt = (cur + 1) % NF;
      const th = S.ph[i] > 0 ? PI * S.ph[i] * S.ph[i] : 0, ct = cos(th), k = HALF * abs(ct), edge = ceil(k);
      // One LED of a half flap: character ch, top or bottom, brightness b.
      const put = (x, y, ch, top, fy, b) => {
        const on = ink(ch, top, x, fy);
        const base = top ? 1 : 0.82;
        const cc = on ? col : face;
        display.setPixel(x0 + x, y, round(min(1, cc[0] * b * base) * 255), round(min(1, cc[1] * b * base) * 255), round(min(1, cc[2] * b * base) * 255));
      };
      const dark = (x, y, b) => display.setPixel(x0 + x, y, round(face[0] * b * 255), round(face[1] * b * 255), round(face[2] * b * 255));
      for (let x = 0; x < MW; x++) {
        // Top half: rows y0 .. y0 + 8, hinge at y0 + 9; e is the distance
        // from the hinge, 1 next to it and 9 at the top edge.
        for (let fy = 0; fy < HALF; fy++) {
          const y = y0 + fy, e = HALF - fy;
          if (th > 0 && th < PI / 2 && e <= edge) {
            // The falling flap's front, the top half of the old character.
            if (e === edge) dark(x, y, 0.45);
            else put(x, y, cur, true, HALF - min(HALF, ceil(e / ct)), 0.45 + 0.55 * ct);
          } else if (th > 0) {
            // Uncovered: the top half of the next character, in the falling
            // flap's shade until it passes upright.
            put(x, y, nxt, true, fy, th < PI / 2 ? 0.5 + (0.5 * th) / (PI / 2) : 1);
          } else put(x, y, cur, true, fy, 1);
        }
        // The hinge.
        if (x === 0 || x === MW - 1) display.setPixel(x0 + x, y0 + HALF, round(pin[0] * 255), round(pin[1] * 255), round(pin[2] * 255));
        // Bottom half: rows y0 + 10 .. y0 + 18.
        for (let fy = 0; fy < HALF; fy++) {
          const y = y0 + HALF + 1 + fy, e = fy + 1;
          if (th >= PI / 2 && e <= edge) {
            // The falling flap's back, the bottom half of the next character.
            if (e === edge) dark(x, y, 0.45);
            else put(x, y, nxt, false, min(HALF, ceil(e / -ct)) - 1, 0.5 + 0.5 * -ct);
          } else if (th >= PI / 2 && e <= edge + 2) put(x, y, cur, false, fy, 0.55);
          else if (th > 0 && th < PI / 2 && k < 1 && e === 1) dark(x, y, 0.6);
          else put(x, y, cur, false, fy, 1);
        }
      }
    }
  }
}
