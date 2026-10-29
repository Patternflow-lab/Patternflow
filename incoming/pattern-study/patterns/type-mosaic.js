// ===== Patternflow pattern =====
// Title:   Type Mosaic
// Family:  type
// Idea:    A word is spelled one big raised letter at a time on the faces of a turning four-sided prism, lit by a lamp that circles it, and the whole picture is set in small 3 by 5 letters, digits and signs, each cell taking the glyph whose ink matches the brightness there.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Studies in Perception I (Kenneth Knowlton and Leon Harmon, 1966), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..4, Cell=0..2
//
// Knob 1: Hue. Turns the type round the wheel, skipping red-orange to orange, which reads brown when dim. At 0 the letters alternate cyan and pink face by face, their brightest glyphs nearly white, on a face of dim violet dots.
// Knob 2: Speed. At 2 a letter holds 2.2 s and the prism turns a quarter in 0.8 s, so TYPE takes 12 s; the lamp goes round once in 10 s, and each small glyph gives way to another of the same ink every 2.2 to 6.7 s. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Word. The word the prism spells: TYPE at 0, then INK, 1966, LOOK and BELL at 4.
// Knob 4: Cell. The size of the small type. At 0 each glyph has a cell of 4 by 6 LEDs, 336 of them on a 16 by 21 grid; at 1 a cell of 5 by 8, 192 glyphs; at 2 the glyphs are drawn double, 6 by 10 in cells of 7 by 11, and the big letter is set in 99 of them, where the small type reads first and the big letter second.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The small type: a 3 by 5 face drawn for this pattern, rows top to bottom,
// capitals and a few lower case letters with their bowls in the bottom three
// rows. Each glyph's ink is its number of lit dots, 1 to 13 of 15.
const SMALL = {
  ".": "000000000000010", ",": "000000000010100", ":": "000010000010000", "'": "010010000000000",
  "-": "000000111000000", "^": "010101000000000", "_": "000000000000111", ";": "000010000010100",
  '"': "101101000000000", "!": "010010010000010", "~": "000011110000000",
  "+": "000010111010000", x: "000101010101000", "/": "001001010100100", "<": "001010100010001",
  ">": "100010001010100", v: "000000101101010", "\\": "100100010001001",
  "=": "000111000111000", "?": "111001010000010", "%": "101001010100101", J: "001001001101010",
  "7": "111001010010010", T: "111010010010010", L: "100100100100111", C: "011100100100011",
  Y: "101101010010010", S: "011100010001110",
  "1": "010110010010111", F: "111100110100100",
  V: "101101101101010", X: "101101010101101", I: "111010010010111", Z: "111001010100111",
  "4": "101101111001001", G: "011100101101011", N: "110101101101101",
  K: "101101110101101", A: "010101111101101", P: "111101111100100", D: "110101101101110", R: "110101110101101",
  "2": "111001111100111", "3": "111001111001111", "5": "111100111001111", U: "101101101101111",
  H: "101101111101101", "#": "101111101111101", E: "111100111100111", B: "110101111101110",
  "0": "111101101101111", "6": "111100111101111", "9": "111101111001111", M: "101111111101101", W: "101101111111101",
  "8": "111101111101111", Q: "111101101111111", "@": "111101111100111",
  o: "000000111101111", n: "000000110101101", u: "000000101101111", r: "000000011100100",
  c: "000000011100011", h: "100100111101101", b: "100100111101111", d: "001001111101111",
};
const GL = Object.values(SMALL).map((s) => Array.from(s, (c) => c === "1"));
const INK = GL.map((g) => g.filter(Boolean).length);
const MAXINK = max(...INK);
// CLASS[k] lists the glyphs with ink k; an empty class borrows its neighbour.
const CLASS = [];
for (let k = 0; k <= MAXINK; k++) CLASS.push(GL.map((_, i) => i).filter((i) => INK[i] === k));
for (let k = 1; k <= MAXINK; k++) if (!CLASS[k].length) CLASS[k] = CLASS[k - 1].length ? CLASS[k - 1] : CLASS[k + 1];

