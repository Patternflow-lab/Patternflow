// ===== Patternflow pattern =====
// Title:   Pigpen
// Family:  type
// Idea:    The four key shapes of the pigpen cipher stand in a column down the left of the panel, a message is spelled letter by letter by lighting each letter's cell, and the lines that bound the cell lift off the grid and fly across into a stack of symbols that builds on the right, until a light runs back from each symbol to the cell it came from and reads the message out, with every symbol turning when the key is turned.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pigpen cipher, the Freemasons' cipher (no inventor named, in use by the 18th century, year from memory; the order of the four wedges of an X is from memory too); the 3 by 5 capitals of Edit Distance (pattern round 110), copied from edit-distance.js; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Message=0..3, Turn=0..180
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the first grid (A to I) is cyan, the grid with dots (J to R) is azure, the first X (S to V) is magenta and the X with dots (W to Z) is pink, and a lit cell is pale. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Speed. How fast the message is spelled and read. At 2 a letter is lit every 0.34 s, its lines fly for 0.62 s and the reading takes 0.27 s a letter: MEET AT THE LODGE has landed by 6.1 s, is read by 11.3 s and starts over at 12.8 s. At 0.5 everything takes four times as long, at 4 half as long.
// Knob 3: Message. Which message, snapping at whole numbers: 0 MEET AT THE LODGE (14 letters, where it opens), 1 A QUICK BROWN FOX (14), 2 SQUARE AND COMPASS (16), 3 HIDDEN IN PLAIN SIGHT (18). The stack runs three symbols to a row, the rows 18 LEDs apart (17 for the last message, which needs seven), and a space is an empty place. Changing it starts that message over.
// Knob 4: Turn. How far the key is turned, from 0 to 180 degrees. The four shapes turn about their centres and every symbol in the stack turns the same way, because the cipher is the same cipher at any angle: only which symbol stands for which letter changes. At 90 degrees A looks the way C did, at 180 the way I did. The letters stay upright, and fade while the cell they sit in is slanted.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sin, cos, PI } = Math;
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
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
}

// The 3 by 5 capitals, copied from edit-distance.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GLYPH = {};
for (const ch of ALPHA) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const MSGS = ["MEET AT THE LODGE", "A QUICK BROWN FOX", "SQUARE AND COMPASS", "HIDDEN IN PLAIN SIGHT"];

// ---- The cipher ----------------------------------------------------------
// A to I are the nine cells of a # in reading order, J to R the same # with a
// dot in each cell, S to V the four wedges of an X (top, left, right, bottom)
// and W to Z the four wedges of an X with a dot. A letter is drawn as the
// lines that bound its cell. Each cell of a # keeps the edges that have a
// line of the # on that side, written T, B, L, R: the corner cell A has a line
// below it and to its right only. A wedge keeps the two arms of the X that run
// along its sides, UL, UR, DL, DR.
const GRID_EDGES = ["BR", "BLR", "BL", "TBR", "TBLR", "TBL", "TR", "TLR", "TL"];
const WEDGE_ARMS = [["UL", "UR"], ["UL", "DL"], ["UR", "DR"], ["DL", "DR"]];
const ARM = { UL: [-1, -1], UR: [1, -1], DL: [-1, 1], DR: [1, 1] };
// The wedge symbols, which are only the arms, drawn small: where the point and the two ends are, and which way the mouth opens.
const WEDGE_SYM = [
  { apex: [0, 2], tip: { UL: [-4, -2], UR: [4, -2] }, axis: [0, -1] },
  { apex: [2, 0], tip: { UL: [-2, -4], DL: [-2, 4] }, axis: [-1, 0] },
  { apex: [-2, 0], tip: { UR: [2, -4], DR: [2, 4] }, axis: [1, 0] },
  { apex: [0, -2], tip: { DL: [-4, 2], DR: [4, 2] }, axis: [0, 1] },
];
const KEYC = 3.5; // half a cell of the key: its # lines are at +-3.5, one LED wide
const SYMC = 3; // half a cell of a symbol: its edges are at +-3 and two LEDs wide, so a symbol is 8 LEDs across
const KEYR = 10; // how far the arms of an X run from its centre, in x and in y

// What a letter is: which of the four shapes, which cell, whether it has a dot.
function info(i) {
  if (i < 18) return { kind: i < 9 ? 0 : 1, cell: i % 9, dot: i >= 9 };
  const j = i - 18;
  return { kind: j < 4 ? 2 : 3, cell: j % 4, dot: j >= 4 };
}

