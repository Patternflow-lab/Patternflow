// ===== Patternflow pattern =====
// Title:   Page Canon
// Family:  type
// Idea:    A book page is laid out from its diagonals alone, drawn one at a time on the panel until two crossings fix a text block that always leaves a ninth of the page for the inner and top margins and two ninths for the outer and foot ones, whatever the proportion of the page, and then a heading and lines of type are set in it, held, rubbed out and set again.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Van de Graaf canon of page construction (Jan Tschichold, 1953; Raúl Rosarivo, 1947; Jan van de Graaf, 1946), with the 3 x 5 capitals of saccades.js, pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..4, Page=0.5..0.75, Leading=7..11
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the page edge and the page diagonals are blue, the spread's diagonals teal, the lines that find the block violet, and the block, its ticks, the margin numerals and the heading gold over cream type. Hues that would leave a dim line orange or yellow go to crimson or green instead.
// Knob 2: Speed. How fast the drawing goes, a line to a beat and a beat 1 / K2 seconds. The block is found 9.3 beats in, the type lights at 10.5, the page is held from beat 12 for 7 beats and an eraser takes 1.6 beats to climb it, so a page is 20.6 beats: 10.3 s at 2, 20.6 s at 1 and 5.2 s at 4. The first frame is at beat 3, with the edge and both page diagonals drawn.
// Knob 3: Page. The width of the page over its height, from 0.5 to 0.75. The page is always 62 LEDs wide and runs from 123 LEDs tall at 0.5, the panel's own 1:2, to 82 at 0.75, which is 3:4. It snaps within 0.008 to 1:2, the golden 1:1.618, 2:3, 1:1.414 and 3:4, names the proportion under the page when 10 LEDs are free there, and leaves the margins at 1, 1, 2 and 2 ninths of the page whichever it is.
// Knob 4: Leading. The distance from one baseline to the next, 7 to 11 LEDs in whole steps, so the rules of the grid and the lines of type move together. The block holds 10, 9, 8, 7 and 7 lines at 1:2 and 6, 5, 5, 4 and 4 at 3:4. Each page is the next stretch of the text, which runs 31 lines and starts over.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [(i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255, (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255, (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255];
}
// A dim orange or yellow reads as brown on the panel, so the scaffolding
// skips that stretch of the wheel: crimson where the hue would be red to
// orange, green where it would be yellow to green.
const dimHue = (h) => ((h -= floor(h)), h < 0.17 ? 0.94 + h * 0.3 : h < 0.33 ? 0.33 : h);

// ---- the faces: 3 x 5 for the text and the numerals, 5 x 7 for the heading --
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "##.|..#|.#.|#..|###", 3: "##.|..#|.#.|..#|##.", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|##.|..#|##.", 6: ".##|#..|###|#.#|###", 7: "###|..#|.#.|#..|#..", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|##.",
  ".": ".|.|.|.|#", ",": "..|..|..|.#|#.", ":": ".|#|.|#|.",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) {
  const rows = FACE[ch].split("|");
  GLYPH[ch] = { w: rows[0].length, bits: rows.join("").split("").map((c) => c === "#") };
}
const BIG = {
  C: ".###.|#...#|#....|#....|#....|#...#|.###.", A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  N: "#...#|##..#|##..#|#.#.#|#..##|#..##|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
};
const TITLE = "CANON";

// ---- the text: what the page says about itself, set 9 characters wide -----
// Broken by hand for an even right edge; a page of the loop is the next
// stretch of these lines, round and round.
const COLS = 9;
const LINES = [
  "A PAGE IS", "LAID OUT", "BEFORE", "ITS FIRST", "WORD.", "THE INNER", "MARGIN IS", "A NINTH", "OF THE", "WIDTH.", "THE TOP", "ONE IS",
  "A NINTH", "OF THE", "HEIGHT.", "THE OUTER", "MARGIN", "AND THE", "FOOT", "ARE TWO", "NINTHS.", "WHAT", "IS LEFT", "HOLDS THE",
  "TEXT, TWO", "THIRDS OF", "THE PAGE", "EACH WAY,", "IN THE", "SHAPE OF", "THE PAGE.",
];