// The big letters as strokes on the prism face: x across from -18 to 18
// LEDs (stretched 4% below), y down from 12 to 116, each stroke a list of
// points, drawn as round strokes R LEDs in radius.
function arc(cx, cy, rx, ry, a0, a1, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * cos(a), cy + ry * sin(a)]);
  }
  return pts;
}
const HP = PI / 2;
const BIG = {
  T: [[[-18, 12], [18, 12]], [[0, 12], [0, 116]]],
  Y: [[[-18, 12], [0, 62]], [[18, 12], [0, 62]], [[0, 62], [0, 116]]],
  P: [[[-18, 116], [-18, 12]], [[-18, 12], [2, 12], ...arc(2, 38, 16, 26, -HP, HP), [-18, 64]]],
  E: [[[-18, 12], [-18, 116]], [[-18, 12], [18, 12]], [[-18, 62], [12, 62]], [[-18, 116], [18, 116]]],
  I: [[[0, 12], [0, 116]], [[-14, 12], [14, 12]], [[-14, 116], [14, 116]]],
  N: [[[-18, 116], [-18, 12], [18, 116], [18, 12]]],
  K: [[[-18, 12], [-18, 116]], [[18, 12], [-16, 70]], [[-6, 56], [18, 116]]],
  1: [[[-12, 30], [2, 12], [2, 116]], [[-14, 116], [18, 116]]],
  9: [arc(0, 42, 18, 30, 0, 2 * PI, 16), [[18, 42], [18, 86], ...arc(0, 86, 18, 30, 0, HP + 0.6, 6)]],
  6: [arc(0, 86, 18, 30, 0, 2 * PI, 16), [[-18, 86], [-18, 42], ...arc(0, 42, 18, 30, PI, PI + HP + 0.6, 6)]],
  L: [[[-18, 12], [-18, 116], [18, 116]]],
  O: [arc(0, 64, 18, 52, 0, 2 * PI, 24)],
  B: [[[-18, 12], [-18, 116]], [[-18, 12], [2, 12], ...arc(2, 37, 14, 25, -HP, HP, 8), [-18, 62]], [[-18, 62], [4, 62], ...arc(4, 89, 14, 27, -HP, HP, 8), [-18, 116]]],
};
// Each stroke as segments: x0, y0, x1, y1.
const SEG = {}, XS = 1.04;
for (const ch in BIG) {
  const s = [];
  for (const pl of BIG[ch]) for (let i = 0; i + 1 < pl.length; i++) s.push(XS * pl[i][0], pl[i][1], XS * pl[i + 1][0], pl[i + 1][1]);
  SEG[ch] = new Float32Array(s);
}
const WORDS = ["TYPE", "INK", "1966", "LOOK", "BELL"];
// The prism's half width, the stroke's radius, and the cell sizes.
const PW = 30, R = 12;
const CELLS = [
  { cw: 4, ch: 6, sc: 1 },
  { cw: 5, ch: 8, sc: 1 },
  { cw: 7, ch: 11, sc: 2 },
];

// Distance from (x, y) to the nearest stroke, and the unit vector from the
// stroke out to the point, written to out.
function dist(seg, x, y, out) {
  let best = 1e9, bx0 = 0, by0 = 0;
  for (let i = 0; i < seg.length; i += 4) {
    const ax = seg[i], ay = seg[i + 1], bx = seg[i + 2] - ax, by = seg[i + 3] - ay;
    const px = x - ax, py = y - ay, L = bx * bx + by * by;
    const t = L > 0 ? cl((px * bx + py * by) / L, 0, 1) : 0;
    const dx = px - t * bx, dy = py - t * by, d = dx * dx + dy * dy;
    if (d < best) { best = d; bx0 = dx; by0 = dy; }
  }
  const d = sqrt(best);
  out[0] = d;
  out[1] = d > 1e-6 ? bx0 / d : 0;
  out[2] = d > 1e-6 ? by0 / d : 0;
  return d;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, word: 0, cell: 0, seed: new Float32Array(1024), rate: new Float32Array(1024), rgb: [0, 0, 0], dd: [0, 0, 0] };
  for (let i = 0; i < 1024; i++) {
    params.s.seed[i] = Math.random() * 64;
    params.s.rate[i] = 0.15 + 0.3 * Math.random();
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.t += cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) / 2;
  S.word = cl(round(k[2]), 0, WORDS.length - 1);
  S.cell = cl(round(k[3]), 0, CELLS.length - 1);
}

