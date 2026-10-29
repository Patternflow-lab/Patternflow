// ===== Patternflow pattern =====
// Title:   Boustrophedon
// Family:  type
// Idea:    A plough point of light works a field of twenty furrows line after line, turning up last pass's dimming letters ahead of it and writing Hesiod's crane passage into the furrow behind it, mirrored on the lines it ploughs back, so the eye follows the ox across the panel and down.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: boustrophedon, the archaic Greek way of writing as the ox turns (the law code of Gortyn, 5th century BC), reverse boustrophedon as in rongorongo; text from Hesiod, Works and Days 448-451, translated by Hugh G. Evelyn-White (1914); pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Way=-1..1, Words=0..2
//
// Knob 1: Hue. Turns the field and the letters round the wheel together: at 0 the furrows run from deep blue in the troughs to pale blue on the ridges, fresh letters are cream gold and old ones cool to pale blue.
// Knob 2: Speed. How fast the plough writes: 8 letters a second at 2, so a line of 15 takes under 2 s and the whole field of 300 about 40 s; 0.8 a second at 0.2, 12 at 3.
// Knob 3: Way. How the plough turns at the end of a line, taken up at the start of the next one. At 0 boustrophedon: the plough turns and writes the next line right to left with every letter mirrored. At -1 every line runs left to right and the plough lifts and flies back to the left edge. At 1 reverse boustrophedon, as on the rongorongo tablets: the return lines are turned upside down, as if the field were turned round for each.
// Knob 4: Words. How words are parted. At 0 by a column of three dots, the word divider of many archaic inscriptions; at 1 not at all, the letters run on as scriptio continua; at 2 by a blank, as we write now.

const W = 64, H = 128;
const { floor, round, min, max, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Capitals, 3 by 5, rows from the top. Archaic inscriptions were cut in
// capitals with no small letters. Glyph 26 is the word divider, three dots in
// a column; 27 is a blank.
const GLYPHS = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111",
  "111100110100100", "011100101101011", "101101111101101", "111010010010111", "001001001101010",
  "101101110101101", "100100100100111", "101111111101101", "111101101101101", "010101101101010",
  "110101110100100", "010101101110011", "110101110101101", "011100010001110", "111010010010010",
  "101101101101111", "101101101101010", "101101111111101", "101101010101101", "101101010010010",
  "111001010100111", "010000010000010", "000000000000000",
];
const FONT = GLYPHS.map((g) => Uint8Array.from(g, (c) => +c));
const DIV = 26, BLANK = 27;

// Hesiod, Works and Days 448-451, in Evelyn-White's translation: "Mark, when
// you hear the voice of the crane who cries year by year from the clouds
// above, for she gives the signal for ploughing and shows the season of rainy
// winter; but she vexes the heart of the man who has no oxen." The stone has
// no commas: only letters and word breaks are kept, and the end of the
// sentence is one more word break before it starts again.
const SRC =
  "MARK WHEN YOU HEAR THE VOICE OF THE CRANE WHO CRIES YEAR BY YEAR FROM THE CLOUDS ABOVE FOR SHE GIVES THE SIGNAL FOR PLOUGHING AND SHOWS THE SEASON OF RAINY WINTER BUT SHE VEXES THE HEART OF THE MAN WHO HAS NO OXEN ";
// The text as cells for each way of parting words, and where each cell came
// from in SRC, so turning Words mid-line carries on from the same place.
const SEQ = [[], [], []], SPOS = [[], [], []];
for (let m = 0; m < 3; m++)
  for (let i = 0; i < SRC.length; i++) {
    const ch = SRC[i];
    if (ch === " ") {
      if (m === 1) continue;
      SEQ[m].push(m === 0 ? DIV : BLANK);
    } else SEQ[m].push(ch.charCodeAt(0) - 65);
    SPOS[m].push(i);
  }

