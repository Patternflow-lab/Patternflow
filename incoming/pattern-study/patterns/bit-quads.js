// ===== Patternflow pattern =====
// Title:   Bit Quads
// Family:  type
// Idea:    Three 5 by 7 letters built of 4 by 4 LED blocks stand down the tall panel, and a 2 by 2 window steps over each one in reading order, counting only what it sees: green when one of its four bits is lit, magenta when three are, cyan when two touch across a corner, each leaving a dot of its colour on the LED where its bits meet while three tallies climb beside the letter, until the window leaves and Gray's formula gives the letter's Euler number, its pieces and its holes, and the holes fill with gold; the Corners knob decides whether bits meeting at a corner join, so a round O keeps its counter or falls into four pieces.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Euler number counted with bit quads (Stephen B. Gray, Local properties of binary images in two dimensions, IEEE Transactions on Computers, 1971); 4- and 8-connectivity on the square grid (Azriel Rosenfeld, Connectivity in digital pictures, 1970); 5 by 7 capitals and figures drawn for this pattern; pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Words=0..2, Corners=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the letters are periwinkle, the holes gold and the windows green for one lit bit, magenta for three and cyan for two across a corner; at 0.5 the letters go sand, the holes blue, and the three windows pink, green and red.
// Knob 2: Speed. At 2 the window stays 0.06 s on each of a letter's 48 positions, so a letter is read in 2.9 s and its answer rises over 1 s; the panel opens with the first letter read, finishes the word at 7.8 s and holds it 2.5 s, and a word read from its first letter takes 11.6 s. Every time goes as 2 / Speed.
// Knob 3: Words. Which list of three-letter words is read, each word in turn: 0 OBI, POD, AXE; 1 DOG, WAX, ZIP; 2 486, 809, 640. A new list starts at its first word, again with the first letter read.
// Knob 4: Corners. Whether two bits that meet only at a corner touch, shown top right as 8 beside a ring of eight neighbours or 4 beside a plus. Up to 0.5 they do (8-connectivity, the way a reader sees the letters): the LED between them lights, the QD tally takes a minus sign, and O, B, A, D and the figures keep their holes. From 0.5 they do not (4-connectivity): that LED goes dark, QD takes a plus sign, and every bowl with a stepped corner leaks through it and comes apart, O into four pieces and X into nine, while P and 0, whose corners are square, keep their holes.

// Gray's bit quads. Pad the letter with a ring of zeros and look at every
// 2 by 2 window that overlaps it, (5 + 1)(7 + 1) = 48 for a 5 by 7 letter.
// Count three kinds: Q1, one bit of the four lit; Q3, three lit; QD, two
// lit across the diagonal. Then the Euler number, pieces minus holes, is
//
//   E8 = (Q1 - Q3 - 2 QD) / 4   when bits meeting at a corner join,
//   E4 = (Q1 - Q3 + 2 QD) / 4   when only bits sharing an edge do.
//
// The reason is the turning of the boundary. Walk round every piece and
// every hole along the edges between lit and unlit bits. Each Q1 window is
// a corner where the walk turns a quarter turn outwards, each Q3 window one
// where it turns a quarter turn inwards. In a QD window the walk meets two
// corners at once: if the two lit bits join, it passes between them and
// turns inwards twice; if they do not, it goes round each and turns
// outwards twice. Round a piece the turns add to one whole turn, round a
// hole to minus one, so a quarter of Q1 - Q3 -/+ 2 QD is pieces - holes.
//
// The window never needs to know where a piece or a hole is; it only adds.
// The code checks the formulas before using them, against pieces and holes
// counted globally by flood fill, on four test bitmaps and every glyph.
// The two rules swap at the background: when the letter's bits join
// across corners, the holes are the unlit regions joined through edges
// only, and the other way round, or a hole would leak through the very
// corner that closes it.