// ---- the canon, in page units: x from the outer edge (0) to the spine (1), --
// y from the foot (0) to the head (1). A page of any proportion is this square
// stretched, and stretching keeps lines and the points where they cross, so
// everything found here holds for every proportion.
const BL = [0, 0], BR = [1, 0], TL = [0, 1], TR = [1, 1], MID = [1, 0.5], TOP = [0.5, 1];
function meet(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / (rx * sy - ry * sx);
  return [a[0] + t * rx, a[1] + t * ry];
}
// The spread's diagonals meet this page's at the middle of the spine edge,
// so on this page they are the lines from the two outer corners to MID. Where
// each crosses a page diagonal is P (upper) and P2 (lower), both at 2/3 of
// the width.
const P = meet(BL, TR, TL, MID);
const P2 = meet(TL, BR, BL, MID);
const LO = [0, P[1]];                           // the level of P, carried to the outer edge
const LE = [1, LO[1] + (P2[1] - LO[1]) / (P2[0] - LO[0])];   // the line LO to P2, carried to the spine edge
// The foot corner of the text block on the spine side is where the line from
// the spine foot corner through P crosses the line LO to P2. The block's
// other corners ride on the page diagonal BL to TR, which it shares.
const BRI = meet(BR, TOP, LO, P2);
const BLO = meet(BL, TR, [0, BRI[1]], BRI);
const TRI = meet(BL, TR, [BRI[0], 0], BRI);
const TLO = [BLO[0], TRI[1]];

// ---- when each step of the drawing happens, in beats ---------------------
// The page opens already set in dim type, the way Tschichold found the canon:
// on pages that were set long before, by measuring them. The drawing then
// finds the block the type sits in, the type lights up, and the page is held.
const STAGES = [["edge", 1], ["d1", 1], ["d2", 1], ["s1", 1], ["s2", 1], ["la", 1], ["lb", 0.5], ["lc", 1], ["boxA", 0.9], ["boxB", 0.9], ["tick", 1.2], ["title", 0.9]];
const ST = {};
let acc = 0;
for (const [name, len] of STAGES) ((ST[name] = [acc, len]), (acc += len));
const T_LIGHT = ST.title[0], T_HOLD = 12, HOLD = 7, WIPE = 1.6, PRE = 3;
const prog = (name, b) => cl((b - ST[name][0]) / ST[name][1], 0, 1);
const endOf = (name) => ST[name][0] + ST[name][1];

const NAMED = [[0.5, "1:2"], [0.618034, "1:1.618"], [2 / 3, "2:3"], [0.707107, "1:1.414"], [0.75, "3:4"]];
const PW = 61, PX0 = 1;

function layout(r, lead) {
  const w = PW, h = round(PW / r), x0 = PX0, y0 = round((127 - h) / 2);
  const X = (u) => x0 + u * w, Y = (v) => y0 + (1 - v) * h;
  const bx0 = round(X(BLO[0])), bx1 = round(X(TRI[0])), by0 = round(Y(TRI[1])), by1 = round(Y(BLO[1]));
  const b0 = by0 + 15;
  return { w, h, x0, y0, X, Y, bx0, bx1, by0, by1, b0, lead, n: by1 >= b0 ? floor((by1 - b0) / lead) + 1 : 0 };
}