// ---- The field. 15 letters a line, 4 LEDs a cell (3 and a gap), from x = 2;
// 20 lines 6 rows apart from y = 4, the letter in the 5 rows of the furrow
// and the ridge in the sixth. The furrows run on into the 4-row margins.
const NC = 15, NL = 20, CW = 4, LP = 6, X0 = 2, Y0 = 4, CELLS = NC * NL;
// Across a furrow the ground climbs and falls by D a row, trough in the
// middle of the letter, ridge between lines. Along it the soil is grained a
// column at a time, so every pair of neighbours differs a little.
const LO = 6, D = 24;
const TRI = [2, 1, 0, 1, 2, 3];
const ROWB = new Float32Array(H), ROWT = new Float32Array(H);
for (let y = 0; y < H; y++) {
  const r = (((y - Y0) % LP) + LP) % LP;
  ROWB[y] = LO + D * TRI[r];
  ROWT[y] = TRI[r] / 3;
}
const GRAIN = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) {
  let h = (p * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  GRAIN[p] = (p % W) & 1 ? 20 + 10 * h : 6 * h;
}

// Letters: fresh ones stand C_NEW above the trough and cool to C_OLD as the
// pass goes on; they keep part of the furrow's shape and all of its grain.
const C_NEW = 226, C_OLD = 216, TAU = 30, KEEP_SHAPE = 0.33, KEEP_GRAIN = 0.7;

// Cells a second at Speed s; a turn costs one cell's time, the flight back
// to the left edge three.
const RATE = 4;
// Light of the share's point and of the turned soil behind it.
const SHARE = 220, WAKE = 60;
const turnLen = (way) => (way < 0 ? 3 : 1);
// Direction and orientation of grid line l written the given way:
// orientation 0 upright, 1 mirrored, 2 turned 180 degrees.
const dirOf = (way, l) => (way !== 0 && way !== 1) || l % 2 === 0 ? 1 : -1;
const orientOf = (way, l) => (dirOf(way, l) > 0 ? 0 : way === 0 ? 1 : 2);

export function setup(params) {
  params.s = {
    t: 0, ready: false, hue: 0, speed: 2, way: 0, words: 0,
    line: 0, pos: 0, lineWay: 0, j: 0, cell: -1,
    glyph: new Uint8Array(CELLS), orient: new Uint8Array(CELLS), birth: new Float32Array(CELLS),
    // What lay in the cell under the plough before it got there.
    oldG: 0, oldO: 0, oldB: 0,
    L: new Float32Array(W * H), rgb: new Float32Array(W * H * 3),
  };
}

// Grid cell of in-line step i on grid line l, written in direction dir.
const cellAt = (l, i, dir) => l * NC + (dir > 0 ? i : NC - 1 - i);

// The field the plough finds when it starts: the pass before, written the
// same way, ending with the cells just before the opening words, its oldest
// letters already cooled.
function prefill(S) {
  const seq = SEQ[S.words], P = seq.length, rate = RATE * S.speed;
  const per = NC + turnLen(S.way);
  for (let l = 0; l < NL; l++) {
    const dir = dirOf(S.way, l), o = orientOf(S.way, l);
    for (let i = 0; i < NC; i++) {
      const k = l * NC + i, c = cellAt(l, i, dir);
      S.glyph[c] = seq[(((k - CELLS) % P) + P) % P];
      S.orient[c] = o;
      S.birth[c] = -(NL * per - (l * per + i)) / rate;
    }
  }
  S.j = 0;
  S.lineWay = S.way;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.way = cl(round(k[2]), -1, 1);
  const words = cl(round(k[3]), 0, 2);
  if (words !== S.words) {
    // Carry on from the same place in the sentence with the new parting.
    const from = SPOS[S.words][S.j % SPOS[S.words].length];
    const sp = SPOS[words];
    let j = 0;
    while (j < sp.length && sp[j] < from) j++;
    S.j = j % sp.length;
    S.words = words;
  }
  if (!S.ready) {
    prefill(S);
    S.ready = true;
  }
  S.t += d;
  S.pos += d * RATE * S.speed;
  const end = NC + turnLen(S.lineWay);
  if (S.pos >= end) {
    S.pos -= end;
    S.line++;
    S.lineWay = S.way;
    S.cell = -1;
  }
  const l = S.line % NL, i = floor(S.pos);
  if (i < NC) {
    const c = cellAt(l, i, dirOf(S.lineWay, l));
    if (c !== S.cell) {
      // The share reaches a new cell: what was there is turned under as the
      // next letter of the text goes in.
      S.cell = c;
      S.oldG = S.glyph[c], S.oldO = S.orient[c], S.oldB = S.birth[c];
      const seq = SEQ[S.words];
      S.glyph[c] = seq[S.j % seq.length];
      S.j = (S.j + 1) % seq.length;
      S.orient[c] = orientOf(S.lineWay, l);
      S.birth[c] = S.t;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const { L, rgb } = S, t = S.t, hue = S.hue;
  const trough = hsv(0.66 + hue, 0.78, 1), ridge = hsv(0.55 + hue, 0.42, 1);
  const fresh = hsv(0.12 + hue, 0.38, 1), cool = hsv(0.6 + hue, 0.5, 1);

  // Cloud shadows drift over the field from the upper left.
  const cx = 0.07, cy = 0.045, wx = 0.035, wy = -0.06;
  const ca = t * 0.9, cb = t * 0.7 + 1.7;

  for (let y = 0; y < H; y++) {
    const base = ROWB[y], tt = ROWT[y];
    let r0 = trough[0] + (ridge[0] - trough[0]) * tt, g0 = trough[1] + (ridge[1] - trough[1]) * tt, b0 = trough[2] + (ridge[2] - trough[2]) * tt;
    const m = max(r0, g0, b0);
    (r0 /= m), (g0 /= m), (b0 /= m);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const cloud = 0.81 + 0.095 * (sin(cx * x + cy * y - ca) + sin(wx * x + wy * y + cb));
      const v = (base + GRAIN[p]) * cloud;
      L[p] = cloud;
      rgb[p * 3] = r0 * v, rgb[p * 3 + 1] = g0 * v, rgb[p * 3 + 2] = b0 * v;
    }
  }

  // The plough: where it is along the current line, and the column of the
  // cell it is in that its share has reached.
  const l = S.line % NL, dir = dirOf(S.lineWay, l), i = floor(S.pos), f = S.pos - i;
  for (let c = 0; c < CELLS; c++) {
    const col = c % NC, row = floor(c / NC), x0 = X0 + col * CW, y0 = Y0 + row * LP;
    const under = c === S.cell && i < NC;
    for (let q = 0; q < 3; q++) {
      // Under the plough, columns it has passed show the new letter and the
      // rest the old one.
      let g = S.glyph[c], o = S.orient[c], b = S.birth[c];
      if (under) {
        const u = dir > 0 ? (q + 0.5) / CW : (CW - 0.5 - q) / CW;
        if (u >= f) (g = S.oldG), (o = S.oldO), (b = S.oldB);
      }
      const gl = FONT[g], age = t - b, w = exp(-age / TAU);
      const lvl = C_OLD + (C_NEW - C_OLD) * w, glint = age < 0.5 ? 40 * (1 - age / 0.5) : 0;
      const cr = cool[0] + (fresh[0] - cool[0]) * w, cg = cool[1] + (fresh[1] - cool[1]) * w, cb2 = cool[2] + (fresh[2] - cool[2]) * w;
      const cm = max(cr, cg, cb2);
      for (let r = 0; r < 5; r++) {
        const sq = o === 0 ? q : 2 - q, sr = o === 2 ? 4 - r : r;
        if (!gl[sr * 3 + sq]) continue;
        const y = y0 + r, x = x0 + q, p = y * W + x;
        const v = min(255, lvl + glint + KEEP_SHAPE * (ROWB[y] - LO) + KEEP_GRAIN * GRAIN[p]);
        rgb[p * 3] = (cr / cm) * v, rgb[p * 3 + 1] = (cg / cm) * v, rgb[p * 3 + 2] = (cb2 / cm) * v;
      }
    }
  }

  // The point of the share, a warm light in the furrow, and the turned soil
  // behind it glowing for a few cells. On the flight back to the left edge
  // the share is lifted and dim.
  let tx, ty, a = 1, wake = 1, wx0;
  const yl = Y0 + l * LP + 2;
  if (i < NC) {
    const col = dir > 0 ? i : NC - 1 - i;
    tx = X0 + col * CW + (dir > 0 ? f * CW : (1 - f) * CW);
    ty = yl;
    wx0 = tx;
  } else {
    const u = (S.pos - NC) / turnLen(S.lineWay), sm = u * u * (3 - 2 * u);
    const nl = (l + 1) % NL, xe = dir > 0 ? X0 + NC * CW : X0;
    const xs = S.lineWay < 0 ? X0 : dirOf(S.lineWay, nl) > 0 ? X0 : X0 + NC * CW;
    const ny = Y0 + nl * LP + 2;
    tx = xe + (xs - xe) * sm;
    ty = yl + (ny - yl) * sm;
    wx0 = xe;
    wake = 1 - u;
    if (S.lineWay < 0) a = 0.35 + 0.65 * Math.abs(1 - 2 * u);
  }
  const lamp = hsv(0.1 + hue, 0.3, 1), soil = hsv(0.07 + hue, 0.55, 1);
  for (let y = yl - 2; y <= yl + 3; y++) {
    const rw = y === yl + 3 ? 0.5 : 1;
    for (let x = 0; x < W; x++) {
      const ahead = (x + 0.5 - wx0) * dir;
      const v = WAKE * wake * rw * (ahead > 0 ? exp(-ahead * ahead) : exp(ahead / 7));
      if (v < 1) continue;
      const p = (y * W + x) * 3;
      rgb[p] += soil[0] * v, rgb[p + 1] += soil[1] * v, rgb[p + 2] += soil[2] * v;
    }
  }
  const x0 = max(0, floor(tx - 9)), x1 = min(W - 1, floor(tx + 9)), y0 = max(0, floor(ty - 9)), y1 = min(H - 1, floor(ty + 9));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - tx, dy = y + 0.5 - ty, r2 = dx * dx + dy * dy;
      const v = a * (SHARE * exp(-r2 / 1.8) + 50 * exp(-r2 / 30));
      const p = (y * W + x) * 3;
      rgb[p] += lamp[0] * v, rgb[p + 1] += lamp[1] * v, rgb[p + 2] += lamp[2] * v;
    }

  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), min(255, rgb[p * 3]) | 0, min(255, rgb[p * 3 + 1]) | 0, min(255, rgb[p * 3 + 2]) | 0);
}