// The segments (x0, y0, x1, y1) a letter is made of, in the local frame of
// its key shape (key) or of the slot it lands in (symbol), y down.
function segments(i, symbol) {
  const f = info(i), out = [];
  if (f.kind < 2) {
    const c = f.cell % 3, r = floor(f.cell / 3), u = symbol ? 0 : (c - 1) * 2 * KEYC, v = symbol ? 0 : (r - 1) * 2 * KEYC, e = GRID_EDGES[f.cell];
    const h = symbol ? SYMC : KEYC;
    if (e.includes("T")) out.push([u - h, v - h, u + h, v - h]);
    if (e.includes("B")) out.push([u - h, v + h, u + h, v + h]);
    if (e.includes("L")) out.push([u - h, v - h, u - h, v + h]);
    if (e.includes("R")) out.push([u + h, v - h, u + h, v + h]);
  } else {
    const w = f.cell, ws = WEDGE_SYM[w];
    for (const a of WEDGE_ARMS[w]) {
      if (symbol) out.push([ws.apex[0], ws.apex[1], ws.tip[a][0], ws.tip[a][1]]);
      else out.push([0, 0, ARM[a][0] * KEYR, ARM[a][1] * KEYR]);
    }
  }
  return out;
}
// Where the dot of a letter sits, and where its letter is written when it is lit.
function dotAt(i, symbol) {
  const f = info(i);
  if (f.kind < 2) return symbol ? [0, 0] : [((f.cell % 3) - 1) * 2 * KEYC, (floor(f.cell / 3) - 1) * 2 * KEYC];
  const ws = WEDGE_SYM[f.cell];
  return symbol ? [ws.apex[0] + ws.axis[0] * 2.5, ws.apex[1] + ws.axis[1] * 2.5] : [ws.axis[0] * 5.5, ws.axis[1] * 5.5];
}
function cellAt(i) {
  const f = info(i);
  if (f.kind < 2) return [((f.cell % 3) - 1) * 2 * KEYC, (floor(f.cell / 3) - 1) * 2 * KEYC];
  const ws = WEDGE_SYM[f.cell];
  return [ws.axis[0] * 6.5, ws.axis[1] * 6.5];
}

// ---- The panel ------------------------------------------------------------
const KX = 15, KY = [19, 49, 79, 109]; // the centres of the four key shapes
const SX = [37, 48, 59], SY0 = 12; // the stack: three columns; its rows are 18 apart, or as close as 104 / (rows - 1) when there are more than 6
const OFFS = [0, 0.14, 0.35, 0.43]; // the hue of each shape, from the base
const KEY_A = 0.6, DOT_A = 0.85, SYM_A = 0.92;

// The clock, in seconds at Speed 2.
const T0 = 0.3, STEP = 0.34, SPACE = 0.2, PEEL = 0.18, FLY = 0.62;
const GAP = 0.9, READ = 0.27, REACH = 0.34, SHOW = 0.4, HOLD = 0.5, OUT = 0.7, REST = 0.3;

function plan(idx) {
  const text = MSGS[idx], slots = [], letters = [], rows = Math.ceil(text.length / 3), pitch = min(18, 104 / (rows - 1));
  let t = T0;
  for (let s = 0; s < text.length; s++) {
    const ch = text[s];
    if (ch === " ") {
      slots.push(null);
      t += SPACE;
      continue;
    }
    const li = ALPHA.indexOf(ch), k = letters.length, col = s % 3, row = floor(s / 3);
    const L = { li, k, ch, ts: t, x: SX[col], y: round(SY0 + pitch * row), info: info(li), key: segments(li, false), sym: segments(li, true), dk: dotAt(li, false), ds: dotAt(li, true), cell: cellAt(li) };
    slots.push(L);
    letters.push(L);
    t += STEP;
  }
  const n = letters.length, last = letters[n - 1];
  const enc = last.ts + PEEL + FLY, d0 = enc + GAP;
  for (const L of letters) L.td = d0 + READ * L.k;
  const dec = d0 + READ * (n - 1) + REACH + SHOW;
  const fade = dec + HOLD;
  return { text, slots, letters, n, enc, d0, dec, fade, end: fade + OUT + REST };
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, msg: -1, turn: 0, ang: 0, T: 0, P: null, init: true,
    // Every letter's drawing, to check the cipher against: its shape, cell, dot and the segments of key and symbol.
    table: ALPHA.split("").map((ch, i) => ({ ch, ...info(i), key: segments(i, false), sym: segments(i, true), dk: dotAt(i, false), ds: dotAt(i, true) })),
    buf: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  const m = cl(round(k[2]), 0, MSGS.length - 1);
  if (m !== S.msg) {
    S.msg = m;
    S.P = plan(m);
    S.T = 0;
  }
  S.turn = cl(k[3], 0, 180);
  // The key follows the knob, a little behind it.
  if (S.init) {
    S.ang = S.turn;
    S.init = false;
  } else S.ang += (S.turn - S.ang) * (1 - Math.exp(-d * 6));
  S.T += (d * S.speed) / 2;
  if (S.T >= S.P.end) S.T = 0;
}

