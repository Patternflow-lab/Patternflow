// ===== Patternflow pattern =====
// Title:   UTF-8 Bytes
// Family:  type
// Idea:    One character at a time stands as a pixel glyph over its code point in binary, the bytes UTF-8 spells it in are laid down the tall panel as rows of eight cells with the fixed prefix bits (0, 110, 1110, 11110 and the 10 of each later byte) lit in one colour and the x slots empty, and the payload bits of the code point fly one by one into the slots in order, each byte showing its hex when its last slot is filled.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: UTF-8 (Ken Thompson and Rob Pike, 1992, from memory), its template of one to four bytes and the Unicode code points it carries; the 3 by 5 digits of Edit Distance (pattern round 110), copied from edit-distance.js; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..4, Char=0..5, Bits=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the prefix bits are pale amber, the payload bits cyan, the glyph pale pink, the hex of a finished byte near white and the code point cyan with a dim U+. Amber is made paler so it does not dim to brown.
// Knob 2: Speed. How fast the round runs, 2 being the speed it was timed at: the glyph and the bits come in over 0.7 s, the template rows follow 0.2 s apart, then a bit leaves every 0.13 s and takes 0.5 s to land, so the 21 bits of a four-byte character are in by 5 s, and the bytes are read down in turn for 3 s before the round fades for 0.4 s. A round is 8.3 s at 2 for the 4-byte characters, 7.5 s for 3 bytes, 6.6 s for 2 and 5.9 s for the 1-byte A. 0.4 is five times slower and 4 twice as fast.
// Knob 3: Char. Which character, one step a turn and whole numbers: 0 the treble clef U+1D11E (4 bytes, where it opens), 1 A U+0041 (1 byte), 2 e with an acute accent U+00E9 (2 bytes), 3 the euro sign U+20AC (3 bytes), 4 the Hangul syllable han U+D55C (3 bytes) and 5 the grinning face U+1F600 (4 bytes). The byte rows stay at the bottom of the panel and grow upward, 13 LEDs each, so the glyph gets what is left: 6 LEDs to a glyph pixel for A, e and the euro sign, 4 for han, 3 for the face and 2 for the clef.
// Knob 4: Bits. How a bit is written. At 0 every bit is a printed 0 or 1, 6 by 10 LEDs in its cell; at 1 the digits are gone and a 1 is a lit cell, a 0 a dark one, so each byte reads as a row of eight lamps. Between, the digits fade out by 0.7 and the lamps come up with them.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, PI } = Math;
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
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v) {
  const f = fr(h), out = [0, 0, 0];
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
  return out;
}

// The digits and the capitals A to F, 3 wide and 5 tall, copied from edit-distance.js, with
// U and a plus for the code point and a small x for a slot not yet filled.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", U: "#.#|#.#|#.#|#.#|###", "+": "...|.#.|###|.#.|...", x: "...|#.#|.#.|#.#|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The six characters, drawn by hand on a grid of their own, one string a row. Each is
// shown at the whole-number scale that fits the room the byte rows leave.
const CLEF = [
  ".......##....", "......#.#....", "......#.#....", "......#.#....", ".....##.#....", ".....#.##....", "....##.#.....", "....#..#.....",
  "...#...#.....", "...#.#####...", "..#..#.#.#...", "..#..#.#..#..", "..#..###..#..", "..##...#.##..", "...##..#.#...", "....######...",
  "......##.....", "...##.##.....", "...#..#......", "...####......",
];
const LET_A = ["..###..", ".#...#.", "#.....#", "#.....#", "#######", "#.....#", "#.....#", "#.....#", "#.....#"];
const LET_E = ["...##...", "..##....", "........", ".#####..", "#.....#.", "#.....#.", "#######.", "#.......", "#.....#.", ".#####.."];
const EURO = ["...####..", "..#....#.", ".#.......", "######...", ".#.......", "######...", ".#.......", "..#....#.", "...####.."];
const HAN = [
  "....#.....#..", "....#.....#..", ".#######..#..", "...###....###", "..#...#...#..", "..#...#...#..", "...###....#..", "..........#..",
  ".............", "...#.........", "...#.........", "...#.........", "...#########.",
];
const FACE_G = [
  "....#####....", "..#########..", ".###########.", ".###########.", "####.###.####", "####.###.####", "#############", "##.#######.##",
  "###.......###", ".####...####.", ".###########.", "..#########..", "....#####....",
];
// The list, in the order the knob steps through it: it opens on a four-byte character.
const LIST = [
  { cp: 0x1d11e, g: CLEF },
  { cp: 0x41, g: LET_A },
  { cp: 0xe9, g: LET_E },
  { cp: 0x20ac, g: EURO },
  { cp: 0xd55c, g: HAN },
  { cp: 0x1f600, g: FACE_G },
];