export function setup(params) {
  params.s = { b: PRE, off: 0, clr: -1, r: -1, hue: 0, nu: 2, lead: 7, lay: null, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 7], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.nu = cl(k[1], 1, 4);
  S.lead = round(cl(k[3], 7, 11));
  let rt = cl(k[2], 0.5, 0.75);
  for (const [v] of NAMED) if (abs(rt - v) < 0.008) rt = v;
  S.r = S.r < 0 ? rt : S.r + (rt - S.r) * (1 - exp(-d / 0.16));
  S.lay = layout(S.r, S.lead);
  const db = d * S.nu;
  if (S.clr >= 0) {
    // An eraser line climbs the page and the next page of the text is set.
    S.clr += db / WIPE;
    if (S.clr >= 1) ((S.b = 0.3), (S.clr = -1), (S.off += max(1, S.lay.n)));
  } else if ((S.b += db) >= T_HOLD + HOLD) ((S.b = T_HOLD + HOLD), (S.clr = 0));
}

// Wu's line, one LED wide and softened along its length. `dot` keeps every
// other column or row, for a rule.
function wu(put, x0, y0, x1, y1, dot) {
  const steep = abs(y1 - y0) > abs(x1 - x0);
  if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x0 > x1) [x0, x1, y0, y1] = [x1, x0, y1, y0];
  const g = x1 === x0 ? 0 : (y1 - y0) / (x1 - x0), at = steep ? (x, y, a) => put(y, x, a) : put;
  for (let x = round(x0); x <= round(x1); x++) {
    if (dot && (x & 1)) continue;
    const y = y0 + g * (x - x0), yi = floor(y), f = y - yi;
    at(x, yi, (1 - f) ** 0.8);
    at(x, yi + 1, f ** 0.8);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const L = S.lay || layout(S.r < 0 ? 0.5 : S.r, S.lead), b = S.b, buf = S.buf;
  buf.fill(0);
  const h = S.hue;
  const inBlock = (x, y) => x >= L.bx0 && x <= L.bx1 && y >= L.by0 && y <= L.by1;
  const edgeC = hsv(dimHue(h + 0.58), 0.3, 1), dC = hsv(dimHue(h + 0.58), 0.8, 1), sC = hsv(dimHue(h + 0.47), 0.75, 1), lC = hsv(dimHue(h + 0.76), 0.65, 1);
  const goldC = hsv(h + 0.11, 0.85, 1), inkC = hsv(h + 0.11, 0.3, 1), ghostC = hsv(h + 0.5, 0.35, 1);
  const dimInk = hsv(dimHue(h + 0.58), 0.4, 1), bandC = hsv(dimHue(h + 0.5), 0.55, 1);
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const lit = (x, y, r, g, bl) => {
    // Under 20 of 255 an LED is off on the panel, so the soft ends of a line stop there.
    if (x < 0 || x >= W || y < 0 || y >= H || (r < 20 && g < 20 && bl < 20)) return;
    const o = (y * W + x) * 3;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (bl > buf[o + 2]) buf[o + 2] = bl;
  };
  const px = (c, k, x, y) => lit(x, y, c[0] * k, c[1] * k, c[2] * k);
  // Scaffolding that runs through the block is dimmed so the type reads over it.
  const inner = 1 - 0.55 * ease((b - endOf("boxB")) / 2);
  const put = (c, k) => (x, y, a) => {
    const m = a * k * (inBlock(x, y) ? inner : 1);
    lit(x, y, c[0] * m, c[1] * m, c[2] * m);
  };
  // Type overwrites whatever is under it.
  const ink = (c, k, x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = c[0] * k;
    buf[o + 1] = c[1] * k;
    buf[o + 2] = c[2] * k;
  };
  const rest = 0.5 - 0.16 * ease((b - endOf("boxA")) / 3);
  // A line is bright while it is drawn, then settles to the resting level.
  const lv = (name) => (prog(name, b) < 1 ? 0.95 : rest + (0.95 - rest) * exp(-(b - endOf(name)) / 0.8));
  const seg = (a, z, p, c, k, dot) => {
    if (p <= 0) return;
    const x0 = L.X(a[0]), y0 = L.Y(a[1]), x1 = x0 + (L.X(z[0]) - x0) * p, y1 = y0 + (L.Y(z[1]) - y0) * p;
    wu(put(c, k), x0, y0, x1, y1, dot);
    if (p < 1) px(inkC, 1, round(x1), round(y1));
  };
  const hv = (x0, y0, x1, y1, c, k) => {
    // an axis-aligned line between whole LEDs
    for (let x = min(x0, x1); x <= max(x0, x1); x++) for (let y = min(y0, y1); y <= max(y0, y1); y++) px(c, k, x, y);
  };
  const plus = (u, v, c, k) => {
    const x = round(L.X(u)), y = round(L.Y(v));
    px(c, k, x, y);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) px(c, k * 0.6, x + dx, y + dy);
  };
  const ping = (u, v, t0) => {
    const a = (b - t0) / 0.7;
    if (a < 0 || a >= 1) return;
    const cx = round(L.X(u)), cy = round(L.Y(v)), r = 2 + 4 * a;
    for (let i = 0; i < 24; i++) px(inkC, 1 - a, round(cx + r * Math.cos((i * PI) / 12)), round(cy + r * Math.sin((i * PI) / 12)));
  };
  // A crossing is marked with a plus and a ring when it is found. The ones
  // that only served the construction shrink to a dot once the block stands.
  const kf = 1 - ease((b - endOf("boxB") - 0.5) / 1.2);
  const key = (u, v, t0, c, stay) => {
    if (b < t0) return;
    const f = stay ? 1 : kf;
    if (f > 0) plus(u, v, c || inkC, f);
    if (f > 0 || stay) px(c || inkC, 0.6, round(L.X(u)), round(L.Y(v)));
    ping(u, v, t0);
  };
  const glyphAt = (ch, x, y, c, k, over) => {
    const g = GLYPH[ch];
    if (!g) return 0;
    g.bits.forEach((on, i) => on && (over ? ink : px)(c, k, x + (i % g.w), y + floor(i / g.w)));
    return g.w;
  };
  const textW = (s) => s.split("").reduce((a, ch) => a + (GLYPH[ch] ? GLYPH[ch].w + 1 : 0), -1);

  const pageT = round(L.y0), pageB = round(L.y0 + L.h), pageL = PX0, pageR = PX0 + PW;
  const hh = b - T_HOLD;

  // The margins, one at a time while the page is held: the white space the
  // canon leaves, in the proportions 1 : 1 : 2 : 2.
  const band = (i) => (S.clr >= 0 ? 0 : sin(PI * cl((hh - 2.3 - 1.2 * i) / 1.2, 0, 1)));
  {
    const rects = [
      [pageL + 1, pageT + 1, pageR - 1, L.by0 - 1], [pageL + 1, L.by1 + 1, pageR - 1, pageB - 1],
      [pageL + 1, L.by0, L.bx0 - 1, L.by1], [L.bx1 + 1, L.by0, pageR - 1, L.by1],
    ];
    rects.forEach(([x0, y0, x1, y1], i) => {
      const e = band(i);
      if (e > 0.01) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(bandC, 0.3 * e, x, y);
    });
  }

  // The baseline grid: a rule at every baseline, in the margins too until the
  // block stands, then inside the block only.
  const gin = ease((b - 0.2) / 0.8), gout = 1 - ease((b - endOf("boxB")) / 1.2);
  for (let row = L.b0 - L.lead * floor((L.b0 - pageT) / L.lead); row < pageB; row += L.lead) {
    if (row <= pageT) continue;
    for (let x = pageL + 1; x < pageR; x += 2) {
      const inside = inBlock(x, row) && row >= L.b0;
      px(dC, 0.45 * gin * (inside ? 1 : gout), x, row);
    }
  }

  // The page edge, drawn once round from the top outer corner.
  {
    const pe = ease(prog("edge", b)) * 4, k = 0.5;
    const side = (i, x0, y0, x1, y1) => {
      const p = cl(pe - i, 0, 1);
      if (p <= 0) return;
      const x = round(x0 + (x1 - x0) * p), y = round(y0 + (y1 - y0) * p);
      hv(x0, y0, x, y, edgeC, k);
      if (p < 1) px(inkC, 1, x, y);
    };
    side(0, pageL, pageT, pageR, pageT);
    side(1, pageR, pageT, pageR, pageB);
    side(2, pageR, pageB, pageL, pageB);
    side(3, pageL, pageB, pageL, pageT);
  }
  // The scaffolding.
  seg(BL, TR, ease(prog("d1", b)), dC, lv("d1"));
  seg(TL, BR, ease(prog("d2", b)), dC, lv("d2"));
  seg(TL, MID, ease(prog("s1", b)), sC, lv("s1"));
  seg(BL, MID, ease(prog("s2", b)), sC, lv("s2"));
  seg(BR, TOP, ease(prog("la", b)), lC, lv("la"));
  seg(P, LO, ease(prog("lb", b)), lC, lv("lb"), true);
  seg(LO, LE, ease(prog("lc", b)), lC, lv("lc"));

  // The text block, found from BRI, which is where the two lines meet.
  const bA = ease(prog("boxA", b)), bB = ease(prog("boxB", b)), bk = rest + 0.35 - 0.1 * ease((b - endOf("boxB")) / 2);
  {
    const { bx0, bx1, by0, by1 } = L;
    const lenX = bx1 - bx0, lenY = by1 - by0;
    if (bA > 0) {
      hv(bx1, by1, bx1 - round(lenX * bA), by1, goldC, bk);
      hv(bx1, by1, bx1, by1 - round(lenY * bA), goldC, bk);
    }
    if (bB > 0) {
      hv(bx1, by0, bx1 - round(lenX * bB), by0, goldC, bk);
      hv(bx0, by1, bx0, by1 - round(lenY * bB), goldC, bk);
    }
  }
  key(P[0], P[1], endOf("s1"));
  key(P2[0], P2[1], endOf("s2"));
  key(0.5, 0.5, endOf("d2"));
  key(LO[0], LO[1], endOf("lb"));
  key(BRI[0], BRI[1], ST.lc[0] + ST.lc[1] * BRI[0], goldC, true);
  key(BLO[0], BLO[1], endOf("boxA"), goldC, true);
  key(TRI[0], TRI[1], endOf("boxA"), goldC, true);
  key(TLO[0], TLO[1], endOf("boxB"), goldC, true);

  // Ticks that cut the page edges in ninths, and what the margins come to.
  {
    const pt = prog("tick", b);
    for (let i = 0; i < 16; i++) {
      const at = i / 16 * 0.65;
      if (pt <= at) continue;
      const top = i < 8, kk = (i % 8) + 1, strong = top ? kk === 2 || kk === 8 : kk === 1 || kk === 7;
      const age = (pt - at) * ST.tick[1], k = (strong ? 0.85 : 0.45) * (0.7 + 0.3 * exp(-age / 0.4)), len = strong ? 4 : 2;
      if (top) hv(round(L.X(kk / 9)), pageT + 1, round(L.X(kk / 9)), pageT + len, goldC, k);
      else hv(pageL + 1, round(L.Y(1 - kk / 9)), pageL + len, round(L.Y(1 - kk / 9)), goldC, k);
    }
  }
  const digitsA = ease((prog("tick", b) - 0.6) / 0.4);
  if (digitsA > 0) {
    const cx = (x0, x1) => round((x0 + x1) / 2) - 1, cyv = round((L.by0 + L.by1) / 2) - 2;
    const dg = (ch, x, y, i) => glyphAt(ch, x, y, mix(goldC, inkC, band(i)), (0.8 + 0.2 * band(i)) * digitsA, true);
    dg("1", cx(L.bx0, L.bx1), round((pageT + L.by0) / 2) - 2, 0);
    dg("2", cx(L.bx0, L.bx1), round((L.by1 + pageB) / 2) - 2, 1);
    dg("2", cx(pageL, L.bx0), cyv, 2);
    dg("1", cx(L.bx1, pageR), cyv, 3);
  }

  // The heading and the lines: set in dim type at the start, lit once the
  // block is found.
  {
    const tw = TITLE.length * 6 - 1, tset = ease((b - 0.1) / 0.5);
    let x = L.bx0 + floor((L.bx1 - L.bx0 + 1 - tw) / 2);
    for (let i = 0; i < TITLE.length; i++, x += 6) {
      const on = ease((b - T_LIGHT - 0.12 * i) / 0.35), c = mix(dimInk, goldC, on);
      BIG[TITLE[i]].split("|").forEach((row, yy) => row.split("").forEach((ch, xx) => ch === "#" && ink(c, (0.62 + 0.33 * on) * tset, x + xx, L.by0 + 2 + yy)));
    }
    const tx = L.bx0 + floor((L.bx1 - L.bx0 + 1 - (COLS * 4 - 1)) / 2);
    for (let i = 0; i < L.n; i++) {
      const s = LINES[(S.off + i) % LINES.length], set = cl((b - 0.07 * i) / 0.5, 0, 1);
      const on = ease((b - T_LIGHT - 0.1 * i) / 0.5), c = mix(dimInk, inkC, on), count = floor(set * s.length + (set >= 1 ? 0.5 : 0.001));
      let gx = tx;
      for (let k = 0; k < count; k++) {
        const newest = k === count - 1 && set < 1;
        gx += (glyphAt(s[k], gx, L.b0 + i * L.lead - 4, newest ? inkC : c, newest ? 1 : 0.62 + 0.33 * on, true) || 2) + 1;
      }
    }
  }

  // Once the page is lit, the block is shown to be the page shrunk to 2/3 about P.
  if (hh >= 0 && hh < HOLD && S.clr < 0) {
    const gs = ease((hh - 0.4) / 1.8);
    if (gs > 0 && gs < 1) {
      const sc = 1 - gs / 3, ghost = (c) => [P[0] + (c[0] - P[0]) * sc, P[1] + (c[1] - P[1]) * sc];
      const g = [TL, TR, BR, BL].map(ghost), a = 0.9 * (1 - 0.6 * gs);
      for (let i = 0; i < 4; i++) {
        const u = g[i], v = g[(i + 1) % 4];
        hv(round(L.X(u[0])), round(L.Y(u[1])), round(L.X(v[0])), round(L.Y(v[1])), ghostC, a);
      }
      for (const [c0, c1] of [[TL, g[0]], [TR, g[1]], [BR, g[2]], [BL, g[3]]]) seg(c0, c1, 1, goldC, 0.9);
    }
  }

  // The proportion, named when it is one of the old ones, in the room the page leaves.
  if (127 - pageB >= 10) {
    const hit = NAMED.find(([v]) => abs(v - S.r) < 0.002), label = hit ? hit[1] : "1:" + (1 / S.r).toFixed(2);
    let x = round((W - textW(label)) / 2);
    const y = pageB + floor((127 - pageB - 5) / 2);
    for (const ch of label) x += glyphAt(ch, x, y, edgeC, 0.55) + 1;
  }

  // The eraser: a line climbs the page from the foot and takes what is below it.
  if (S.clr >= 0) {
    const yw = pageB + 1 - ease(S.clr) * (pageB - pageT + 2);
    for (let y = max(0, pageT); y <= pageB; y++) {
      const m = y <= yw ? 1 : y < yw + 2.5 ? 0.3 : 0;
      if (m < 1) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] *= m;
    }
    if (S.clr < 1) for (let x = pageL; x <= pageR; x++) px(inkC, 0.55, x, round(yw));
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3]), min(255, buf[p * 3 + 1]), min(255, buf[p * 3 + 2]));
}