// ---- Drawing --------------------------------------------------------------
function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  const r = c[0] * a, g = c[1] * a, b = c[2] * a;
  if (r > buf[o]) buf[o] = r;
  if (g > buf[o + 1]) buf[o + 1] = g;
  if (b > buf[o + 2]) buf[o + 2] = b;
}
// A line 2 hw wide, each LED lit by how near its centre is to the segment: a
// line one wide through the centres of a row of LEDs lights exactly that row,
// and one two wide along the edge between two rows lights both.
function seg(buf, x0, y0, x1, y1, c, a, hw) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, r = hw + 1;
  for (let y = floor(min(y0, y1) - r); y <= ceil(max(y0, y1) + r); y++)
    for (let x = floor(min(x0, x1) - r); x <= ceil(max(x0, x1) + r); x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = l2 > 0 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
      const d = Math.hypot(px - t * dx, py - t * dy);
      put(buf, x, y, c, cl(hw + 0.5 - d, 0, 1) * a);
    }
}
function dot(buf, x, y, c, a) {
  for (let yy = floor(y - 2); yy <= ceil(y + 2); yy++)
    for (let xx = floor(x - 2); xx <= ceil(x + 2); xx++) put(buf, xx, yy, c, cl(1.7 - Math.hypot(xx + 0.5 - x, yy + 0.5 - y), 0, 1) * a);
}
function glyph(buf, ch, cx, cy, c, a) {
  const g = GLYPH[ch], x0 = round(cx - 1.5), y0 = round(cy - 2.5);
  for (let j = 0; j < 15; j++) if (g[j]) put(buf, x0 + (j % 3), y0 + floor(j / 3), c, a);
}
const lerp = (a, b, t) => a + (b - a) * t;
// 0 before a, up to 1 over rise, level until b, down to 0 over fall.
const env = (t, a, b, rise, fall) => sm((t - a) / rise) * (1 - sm((t - b) / fall));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const P = S.P, T = S.T, buf = S.buf;
  buf.fill(0);

  const phi = (S.ang * PI) / 180, cp = cos(phi), sp = sin(phi);
  const hb = 0.5 + S.hue, COL = [], PALE = [0, 0, 0], WHITE = [0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const c = [0, 0, 0];
    tint(hb + OFFS[k], 0.85, 1, c);
    COL.push(c);
  }
  tint(hb, 0.12, 1, WHITE);
  const letterFade = 1 - 0.75 * abs(sin(2 * phi)); // a letter is not meant to be read in a slanted cell
  const out = 1 - sm((T - P.fade) / OUT);

  // A point of a shape, turned about the shape's centre.
  const at = (cx, cy, u, v) => [cx + cp * u - sp * v, cy + sp * u + cp * v];

  // The key: the lines of each shape, dim, and the dots of the dotted ones.
  const lit = new Float32Array(P.letters.length); // how lit each letter's cell is now
  const lifted = new Float32Array(P.letters.length); // 1 while a letter's dot is away with its lines
  for (const L of P.letters) {
    const e1 = env(T, L.ts, L.ts + PEEL + 0.2, 0.08, 0.3);
    const e2 = env(T, L.td + REACH, L.td + REACH + SHOW - 0.1, 0.06, 0.25);
    lit[L.k] = max(e1, e2);
    lifted[L.k] = lit[L.k];
  }
  for (let s = 0; s < 4; s++) {
    const cx = KX, cy = KY[s], c = COL[s];
    if (s < 2) {
      for (const g of [-KEYC, KEYC]) {
        let a = at(cx, cy, g, -3 * KEYC), b = at(cx, cy, g, 3 * KEYC);
        seg(buf, a[0], a[1], b[0], b[1], c, KEY_A, 0.5);
        a = at(cx, cy, -3 * KEYC, g);
        b = at(cx, cy, 3 * KEYC, g);
        seg(buf, a[0], a[1], b[0], b[1], c, KEY_A, 0.5);
      }
    } else {
      for (const [p, q] of [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]]) {
        const a = at(cx, cy, p[0] * KEYR, p[1] * KEYR), b = at(cx, cy, q[0] * KEYR, q[1] * KEYR);
        seg(buf, a[0], a[1], b[0], b[1], c, KEY_A, 0.5);
      }
    }
  }
  // The dots of the key, every one of them, unless its letter is lit and has taken it.
  for (let i = 0; i < 26; i++) {
    const f = info(i);
    if (!f.dot) continue;
    let away = 0;
    for (const L of P.letters) if (L.li === i) away = max(away, lifted[L.k]);
    const d = dotAt(i, false), p = at(KX, KY[f.kind], d[0], d[1]);
    dot(buf, p[0], p[1], COL[f.kind], DOT_A * (1 - away));
  }

  // The stack: every symbol that has landed, turned with the key.
  const symbolAt = (L, a, flash) => {
    const c = COL[L.info.kind];
    for (const g of L.sym) {
      const p = at(L.x, L.y, g[0], g[1]), q = at(L.x, L.y, g[2], g[3]);
      seg(buf, p[0], p[1], q[0], q[1], flash > 0 ? [lerp(c[0], WHITE[0], flash), lerp(c[1], WHITE[1], flash), lerp(c[2], WHITE[2], flash)] : c, a, 1);
    }
    if (L.info.dot) {
      const p = at(L.x, L.y, L.ds[0], L.ds[1]);
      dot(buf, p[0], p[1], flash > 0 ? [lerp(c[0], WHITE[0], flash), lerp(c[1], WHITE[1], flash), lerp(c[2], WHITE[2], flash)] : c, a);
    }
  };
  for (const L of P.letters) {
    const land = L.ts + PEEL + FLY;
    if (T < land) continue;
    const reading = env(T, L.td - 0.05, L.td + REACH + 0.15, 0.1, 0.3);
    const fresh = 1 - sm((T - land) / 0.4);
    symbolAt(L, (SYM_A + 0.08 * max(fresh, reading)) * out, max(fresh * 0.6, reading * 0.7));
  }

  // The lines in flight: out of the key and across, a short trail behind.
  for (const L of P.letters) {
    const t0 = L.ts + PEEL;
    if (T < t0 || T >= t0 + FLY) continue;
    const e = sm((T - t0) / FLY), c = COL[L.info.kind];
    for (let tr = 0; tr < 4; tr++) {
      const et = sm(cl((T - t0 - tr * 0.045) / FLY, 0, 1)), a = [1, 0.5, 0.28, 0.14][tr];
      if (tr > 0 && et >= e) continue;
      const mix = (g, gs) => {
        const ks = at(KX, KY[L.info.kind], g[0], g[1]), ke = at(KX, KY[L.info.kind], g[2], g[3]);
        const ss = at(L.x, L.y, gs[0], gs[1]), se = at(L.x, L.y, gs[2], gs[3]);
        return [lerp(ks[0], ss[0], et), lerp(ks[1], ss[1], et), lerp(ke[0], se[0], et), lerp(ke[1], se[1], et)];
      };
      for (let q = 0; q < L.key.length; q++) {
        const m = mix(L.key[q], L.sym[q]);
        seg(buf, m[0], m[1], m[2], m[3], c, a, lerp(0.5, 1, et));
      }
      if (L.info.dot) {
        const ks = at(KX, KY[L.info.kind], L.dk[0], L.dk[1]), ss = at(L.x, L.y, L.ds[0], L.ds[1]);
        dot(buf, lerp(ks[0], ss[0], et), lerp(ks[1], ss[1], et), c, a);
      }
    }
  }

  // The reading: a light from a symbol back to the cell it came from.
  for (const L of P.letters) {
    const t0 = L.td;
    if (T < t0 || T >= t0 + REACH) continue;
    const kc = at(KX, KY[L.info.kind], L.cell[0], L.cell[1]), e = sm((T - t0) / REACH);
    for (let tr = 0; tr < 4; tr++) {
      const et = sm(cl((T - t0 - tr * 0.04) / REACH, 0, 1));
      dot(buf, lerp(L.x, kc[0], et), lerp(L.y, kc[1], et), WHITE, [1, 0.55, 0.3, 0.15][tr] * (tr === 0 || et < e ? 1 : 0));
    }
  }

  // The lit cells: the cell filled, the letter in it, bright.
  for (const L of P.letters) {
    const a = lit[L.k];
    if (a <= 0.004) continue;
    const f = L.info, c = COL[f.kind], cc = at(KX, KY[f.kind], L.cell[0], L.cell[1]);
    // The cell, a square of 6 for a #, the wedge out to the ends of the arms for an X; found in the shape's own frame.
    const x0 = floor(cc[0] - 13), x1 = ceil(cc[0] + 13), y0 = floor(cc[1] - 13), y1 = ceil(cc[1] + 13);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - KX, py = y + 0.5 - KY[f.kind], u = cp * px + sp * py, v = -sp * px + cp * py;
        let m;
        if (f.kind < 2) m = KEYC - 0.5 - max(abs(u - (L.cell[0])), abs(v - (L.cell[1])));
        else {
          const ax = WEDGE_SYM[f.cell].axis, along = u * ax[0] + v * ax[1], across = abs(-u * ax[1] + v * ax[0]);
          m = min((along - across) / 1.4142 - 0.4, (KEYR - along) * 0.7);
        }
        if (m > -0.5) put(buf, x, y, c, 0.4 * cl(m + 0.5, 0, 1) * a);
      }
    glyph(buf, L.ch, cc[0], cc[1], WHITE, a * letterFade);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