// UTF-8 as its inventors drew it: a template for each length, the x slots
// filled in order with the code point's bits, most significant first.
const TPL = [
  ["0xxxxxxx"],
  ["110xxxxx", "10xxxxxx"],
  ["1110xxxx", "10xxxxxx", "10xxxxxx"],
  ["11110xxx", "10xxxxxx", "10xxxxxx", "10xxxxxx"],
];

// The bytes of a code point, built the way the picture builds them: pick the template by
// the size of the code point, write its bits padded with zeros to fill every slot, and
// pour them into the slots. Each cell of each row says whether it is template or payload,
// its bit, and for a payload bit its place in the stream.
function model(cp) {
  const nb = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4, tpl = TPL[nb - 1];
  let P = 0;
  for (const row of tpl) for (const ch of row) if (ch === "x") P++;
  const bin = cp.toString(2), pad = P - bin.length, bits = "0".repeat(pad) + bin;
  const rows = [], slots = [];
  let k = 0;
  for (let i = 0; i < nb; i++) {
    const cells = [];
    let val = 0;
    for (let j = 0; j < 8; j++) {
      const ch = tpl[i][j];
      let bit;
      if (ch === "x") {
        bit = bits.charCodeAt(k) - 48;
        cells.push({ t: 0, bit, k });
        slots.push([i, j]);
        k++;
      } else {
        bit = ch === "1" ? 1 : 0;
        cells.push({ t: 1, bit, k: -1 });
      }
      val = val * 2 + bit;
    }
    rows.push({ cells, byte: val, last: k - 1 });
  }
  return { cp, nb, P, pad, bits, rows, slots, bytes: rows.map((r) => r.byte) };
}

const HEXD = "0123456789ABCDEF";
const hex2 = (v) => HEXD[v >> 4] + HEXD[v & 15];

const CELL_H = 12, PITCH = 13, GAP = 0.13, FLY = 0.5, LEAD = 0.7, HOLD = 3, OUT = 0.4;