const W = 64, H = 128, NPX = W * H;
const { floor, min, max, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Capitals and figures 5 wide and 7 tall, top row first. P and 0 have
// square corners; every other bowl turns its corners with a diagonal step.
const GLYPHS = {
  A: ".###. #...# #...# ##### #...# #...# #...#",
  B: "####. #...# #...# ####. #...# #...# ####.",
  D: "####. #...# #...# #...# #...# #...# ####.",
  E: "##### #.... #.... ####. #.... #.... #####",
  G: ".###. #...# #.... #.### #...# #...# .###.",
  I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "##### #...# #...# ##### #.... #.... #....",
  W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Z: "##### ....# ...#. ..#.. .#... #.... #####",
  0: "##### #...# #...# #...# #...# #...# #####",
  4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
  6: "..##. .#... #.... ####. #...# #...# .###.",
  8: ".###. #...# #...# .###. #...# #...# .###.",
  9: ".###. #...# #...# .#### ....# ...#. .##..",
};
const LISTS = [
  ["OBI", "POD", "AXE"],
  ["DOG", "WAX", "ZIP"],
  ["486", "809", "640"],
];

// Figures 3 by 5 for the tallies.
const MINI = {
  0: "####.##.##.####", 1: ".#.##..#..#.###", 2: "###..#####..###", 3: "###..#.##..####",
  4: "#.##.####..#..#", 5: "####..###..####", 6: "####..####.####", 7: "###..#..#..#..#",
  8: "####.#####.####", 9: "####.####..####", "+": "....#.###.#....", "-": "......###......",
  E: "####..####..###",
};

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

// Window types in the order they are numbered here.
const Q0 = 0, Q1 = 1, Q2 = 2, Q3 = 3, Q4 = 4, QD = 5;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = N4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);

// Labels the cells of grid (w by h) equal to val, joined through nb.
function label(grid, w, h, val, nb) {
  const lab = new Int8Array(w * h).fill(-1);
  let n = 0;
  for (let p = 0; p < w * h; p++) {
    if (grid[p] !== val || lab[p] >= 0) continue;
    const st = [p];
    lab[p] = n;
    while (st.length) {
      const q = st.pop(), x = q % w, y = (q - x) / w;
      for (const [dx, dy] of nb) {
        const X = x + dx, Y = y + dy, r = Y * w + X;
        if (X >= 0 && X < w && Y >= 0 && Y < h && grid[r] === val && lab[r] < 0) {
          lab[r] = n;
          st.push(r);
        }
      }
    }
    n++;
  }
  return { lab, n };
}

// Gray's bit quads on a w by h image padded with a ring of zeros: every
// 2 by 2 window that overlaps it, (w + 1)(h + 1) of them, in reading order.
function quads(bit, w, h) {
  const at = (x, y) => (x >= 0 && x < w && y >= 0 && y < h ? bit[y * w + x] : 0);
  const win = [];
  const n = [0, 0, 0, 0, 0, 0];
  for (let y = -1; y < h; y++)
    for (let x = -1; x < w; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1), k = a + b + c + d;
      const t = k === 2 ? (a === d ? QD : Q2) : k;
      win.push(t);
      n[t]++;
    }
  // E for 8-connected letters, then for 4-connected ones.
  return { win, n, E: [(n[Q1] - n[Q3] - 2 * n[QD]) / 4, (n[Q1] - n[Q3] + 2 * n[QD]) / 4] };
}