// The prism turns a quarter at a time: each letter holds HOLD units, then
// turns away to the left while the next comes in from the right.
const HOLD = 2.2, TURN = 0.8, PER = HOLD + TURN;
// The lamp stands 40 degrees off the face's normal and goes round it once
// in LAMP units of the clock, from the upper left at the start.
const LS = 0.64, LZ = 0.77, LAMP = 10, SH = 8;
const ease = (u) => u * u * (3 - 2 * u);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const word = WORDS[S.word], n = floor(S.t / PER), s = S.t - n * PER;
  const phi = s < HOLD ? 0 : ease((s - HOLD) / TURN) * HP;
  const faces = [
    { a: -phi, ch: word[n % word.length], k: n },
    { a: HP - phi, ch: word[(n + 1) % word.length], k: n + 1 },
  ];
  const az = -0.75 * PI + (2 * PI * S.t) / LAMP, LX = LS * cos(az), LY = LS * sin(az);
  const shx = -SH * LX, shy = -SH * LY;
  for (const f of faces) {
    f.c = cos(f.a);
    f.x0 = PW * sin(f.a);
    // The light in the face's own frame: x along the face, z out of it.
    f.lx = LX * cos(f.a) - LZ * sin(f.a);
    f.lz = LX * sin(f.a) + LZ * cos(f.a);
    f.seg = SEG[f.ch];
  }
  const { cw, ch, sc } = CELLS[S.cell];
  const cols = floor(W / cw), rows = floor(H / ch);
  const ox = floor((W - cols * cw) / 2), oy = floor((H - rows * ch) / 2);
  const rgb = S.rgb, h = S.hue, dd = S.dd;
  const wheel = (f) => 0.11 + 0.89 * (f - floor(f));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = ox + c * cw + (cw - 1) / 2 - 31.5, cy = oy + r * ch + (ch - 1) / 2;
      // Which face of the prism this cell sees, and where on it.
      let face = null, u = 0;
      for (const f of faces) {
        if (f.c <= 0.001) continue;
        const uu = (cx - f.x0) / (PW * f.c);
        if (uu >= -1 && uu <= 1) { face = f; u = uu; break; }
      }
      if (!face) continue;
      const fx = u * PW, d = dist(face.seg, fx, cy, dd);
      let tone, letter = false;
      if (d < R) {
        // A round stroke: its normal leans out from the stroke's spine.
        const q = d / R, nz = sqrt(1 - q * q);
        const diff = max(0, q * (dd[1] * face.lx + dd[2] * LY) + nz * face.lz);
        tone = 0.18 + 0.82 * diff;
        letter = true;
      } else {
        // The flat face, lighter at the top, and the stroke's shadow on it.
        tone = (0.05 + 0.2 * (1 - cy / H)) * (0.3 + max(0, face.lz));
        if (dist(face.seg, fx - shx, cy - shy, dd) < R) tone *= 0.15;
      }
      let ink = round(tone * MAXINK);
      if (ink < 1) continue;
      ink = min(MAXINK, ink);
      const cls = CLASS[ink], id = r * 32 + c;
      const g = GL[cls[floor(S.seed[id] + S.t * S.rate[id]) % cls.length]];
      if (letter) hsv(wheel(h + 0.44 + 0.38 * (face.k % 2)), 0.9 - 0.6 * tone, 1, rgb);
      else hsv(wheel(h + 0.68), 0.8, 0.5, rgb);
      const gx = ox + c * cw, gy = oy + r * ch;
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 3; i++)
          if (g[j * 3 + i])
            for (let yy = 0; yy < sc; yy++)
              for (let xx = 0; xx < sc; xx++) display.setPixel(gx + i * sc + xx, gy + j * sc + yy, rgb[0] | 0, rgb[1] | 0, rgb[2] | 0);
    }
}