// Where everything stands for a character of nb bytes: byte rows from the bottom up, the
// bits of the code point above them in one or two lines, the U+ label, and what is left
// at the top for the glyph.
function layout(m, g) {
  const rowTop = (i) => 112 - (m.nb - 1 - i) * PITCH;
  const nbr = m.P > 11 ? 2 : 1, per = Math.ceil(m.P / nbr), bp = min(8, floor(60 / per));
  const bx0 = floor((W - ((per - 1) * bp + 3)) / 2), by0 = rowTop(0) - 8 - (5 + 7 * (nbr - 1));
  const lblY = by0 - 9, gy1 = lblY - 4, gh = g.length, gw = g[0].length;
  const s = max(1, min(6, floor(58 / gw), floor((gy1 + 1) / gh)));
  return { rowTop, per, bp, bx0, by0, lblY, gx: floor((W - gw * s) / 2), gy: floor((gy1 + 1 - gh * s) / 2), gs: s };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, ci: -1, bits: 0.06, tau: 0, m: null, L: null, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.4, 4);
  S.bits = cl(k[3], 0, 1);
  const ci = cl(round(k[2]), 0, LIST.length - 1);
  if (ci !== S.ci) {
    S.ci = ci;
    S.m = model(LIST[ci].cp);
    S.L = layout(S.m, LIST[ci].g);
    S.tau = 0;
  }
  // The round runs on its own clock, so that one second at speed 2 is one second of the schedule.
  const M = S.m, tc = LEAD + M.nb * 0.2 + 0.3 + (M.P - 1) * GAP + FLY;
  S.tc = tc;
  S.tl = tc + HOLD;
  S.tau += (d * S.speed) / 2;
  if (S.tau >= S.tl + OUT) S.tau = 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.m) return;
  const buf = S.buf, M = S.m, L = S.L, g = LIST[S.ci].g, tau = S.tau, kb = S.bits;
  buf.fill(0);
  const put = (x, y, c, a) => {
    x = round(x);
    y = round(y);
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3, b = 1 - min(1, a);
    buf[o] = buf[o] * b + c[0] * min(1, a);
    buf[o + 1] = buf[o + 1] * b + c[1] * min(1, a);
    buf[o + 2] = buf[o + 2] * b + c[2] * min(1, a);
  };
  const rect = (x, y, w, h, c, a) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a);
  };
  const glyph = (ch, x, y, c, a, sc = 1) => {
    const gl = GLYPH[ch];
    if (!gl || a <= 0) return;
    for (let p = 0; p < 15; p++) if (gl[p]) rect(x + (p % 3) * sc, y + floor(p / 3) * sc, sc, sc, c, a);
  };
  const mix = (c1, c2, f) => [c1[0] + (c2[0] - c1[0]) * f, c1[1] + (c2[1] - c1[1]) * f, c1[2] + (c2[2] - c1[2]) * f];

  const WHITE = [1, 1, 1], TPLC = tint(0.1 + S.hue, 0.6, 1), PAYC = tint(0.52 + S.hue, 0.75, 1);
  const GLC = tint(0.93 + S.hue, 0.22, 1), HEXC = tint(0.6 + S.hue, 0.14, 1);
  const gf = 1 - sm((tau - S.tl) / OUT);
  const ease = (v) => sm(v);

  // The glyph, at the scale the room allows, and the code point under it.
  {
    const a = sm(tau / 0.6) * gf, gs = L.gs;
    const gw = g[0].length, mask = new Uint8Array((gw * gs + 4) * (g.length * gs + 4));
    const mw = gw * gs + 4;
    for (let j = 0; j < g.length; j++)
      for (let i = 0; i < gw; i++)
        if (g[j][i] === "#") {
          rect(L.gx + i * gs, L.gy + j * gs, gs, gs, GLC, a);
          for (let v = 0; v < gs; v++) for (let u = 0; u < gs; u++) mask[(j * gs + v + 2) * mw + i * gs + u + 2] = 1;
        }
    // A glow of one LED round every lit one, so a thin stroke stands out of the dark.
    for (let y = 0; y < g.length * gs + 4; y++)
      for (let x = 0; x < mw; x++) {
        if (mask[y * mw + x]) continue;
        let near = 0;
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) if (mask[(y + v) * mw + x + u] && x + u >= 0 && x + u < mw) near = 1;
        if (near) put(L.gx + x - 2, L.gy + y - 2, GLC, 0.27 * a);
      }
    const lab = "U+" + M.cp.toString(16).toUpperCase().padStart(4, "0");
    const lw = lab.length * 4 - 1;
    let x = floor((W - lw) / 2);
    for (let i = 0; i < lab.length; i++) {
      glyph(lab[i], x, L.lblY, PAYC, (i < 2 ? 0.5 : 1) * a);
      x += 4;
    }
  }

  // When each payload bit leaves the code point and lands in its slot.
  const t0 = LEAD + M.nb * 0.2 + 0.3, depart = (k) => t0 + k * GAP;
  const slotXY = (k) => [M.slots[k][1] * 7 + 3, L.rowTop(M.slots[k][0]) + 6];
  const srcXY = (k) => [L.bx0 + (k % L.per) * L.bp + 1, L.by0 + floor(k / L.per) * 7 + 2];
  // A bit: a digit, or at high Bits a square for a 1 and a dot for a 0. sc 2 is the size in a cell.
  const small = (bit, x, y, c, a, sc = 1) => {
    if (kb < 0.5) glyph(String(bit), round(x) - sc, round(y) - 2 * sc, c, a, sc);
    else if (bit) rect(round(x) - sc, round(y) - sc, 1 + 2 * sc, 1 + 2 * sc, c, a);
    else rect(round(x), round(y), sc, sc, c, a * 0.7);
  };

  // The bits of the code point, in a line or two, the zeros it is padded with dim.
  {
    const a = sm((tau - 0.2) / 0.5) * gf;
    for (let k = 0; k < M.P; k++) {
      const f = (tau - depart(k)) / FLY, [sx, sy] = srcXY(k), bit = M.bits.charCodeAt(k) - 48;
      const pad = k < M.pad;
      const base = pad ? 0.4 : 1;
      if (f < 0) small(bit, sx, sy, PAYC, a * base);
      else if (f < 1) small(bit, sx, sy, PAYC, a * 0.14);
      else small(bit, sx, sy, PAYC, a * 0.14);
    }
    // The next bit to go has a small bracket over it.
    const nxt = floor((tau - t0) / GAP) + 1;
    if (tau >= t0 - GAP && nxt >= 0 && nxt < M.P) {
      const [sx, sy] = srcXY(nxt);
      for (let i = -2; i <= 2; i++) put(sx + i, sy + 4, WHITE, 0.6 * a);
    }
  }

  // The byte rows.
  const sweep = max(0, tau - S.tc) * 2.5 % (M.nb + 2);
  for (let i = 0; i < M.nb; i++) {
    const y = L.rowTop(i), row = M.rows[i], ra = sm((tau - (LEAD + i * 0.2)) / 0.3) * gf;
    const done = depart(row.last) + FLY, hot = tau >= S.tc ? max(0, 1 - abs(sweep - (i + 0.5)) * 1.2) : 0;
    for (let j = 0; j < 8; j++) {
      const c = row.cells[j], x = j * 7;
      if (c.t) {
        // A prefix bit: always there, in the template colour.
        const fa = 0.2 + (c.bit ? 0.7 * sm(kb) : -0.12 * sm(kb)), da = (1 - sm(kb / 0.7)) * 0.95;
        rect(x, y, 6, CELL_H, TPLC, ra * (fa + hot * 0.35));
        glyph(String(c.bit), x, y + 1, mix(TPLC, WHITE, hot * 0.6), ra * da, 2);
      } else {
        const f = (tau - depart(c.k)) / FLY;
        if (f < 1) {
          // An empty slot: a faint cell and a small x.
          rect(x, y, 6, CELL_H, PAYC, ra * 0.1);
          glyph("x", x, y + 1, PAYC, ra * 0.5, 2);
        } else {
          const land = cl(1 - (tau - depart(c.k) - FLY) / 0.35, 0, 1);
          const fa = 0.22 + (c.bit ? 0.7 * sm(kb) : -0.14 * sm(kb)) + hot * 0.35, da = (1 - sm(kb / 0.7)) * 0.95;
          const col = mix(PAYC, WHITE, max(land * 0.85, hot * 0.6));
          rect(x, y, 6, CELL_H, col, ra * min(1, fa + land * 0.5));
          glyph(String(c.bit), x, y + 1, col, ra * da, 2);
        }
      }
    }
    // The byte in hex, once its last slot is filled.
    if (tau >= done) {
      const ha = sm((tau - done) / 0.2) * gf, h = hex2(row.byte), fl = cl(1 - (tau - done) / 0.4, 0, 1);
      const col = mix(HEXC, WHITE, fl * 0.7 + hot * 0.6);
      glyph(h[0], 57, y + 3, col, ha);
      glyph(h[1], 61, y + 3, col, ha);
    }
  }

  // The bits in flight, last so that they cross the rows.
  for (let k = 0; k < M.P; k++) {
    const f = (tau - depart(k)) / FLY;
    if (f <= 0 || f >= 1) continue;
    const [sx, sy] = srcXY(k), [dx, dy] = slotXY(k), bit = M.bits.charCodeAt(k) - 48;
    for (let tr = 4; tr >= 0; tr--) {
      const ff = cl(f - tr * 0.045, 0, 1), e = ease(ff), bend = sin(PI * ff) * (dx < sx ? -5 : 5);
      const px = sx + (dx - sx) * e + bend, py = sy + (dy - sy) * e;
      if (tr === 0) small(bit, px, py, mix(PAYC, WHITE, 0.6), gf, f > 0.6 ? 2 : 1);
      else put(px, py, PAYC, (0.5 - tr * 0.1) * gf);
    }
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