// Pieces and holes counted the global way: pieces with the letter's
// neighbours, holes as the background's pieces, padded, with the other
// kind of neighbour, less the one outside.
function topology(bit, w, h) {
  const pad = new Uint8Array((w + 2) * (h + 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pad[(y + 1) * (w + 2) + x + 1] = bit[y * w + x];
  return [N8, N4].map((nb, c) => {
    const pieces = label(bit, w, h, 1, nb);
    const sea = label(pad, w + 2, h + 2, 0, c ? N8 : N4);
    return { lab: pieces.lab, C: pieces.n, H: sea.n - 1 };
  });
}

// The panel draws a bit as a 4 by 4 block on a pitch of 5. The 1-LED
// gaps between edge neighbours are filled, and the LED where four bits
// meet is lit when three or four of them are, or when two are lit across
// the corner and corners join (8-connectivity). The LEDs of the holes are
// the dark ones the outside cannot reach going LED to LED.
const PITCH = 5, LW = 5 * PITCH - 1, LH = 7 * PITCH - 1;
function ledMask(bit, win, c) {
  const w = LW + 2, h = LH + 2, m = new Uint8Array(w * h);
  const at = (j, k) => (j >= 0 && j < 5 && k >= 0 && k < 7 ? bit[k * 5 + j] : 0);
  for (let k = 0; k < 7; k++)
    for (let j = 0; j < 5; j++) {
      if (!at(j, k)) continue;
      const x0 = 1 + j * PITCH, y0 = 1 + k * PITCH;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) m[(y0 + y) * w + x0 + x] = 1;
      if (at(j + 1, k)) for (let y = 0; y < 4; y++) m[(y0 + y) * w + x0 + 4] = 1;
      if (at(j, k + 1)) for (let x = 0; x < 4; x++) m[(y0 + 4) * w + x0 + x] = 1;
    }
  for (let k = 0; k < 6; k++)
    for (let j = 0; j < 4; j++) {
      const t = win[(k + 1) * 6 + j + 1];
      if (t === Q3 || t === Q4 || (t === QD && c === 0)) m[(1 + k * PITCH + 4) * w + 1 + j * PITCH + 4] = 1;
    }
  const sea = label(m, w, h, 0, N4), outside = sea.lab[0], holes = [];
  for (let p = 0; p < w * h; p++) if (!m[p] && sea.lab[p] !== outside) holes.push(p % w - 1, floor(p / w) - 1);
  return { holes, regions: sea.n - 1 };
}

function analyse(rows) {
  const bit = new Uint8Array(35);
  rows.split(" ").forEach((r, k) => [...r].forEach((ch, j) => (bit[k * 5 + j] = ch === "#" ? 1 : 0)));
  const q = quads(bit, 5, 7), top = topology(bit, 5, 7);
  const led = [0, 1].map((c) => ledMask(bit, q.win, c));
  return { bit, win: q.win, n: q.n, E: q.E, top, led };
}

// The formulas are checked before anything is drawn with them: on a lone
// pixel, two pixels touching at a corner, a square ring and a diamond, and
// on every glyph, E from the quads must equal pieces minus holes counted
// globally, for both kinds of neighbour, and the LEDs must show as many
// holes as the bits have.
const TESTS = [["#"], ["#.", ".#"], ["###", "#.#", "###"], [".#.", "#.#", ".#."]];
for (const t of TESTS) {
  const w = t[0].length, h = t.length, bit = new Uint8Array(w * h);
  t.forEach((r, y) => [...r].forEach((ch, x) => (bit[y * w + x] = ch === "#" ? 1 : 0)));
  const q = quads(bit, w, h), top = topology(bit, w, h);
  for (const c of [0, 1]) if (q.E[c] !== top[c].C - top[c].H) throw new Error("bit quads: test " + t.join("/"));
}
const FONT = {};
for (const ch of Object.keys(GLYPHS)) {
  const g = analyse(GLYPHS[ch]);
  for (const c of [0, 1])
    if (g.E[c] !== g.top[c].C - g.top[c].H || g.led[c].regions !== g.top[c].H) throw new Error("bit quads: glyph " + ch);
  FONT[ch] = g;
}

// Seconds at Speed 2: one window, the reveal of a letter's answer (its
// fade-in first), the hold on a finished word, the fade out and in.
const STEP = 0.06, REVEAL = 1.0, RISE = 0.4, HOLD = 2.5, FADE = 0.6, APPEAR = 0.5;
// The three letters' top-left LEDs, and the column the tallies start in.
const LX = 8, LY = [6, 46, 86], IX = 40;
const NWIN = 48;

export function setup(params) {
  params.s = {
    rgb: new Float32Array(NPX * 3),
    list: -1, word: 0, letter: 0, win: 0, t: 0, phase: 1, pt: 0,
    reveal: [0, 0, 0],
    hue: 0, speed: 2, conn: 0,
  };
}

// A word starts with its first letter read, so the panel opens with one
// answer showing and the window on the second letter.
function begin(S, list, word, first) {
  S.list = list;
  S.word = word;
  S.reveal = first ? [1, 0, 0] : [0, 0, 0];
  S.letter = first ? 1 : 0;
  S.win = 0;
  S.t = 0;
  S.phase = first ? 1 : 0;
  S.pt = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const list = round(cl(k[2] || 0, 0, LISTS.length - 1));
  S.conn = (k[3] == null ? 0.06 : k[3]) < 0.5 ? 0 : 1;
  if (list !== S.list) begin(S, list, 0, true);
  const step = (d * S.speed) / 2;
  if (S.phase === 0) {
    if ((S.pt += step) >= APPEAR) begin(S, S.list, S.word, false), (S.phase = 1);
  } else if (S.phase === 1) {
    S.t += step;
    while (S.t >= STEP && S.phase === 1) {
      S.t -= STEP;
      if (++S.win >= NWIN) {
        S.win = NWIN - 1;
        S.phase = 2;
        S.pt = 0;
      }
    }
  } else if (S.phase === 2) {
    S.pt += step;
    S.reveal[S.letter] = min(1, S.pt / RISE);
    if (S.pt >= REVEAL) {
      S.letter++;
      S.pt = 0;
      S.t = 0;
      S.win = 0;
      S.phase = S.letter > 2 ? 3 : 1;
    }
  } else if (S.phase === 3) {
    if ((S.pt += step) >= HOLD) (S.phase = 4), (S.pt = 0);
  } else if ((S.pt += step) >= FADE) {
    begin(S, S.list, (S.word + 1) % LISTS[S.list].length, false);
  }
}

function put(S, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, rgb = S.rgb;
  rgb[p] = c[0] * v;
  rgb[p + 1] = c[1] * v;
  rgb[p + 2] = c[2] * v;
}

function mini(S, ch, x, y, c, v) {
  const g = MINI[ch];
  for (let i = 0; i < 15; i++) if (g[i] === "#") put(S, x + (i % 3), y + floor(i / 3), c, v);
}

// A count right-aligned in two figures ending at x + 7, with its sign at x.
function number(S, n, x, y, c, v, sign) {
  if (sign) mini(S, sign, x, y, c, v);
  const a = Math.abs(n);
  if (a >= 10) mini(S, String(floor(a / 10) % 10), x + 4, y, c, v);
  mini(S, String(a % 10), x + 8, y, c, v);
}

// The 2 by 2 window drawn small: lit corners bright, the rest faint.
function icon(S, x, y, lit, c, v) {
  for (let i = 0; i < 4; i++) {
    const ox = (i & 1) * 3, oy = (i >> 1) * 3, b = lit[i] ? v : v * 0.22;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) put(S, x + ox + xx, y + oy + yy, c, b);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.list < 0) return;
  const rgb = S.rgb, h = S.hue, c8 = S.conn;
  rgb.fill(0);
  const base = hsv(h + 0.62, 0.32, 1), faint = hsv(h + 0.62, 0.5, 1), gold = hsv(h + 0.12, 0.72, 1), white = [1, 1, 1];
  const typeCol = [null, hsv(h + 0.36, 0.8, 1), null, hsv(h + 0.83, 0.62, 1), null, hsv(h + 0.5, 0.85, 1)];
  const pieceCol = (i) => hsv(h + 0.66 + i * 0.381966, 0.42, 1);
  const alpha = S.phase === 0 ? S.pt / APPEAR : S.phase === 4 ? 1 - S.pt / FADE : 1;
  const word = LISTS[S.list][S.word];
  for (let L = 0; L < 3; L++) {
    const g = FONT[word[L]], top = g.top[c8], rv = S.reveal[L], lx = LX, ly = LY[L];
    const scanning = L === S.letter && (S.phase === 1 || S.phase === 2);
    const a = alpha * 255;
    // Unlit bits of the letter's box, just above dark.
    for (let k = 0; k < 7; k++)
      for (let j = 0; j < 5; j++)
        if (!g.bit[k * 5 + j]) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(S, lx + j * PITCH + x, ly + k * PITCH + y, faint, 0.075 * a);
    // Lit bits, the gaps between edge neighbours and the corner joints, in
    // the base colour until the answer comes, then in the colour of their piece.
    const colOf = (q) => {
      const pc = pieceCol(top.lab[q]);
      return [base[0] + (pc[0] - base[0]) * rv, base[1] + (pc[1] - base[1]) * rv, base[2] + (pc[2] - base[2]) * rv];
    };
    const lv = (0.5 + 0.3 * rv) * a;
    for (let k = 0; k < 7; k++)
      for (let j = 0; j < 5; j++) {
        const q = k * 5 + j;
        if (!g.bit[q]) continue;
        const col = colOf(q), x0 = lx + j * PITCH, y0 = ly + k * PITCH;
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(S, x0 + x, y0 + y, col, lv);
        if (j < 4 && g.bit[q + 1]) for (let y = 0; y < 4; y++) put(S, x0 + 4, y0 + y, col, lv);
        if (k < 6 && g.bit[q + 5]) for (let x = 0; x < 4; x++) put(S, x0 + x, y0 + 4, col, lv);
      }
    for (let k = 0; k < 6; k++)
      for (let j = 0; j < 4; j++) {
        const t = g.win[(k + 1) * 6 + j + 1];
        if (t === Q3 || t === Q4 || (t === QD && c8 === 0)) {
          const q = k * 5 + j, src = g.bit[q] ? q : g.bit[q + 1] ? q + 1 : q + 5;
          put(S, lx + j * PITCH + 4, ly + k * PITCH + 4, colOf(src), lv);
        }
      }
    // The holes fill with light once the letter is read.
    if (rv > 0) {
      const ho = g.led[c8].holes;
      for (let i = 0; i < ho.length; i += 2) put(S, lx + ho[i], ly + ho[i + 1], gold, (0.25 + 0.6 * rv) * a);
    }
    if (!(scanning || rv > 0)) continue;
    const upto = scanning && S.phase === 1 ? S.win : NWIN - 1;
    // Every window that counted leaves a dot of its colour on the LED where
    // its four bits meet: green on the outer corners, magenta on the inner
    // ones, cyan where two bits touch across a corner.
    for (let w = 0; w <= upto; w++) {
      const t = g.win[w];
      if (t === Q1 || t === Q3 || t === QD) put(S, lx + ((w % 6) - 1) * PITCH + 4, ly + (floor(w / 6) - 1) * PITCH + 4, typeCol[t], 0.9 * a);
    }
    // The tallies: the window's counts so far, then E, pieces and holes.
    const n = [0, 0, 0, 0, 0, 0];
    for (let w = 0; w <= upto; w++) n[g.win[w]]++;
    const now = scanning && S.phase === 1 ? g.win[S.win] : -1;
    const rows = [[Q1, [1, 0, 0, 0], "+"], [Q3, [1, 1, 1, 0], "-"], [QD, [1, 0, 0, 1], c8 ? "+" : "-"]];
    rows.forEach(([t, lit, sign], r) => {
      const y = ly + r * 7, v = (now === t ? 1 : 0.6) * a;
      icon(S, IX, y, lit, typeCol[t], v);
      number(S, n[t], IX + 7, y, typeCol[t], v, sign);
    });
    if (rv > 0) {
      const y = ly + 22, v = rv * a, E = g.E[c8];
      mini(S, "E", IX, y, white, v);
      number(S, E, IX + 7, y, white, v, E < 0 ? "-" : null);
      const y2 = ly + 29, pc = pieceCol(0);
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) put(S, IX + xx, y2 + 1 + yy, pc, 0.85 * v);
      number(S, top.C, IX - 4, y2, pc, 0.85 * v, null);
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (yy % 4 === 0 || xx % 4 === 0) put(S, IX + 13 + xx, y2 + yy, gold, v);
      number(S, top.H, IX + 11, y2, gold, v, null);
    }
    // The window: its frame on the gap lines round four bits, in the colour
    // of its type when it is one that counts, white when it is not.
    if (scanning && S.phase === 1) {
      const wx = (S.win % 6) - 1, wy = floor(S.win / 6) - 1, t = g.win[S.win];
      const counted = t === Q1 || t === Q3 || t === QD, fc = counted ? typeCol[t] : white, fv = (counted ? 1 : 0.5) * a;
      const fx = lx + wx * PITCH - 1, fy = ly + wy * PITCH - 1;
      for (let i = 0; i <= 10; i++) {
        put(S, fx + i, fy, fc, fv);
        put(S, fx + i, fy + 10, fc, fv);
        put(S, fx, fy + i, fc, fv);
        put(S, fx + 10, fy + i, fc, fv);
      }
      if (counted)
        for (let i = 0; i < 4; i++) {
          const j = wx + (i & 1), k = wy + (i >> 1), on = j >= 0 && j < 5 && k >= 0 && k < 7 && g.bit[k * 5 + j];
          for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(S, fx + 1 + (i & 1) * PITCH + x, fy + 1 + (i >> 1) * PITCH + y, fc, (on ? 1 : 0.16) * a);
        }
    }
  }
  // Top right, which neighbours count: 8 over a ring of eight, or 4 over a
  // plus of four.
  mini(S, c8 ? "4" : "8", 55, 0, white, 0.7 * alpha * 255);
  for (let i = 0; i < 9; i++) if (i !== 4 && (!c8 || i % 2)) put(S, 60 + (i % 3), 1 + floor(i / 3), white, 0.7 * alpha * 255);
  for (let p = 0; p < NPX; p++) display.setPixel(p % W, floor(p / W), min(255, round(rgb[p * 3])), min(255, round(rgb[p * 3 + 1])), min(255, round(rgb[p * 3 + 2])));
}
