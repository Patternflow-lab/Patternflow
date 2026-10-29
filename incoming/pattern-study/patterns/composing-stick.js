// ===== Patternflow pattern =====
// Title:   Composing Stick
// Family:  type
// Idea:    Sorts fly one at a time from a type case whose lowercase boxes are sized by how often each letter is used into a composing stick, where the line reads left to right with every letter upside down (p shows as b, d as q) and is justified against the knee with em, en, thin and hair spaces, then turns over into the forme, where it reads right to left in mirror image (p as q), is inked and pressed onto a sheet at the foot of the panel, the only place it reads right, before the type flies back to its boxes.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hand composition of movable type as Joseph Moxon set it out in Mechanick Exercises on the Whole Art of Printing (1683-84), with a simplified job case after the California job case (lowercase boxes sized by letter frequency, e the largest; capitals in equal boxes, J and U after Z); the pangram Sphinx of black quartz, judge my vow and the epitaph Benjamin Franklin wrote for himself (1728); an 8-row pixel face drawn for this pattern, in which b, d, p and q are one bitmap; pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Spacing=0..1
//
// Knob 1: Hue. The ink on the slab, the roller, the inked faces and the print: blue at 0, magenta at 0.25, orange at 0.5, green at 0.75. Metal, wood and paper keep their colours.
// Knob 2: Speed. At 2 a sort leaves the case about every 0.3 s, and mind your p's and q's goes from case to sheet and back every 11 s, the Sphinx's three lines every 18 s; at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Text. Each with its own measure, and the knee moves to it: 0 mind your p's and q's on 52 LEDs, 1 Sphinx of black quartz, judge my vow. on 60, 2 bob pop bid bud dub on 60, picked because in the stick bob reads pop and pop bob, and in the forme bid, bud and dub read as themselves, 3 The Body of B. Franklin, Printer on 56. Turning it starts the shop over on the new text.
// Knob 4: Spacing. How a line is filled out to the measure: below 0.25 justified, each 3-em word space topped up with em, en, thin and hair spaces (the opening 0.06); to 0.5 letterspaced, one space between every two letters set as the letters go in and the rest in the word spaces; to 0.75 ragged, quads at the end; above that centred, quads at both ends. The last line is always quadded out. Hair spaces show as brass.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hsv = (h, s, v) => [5, 3, 1].map((n) => ((k) => 255 * v * (1 - s * max(0, min(k, 4 - k, 1))))((n + (h - floor(h)) * 6) % 6));

// The face: 8 rows, 2 for ascenders, 4 for the x-height and 2 for
// descenders; capitals stand on the upper 6. Rows top down, a missing row is
// blank. b, d, p and q are one bitmap turned and mirrored.
const FONT = {
  a: ",,.###,#..#,#..#,.###", b: "#...,#...,###.,#..#,#..#,###.", c: ",,.##,#..,#..,.##",
  d: "...#,...#,.###,#..#,#..#,.###", e: ",,.##.,####,#...,.###", f: ".##,.#.,###,.#.,.#.,.#.",
  g: ",,.###,#..#,#..#,.###,...#,.##.", h: "#...,#...,###.,#..#,#..#,#..#", i: "#,,#,#,#,#",
  j: ".#,,.#,.#,.#,.#,.#,#.", k: "#..,#..,#.#,##.,#.#,#.#", l: "#,#,#,#,#,#",
  m: ",,####.,#.#.#,#.#.#,#.#.#", n: ",,###.,#..#,#..#,#..#", o: ",,.##.,#..#,#..#,.##.",
  p: ",,###.,#..#,#..#,###.,#...,#...", q: ",,.###,#..#,#..#,.###,...#,...#", r: ",,#.##,##..,#...,#...",
  s: ",,.###,##..,..##,###.", t: ",.#.,###,.#.,.#.,..#", u: ",,#..#,#..#,#..#,.##.",
  v: ",,#.#,#.#,#.#,.#.", w: ",,#...#,#.#.#,#.#.#,.#.#.", x: ",,#..#,.##.,.##.,#..#",
  y: ",,#..#,#..#,#..#,.###,...#,.##.", z: ",,####,..#.,.#..,####",
  "'": "#,#", ",": ",,,,,#,#", ".": ",,,,,#",
  B: "###.,#..#,###.,#..#,#..#,###.", F: "###,#..,##.,#..,#..,#..", P: "###.,#..#,#..#,###.,#...,#...",
  S: ".###,#...,.##.,...#,...#,###.", T: "###,.#.,.#.,.#.,.#.,.#.",
};
const GL = {};
for (const ch in FONT) {
  const rows = FONT[ch].split(","), w = max(...rows.map((r) => r.length)), bits = new Uint8Array(8 * w);
  rows.forEach((r, y) => [...r].forEach((v, x) => (bits[y * w + x] = v === "#")));
  GL[ch] = { w, bits };
}

// The body is 10 LEDs, so an em quad is 10 wide; the smaller spaces are its
// fractions rounded to whole LEDs. A sort is its letter plus one LED of body.
const SPW = { em: 10, en: 5, thick: 3, thin: 2, hair: 1 };
const QUADS = ["em", "en", "thin", "hair"];
const LX = 2, BODY = 10, LINES = 3;
const STICK = 34, ROLL = 49, FORME = 55, SHEET = 93, PAPER0 = 90;

// Each text with the measure its job is set to, in LEDs.
const TEXTS = [
  ["mind your p's and q's", 52],
  ["Sphinx of black quartz, judge my vow.", 60],
  ["bob pop bid bud dub", 60],
  ["The Body of B. Franklin, Printer", 56],
];

// The case. Lowercase on the left in four bands, each box about as big as
// its letter is common; capitals on the right in equal boxes. A band gives
// its rows, keys and inside widths; a divider follows every box.
const BANDS = [
  [1, 4, ["'", ",", ".", "k", "hair", "thin", "em", "fi", "fl", "ff", "ffi"], [2, 2, 2, 4, 3, 4, 6, 2, 2, 2, 2]],
  [6, 12, ["j", "b", "c", "d", "e", "i", "s", "f", "g"], [2, 2, 3, 4, 9, 4, 4, 3, 2]],
  [14, 20, ["z", "l", "m", "n", "h", "o", "y", "p", "w", "en"], [2, 3, 3, 4, 4, 4, 3, 3, 3, 3]],
  [22, 29, ["x", "q", "v", "u", "t", "thick", "a", "r"], [2, 2, 3, 3, 6, 6, 6, 6]],
];
const CAPS = ["1234567", "890$&?!", "ABCDEFG", "HIKLMNO", "PQRSTVW", "XYZJU;:"];
const CASE_H = 31, CN = W * CASE_H;

const METAL = [206, 210, 218], WOOD = [150, 96, 48], FLOOR = [16, 10, 7], STEEL = [150, 158, 170], BED = [40, 44, 52];
const IRON = [70, 74, 84], FURN = [132, 92, 52], DARK = [18, 18, 22], PAPER = [196, 186, 160];
// Pieces: body, edge and the shank's three rows; spaces by kind, hair spaces brass.
const BODYC = [86, 88, 96], SEAM = [50, 52, 58], SHANK = [[116, 120, 128], [28, 30, 34], [76, 80, 88]];
const SPC = { em: [36, 38, 44], en: [36, 38, 44], thick: [54, 56, 62], thin: [54, 56, 62], hair: [176, 132, 52] };

function buildCase(S) {
  const boxes = (S.boxes = []), at = (S.at = {});
  const add = (key, x0, y0, x1, y1) => {
    at[key] = boxes.length;
    boxes.push({ x0, y0, x1, y1, cx: (x0 + x1 - 1) / 2, cy: (y0 + y1) / 2, fill: 0.4 + 0.25 * Math.random(), flash: 0 });
  };
  for (const [y0, y1, keys, ws] of BANDS) for (let i = 0, x = 1; i < keys.length; x += ws[i++] + 1) add(keys[i], x, y0, x + ws[i], y1 + 1);
  CAPS.forEach((row, r) => [...row].forEach((ch, c) => add(/[A-Z]/.test(ch) ? ch : "c" + r + c, 43 + 3 * c, 1 + 5 * r, 45 + 3 * c, 5 + 5 * r)));
  // Each box holds a heap, higher in the middle, so a big box reads as a big mound.
  S.owner = new Int16Array(CN).fill(-1);
  S.heap = new Float32Array(CN);
  boxes.forEach((b, i) => {
    for (let y = b.y0; y < b.y1; y++)
      for (let x = b.x0; x < b.x1; x++) {
        S.owner[y * W + x] = i;
        S.heap[y * W + x] = cl(1.5 - ((2 * x + 1 - b.x0 - b.x1) / (b.x1 - b.x0 + 1)) ** 2 - ((2 * y + 1 - b.y0 - b.y1) / (b.y1 - b.y0 + 1)) ** 2, 0, 1);
      }
  });
  S.tex = Float32Array.from({ length: CN }, Math.random);
  S.tone = Float32Array.from({ length: CN }, Math.random);
}

const sortOf = (S, ch) => ({ ch, g: GL[ch], w: GL[ch].w + 1, box: S.at[ch] });
const spaceOf = (S, k, extra) => ({ sp: k, w: SPW[k], box: S.at[k], extra });
const widthOf = (ps) => ps.reduce((s, p) => s + p.w, 0);
function split(n, out, S, extra = true) {
  for (const k of QUADS) for (; n >= SPW[k]; n -= SPW[k]) out.push(spaceOf(S, k, extra));
}

// Greedy line breaks with a 3-em word space.
function setText(S) {
  const [text, M] = TEXTS[S.text];
  S.M = M;
  S.P0 = 32 - M / 2;
  const lines = (S.lines = []);
  let cur = [], cw = 0;
  for (const w of text.split(" ").map((w) => [...w].map((ch) => sortOf(S, ch)))) {
    if (cur.length && cw + 3 + widthOf(w) > M) [cur, cw] = [(lines.push(cur), []), 0];
    cw += (cur.length ? 3 : 0) + widthOf(w);
    cur.push(w);
  }
  lines.push(cur);
}

// The line filled out to the measure by the Spacing knob's method. The last
// line of a paragraph is never spread; it is quadded out.
function justify(S, line, last) {
  const mode = last && S.mode < 2 ? 2 : S.mode, gaps = line.length - 1;
  const slack = S.M - line.reduce((s, w) => s + widthOf(w), 0) - 3 * gaps;
  const word = new Array(gaps).fill(0), letter = line.map((w) => new Array(w.length).fill(0));
  let lead = 0, tail = 0;
  if (mode === 0 && gaps) {
    // Equal shares; the odd LEDs go first after punctuation, then from the left.
    const q = floor(slack / gaps), punct = (i) => (/[,.]/.test(line[i].at(-1).ch) ? 1 : 0);
    let r = slack - q * gaps;
    word.fill(q);
    for (const i of [...word.keys()].sort((a, b) => punct(b) - punct(a) || a - b)) if (r > 0) (word[i]++, r--);
  } else if (mode === 1) {
    // Letterspacing: the same space between every two letters, set as the
    // letters are, and what is left in the word spaces.
    const lg = line.reduce((s, w) => s + w.length - 1, 0), u = lg ? floor(slack / (lg + 2 * gaps)) : 0, r = slack - u * lg;
    line.forEach((w, wi) => letter[wi].fill(u, 1));
    for (let i = 0; i < gaps; i++) word[i] = floor(r / gaps) + (i < r % gaps ? 1 : 0);
    if (!gaps) tail = r;
  } else if (mode === 3) tail = slack - (lead = floor(slack / 2));
  else tail = slack;
  const out = [];
  split(lead, out, S);
  line.forEach((w, wi) => {
    if (wi) {
      out.push(spaceOf(S, "thick", false));
      split(word[wi - 1], out, S);
    }
    w.forEach((p, j) => {
      split(letter[wi][j], out, S, false);
      out.push({ ...p });
    });
  });
  split(tail, out, S);
  return out;
}

// What a piece shows at column c, row r, the way it prints: 1 body, 2 face,
// 3 the body's edge, 4 a space, which stands lower than the type.
function cell(p, c, r) {
  if (p.sp) return 4;
  if (!c) return 3;
  return r > 0 && r < 9 && p.g.bits[(r - 1) * p.g.w + c - 1] ? 2 : 1;
}

function layout(ps) {
  let x = 0;
  return ps.map((p) => ({ p, x: (x += p.w) - p.w, gone: false }));
}

// The shop as it opens: the forme full and about to be inked, the last
// sheet printed, and the first word of the next copy in the stick.
function begin(S) {
  setText(S);
  S.just = S.lines.map((l, i) => justify(S, l, i === S.lines.length - 1));
  S.forme = { lines: S.just.map(layout), phase: "lock", t: 0.25, inkY: 0, ink: 0, roll: ROLL };
  S.sheet = { lines: S.forme.lines, P0: S.P0, x: 0, cut: H, press: -1 };
  S.fl = [];
  S.boxes.forEach((b) => (b.flash = 0));
  newLine(S, 0);
  const C = S.comp;
  for (const p of C.ps) {
    if (p.sp === "thick") break;
    p.on = !p.extra;
  }
  targets(C);
  C.ps.forEach((p) => (p.x = p.tx));
}

function newLine(S, li) {
  S.comp = { li, ps: S.just[li].map((p) => ({ ...p, on: false, x: LX, tx: LX })), phase: "set", t: 0, busy: false };
}

function targets(C) {
  let x = LX;
  for (const p of C.ps) x += (p.tx = x, p.on ? p.w : 0);
}

const fly = (S, x0, y0, x1, y1, T, col, land, ret) => S.fl.push({ x0, y0, x1, y1, t: 0, T, col, land, ret });

// The compositor: sets the line sort by sort, then the spaces that justify
// it, waits for the forme and slides the line in.
function stepComp(S, d) {
  const C = S.comp;
  C.t -= d;
  if (C.phase === "set" || C.phase === "just") {
    if (C.busy || C.t > 0) return;
    const p = C.ps.find((q) => !q.on && (C.phase === "just" || !q.extra));
    if (!p) return C.phase === "set" ? (C.phase = "just") : Object.assign(C, { phase: "tight", t: 0.4 });
    targets(C);
    const b = S.boxes[p.box];
    b.flash = 1;
    b.fill = max(0.2, b.fill - 0.05);
    C.busy = true;
    fly(S, b.cx, b.cy, p.tx + p.w / 2, STICK + 4, p.sp ? 0.2 : 0.24, p.sp ? [120, 124, 132] : METAL, () => {
      p.on = true;
      targets(C);
      p.x = p.tx;
      Object.assign(C, { busy: false, t: 0.05 });
    });
  } else if (C.phase === "tight") {
    if (C.t <= 0) C.phase = "wait";
  } else if (C.phase === "wait") {
    if (S.forme.phase === "fill" && S.forme.lines.length === C.li) Object.assign(C, { phase: "move", t: 0.7, bits: lineBits(C.ps, S.M) });
  } else if (C.t <= 0) {
    S.forme.lines.push(layout(C.ps));
    newLine(S, (C.li + 1) % S.lines.length);
  }
}

// A line as print-side codes, M by 10, hair spaces as 5.
function lineBits(list, M) {
  const bits = new Uint8Array(M * BODY);
  let x = 0;
  for (const p of list) {
    for (let c = 0; c < p.w; c++) for (let r = 0; r < BODY; r++) if (x + c < M) bits[r * M + x + c] = p.sp === "hair" ? 5 : cell(p, c, r);
    x += p.w;
  }
  return bits;
}

// The forme's round, with each step's length at Speed 2.
const PH = { lock: 0.35, ink: 1.3, swap: 0.6, press: 0.9, hold: 0.7 };
const NEXT = { fill: "lock", lock: "ink", ink: "swap", swap: "press", press: "hold", hold: "dist" };

function stepForme(S, d) {
  const F = S.forme, SH = S.sheet;
  F.t -= d;
  const u = 1 - F.t / (PH[F.phase] || 1);
  if (F.phase === "ink") {
    // The roller runs down over the forme and back to the slab.
    const bot = FORME + BODY * LINES - 2;
    F.roll = u < 0.55 ? ROLL + (bot - ROLL) * (u / 0.55) : bot + (ROLL - bot) * ((u - 0.55) / 0.45);
    F.inkY = max(F.inkY, F.roll + 3);
    F.ink = 1;
  } else if (F.phase === "swap") {
    // The last print slides out to the right, a fresh sheet in from the left.
    SH.x = round(u < 0.5 ? u * 132 : (u - 1) * 132);
    if (u >= 0.5) SH.lines = null;
  } else if (F.phase === "press") SH.press = SH.cut = PAPER0 - 3 + (H + 3 - PAPER0) * u;
  else if (F.phase === "dist")
    // Distribution: each piece goes back to its own box.
    for (; F.t <= 0; F.t += 0.045) {
      let q = null, k = 0;
      for (; k < F.lines.length && !q; k++) q = F.lines[k].find((e) => !e.gone);
      if (!q) {
        if (!S.fl.some((f) => f.ret)) Object.assign(F, { lines: [], inkY: 0, ink: 0, phase: "fill", t: 0 });
        break;
      }
      q.gone = true;
      const b = S.boxes[q.p.box];
      const back = () => {
        b.flash = 0.7;
        b.fill = min(0.95, b.fill + 0.05);
      };
      fly(S, 63 - S.P0 - q.x - q.p.w / 2, FORME + BODY * (k - 1) + 4, b.cx, b.cy, 0.32, q.p.sp ? [90, 94, 100] : mix(METAL, S.ink, 0.6), back, true);
    }
  if (F.phase === "fill" ? F.lines.length >= S.lines.length : F.phase !== "dist" && F.t <= 0) {
    if (F.phase === "ink") F.roll = ROLL;
    if (F.phase === "swap") Object.assign(SH, { x: 0, lines: F.lines, P0: S.P0, cut: PAPER0 - 3 });
    if (F.phase === "press") {
      Object.assign(SH, { cut: H, press: -1 });
      F.ink = 0.55;
    }
    F.phase = NEXT[F.phase];
    F.t = PH[F.phase] || 0;
  }
}

function put(F, x, y, c, a = 1) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  F[o] += (c[0] - F[o]) * a;
  F[o + 1] += (c[1] - F[o + 1]) * a;
  F[o + 2] += (c[2] - F[o + 2]) * a;
}

export function setup(params) {
  const S = (params.s = { text: -1, mode: -1, F: new Float32Array(N * 3), base: new Float32Array(N * 3) });
  buildCase(S);
  const B = S.base, g = (c, k) => c.map((v) => v * k);
  // Case wood with a grain, the stick, the chase full of furniture.
  for (let i = 0; i < CN; i++) put(B, i % W, floor(i / W), S.owner[i] >= 0 ? FLOOR : g(WOOD, 0.8 + 0.25 * S.tone[i - (i % W) + (((i % W) * 7) % W)]));
  for (let x = 0; x < W; x++) {
    put(B, x, STICK - 1, STEEL);
    put(B, x, STICK + BODY + 3, g(STEEL, 0.85));
    for (let y = STICK; y < STICK + BODY + 3; y++) put(B, x, y, x < LX ? STEEL : BED);
  }
  const top = FORME - 2, bot = FORME + BODY * LINES + 1;
  for (let y = top; y <= bot; y++)
    for (let x = 0; x < W; x++) put(B, x, y, y === top || y === bot || !x || x === W - 1 ? IRON : g(FURN, 0.75 + 0.2 * (((x * 5 + y * 11) % 7) / 7)));
  S.paper = new Float32Array(W * (H - PAPER0));
  for (let i = 0; i < S.paper.length; i++) S.paper[i] = 1 - 0.12 * (floor(i / W) / (H - PAPER0)) - 0.05 * (abs((i % W) - 31.5) / 31.5);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0] || 0, 0, 1);
  S.sp = cl(k[1] ?? 2, 0.2, 3) / 2;
  S.ink = hsv(0.6 + S.hue, 0.85, 1);
  const text = round(cl(k[2] || 0, 0, 3)), mode = min(3, floor(cl(k[3] ?? 0.06, 0, 1) * 4));
  if (text !== S.text || mode !== S.mode) {
    Object.assign(S, { text, mode });
    begin(S);
  }
  const d = dt * S.sp;
  for (const f of S.fl) if ((f.t += d) >= f.T && !f.done) (f.done = true), f.land();
  S.fl = S.fl.filter((f) => !f.done);
  stepComp(S, d);
  stepForme(S, d);
  for (const p of S.comp.ps) if (p.on) p.x += (p.tx - p.x) * min(1, d * 14);
  for (const b of S.boxes) b.flash = max(0, b.flash - dt * 3);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.comp) return;
  const F = S.F, ink = S.ink, FL = S.forme, SH = S.sheet, C = S.comp, M = S.M, P0 = S.P0;
  F.set(S.base);
  const colOf = (p, code, face) => (code === 2 ? face : code === 1 ? BODYC : code === 3 ? SEAM : SPC[p.sp]);

  // The case: each box a heap of sorts as full as it is, lit when touched.
  for (let i = 0; i < CN; i++) {
    const b = S.boxes[S.owner[i]];
    if (!b) continue;
    const h = S.heap[i], v = (40 + 90 * S.tone[i]) * (0.55 + 0.45 * h);
    if (S.tex[i] < b.fill * h) F.set([v, v * 1.02, v * 1.1], i * 3);
    if (b.flash > 0) put(F, i % W, floor(i / W), [255, 226, 150], b.flash * 0.7);
  }

  // The knee, set to the measure, lights when the line is tight.
  for (let y = STICK - 1; y < STICK + BODY + 4; y++) for (let x = LX + M; x < LX + M + 2; x++) put(F, x, y, C.phase === "tight" ? [240, 240, 228] : STEEL);
  // Sorts in the stick, seen from the compositor's side: the line reads left
  // to right and every face is upside down, the mirror of the print turned
  // round. Below each face its shank, nick up, the nicks in one line.
  if (C.phase !== "move")
    for (const p of C.ps) {
      if (!p.on) continue;
      for (let c = 0, x = round(p.x); c < p.w; c++, x++) {
        if (x < LX || x >= LX + M) continue;
        for (let r = 0; r < BODY; r++) put(F, x, STICK + r, colOf(p, cell(p, c, BODY - 1 - r), METAL));
        for (let j = 0; j < 3; j++) put(F, x, STICK + BODY + j, p.sp ? SPC[p.sp] : c ? SHANK[j] : SEAM, p.sp ? 1 - 0.1 * j : 1);
      }
    }

  // The ink slab, and the roller resting on it or running over the forme.
  for (let y = ROLL - 1; y < ROLL + 4; y++) for (let x = 0; x < W; x++) put(F, x, y, mix([0, 0, 0], ink, 0.42 + 0.1 * ((x * 3 + y * 5) % 4)));
  const ry = round(FL.roll);
  for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) put(F, x, ry + j, x < 2 || x > 61 ? STEEL : mix([0, 0, 0], ink, 0.95 - 0.25 * j));
  if (FL.phase === "ink") for (let x = 0; x < W; x++) put(F, x, ry - 1, IRON);

  // The forme: the lines seen from the face, mirrored and reading right to
  // left, inked where the roller has passed. Slots past the text stay
  // furniture; quoins at the foot open when it is locked.
  const face = mix(METAL, ink, FL.ink);
  for (let k = 0; k < S.lines.length; k++) {
    for (let y = FORME + BODY * k; y < FORME + BODY * (k + 1); y++) for (let x = P0; x < P0 + M; x++) put(F, x, y, DARK);
    for (const q of FL.lines[k] || [])
      if (!q.gone)
        for (let c = 0; c < q.p.w; c++)
          for (let r = 0, y = FORME + BODY * k; r < BODY; r++, y++) put(F, 63 - (P0 + q.x + c), y, colOf(q.p, cell(q.p, c, r), y < FL.inkY ? face : METAL));
  }
  const locked = FL.phase !== "fill" && FL.phase !== "dist";
  for (const qx of [18, 40]) for (let i = 0; i < (locked ? 6 : 4); i++) put(F, qx + i, FORME + BODY * LINES, locked ? [200, 204, 210] : [110, 114, 120]);

  // The line on its way from stick to forme turns over: upside down to the
  // right way up, then mirrored, so for an instant it reads as it will print.
  if (C.phase === "move") {
    const s = cl(1 - C.t / 0.7, 0, 1), sy = cos(PI * cl(2 * s, 0, 1)), sx = cos(PI * cl(2 * s - 1, 0, 1));
    const cx = LX + M / 2 + (32 - LX - M / 2) * s, cy = STICK + 5 + (FORME + BODY * C.li - STICK) * s;
    const hw = (M / 2) * abs(sx), hh = (BODY / 2) * abs(sy), lit = 0.6 + 0.4 * abs(sx * sy);
    const pal = [null, BODYC, METAL, SEAM, SPC.thick, SPC.hair].map((c) => c && c.map((v) => v * lit));
    for (let y = floor(cy - hh); y < cy + hh; y++)
      for (let x = floor(cx - hw); x < cx + hw; x++) {
        const u = floor((x + 0.5 - cx) / (sx || 1e-3) + M / 2), v = floor((y + 0.5 - cy) / (sy || 1e-3) + BODY / 2);
        const code = u >= 0 && u < M && v >= 0 && v < BODY ? C.bits[(BODY - 1 - v) * M + u] : 0;
        if (code) put(F, x, y, pal[code]);
      }
  }

  // The sheet, sliding in fresh before each impression; it takes the print
  // as the cylinder passes, and only here does the line read right.
  const tone = mix(PAPER, hsv(0.6 + S.hue, 0.95, 0.8), 0.94);
  for (let i = 0; i < S.paper.length; i++) {
    const x = i % W, X = x + SH.x, g = S.paper[i], o = (PAPER0 * W + i - x + X) * 3;
    if (!x || x === W - 1 || X < 0 || X >= W) continue;
    F[o] = PAPER[0] * g;
    F[o + 1] = PAPER[1] * g;
    F[o + 2] = PAPER[2] * g;
  }
  if (SH.lines)
    SH.lines.forEach((line, k) => {
      for (const q of line)
        for (let c = 1; c < q.p.w && !q.p.sp; c++)
          for (let r = 1, y = SHEET + BODY * k + 1; r < 9; r++, y++) if (y < SH.cut && cell(q.p, c, r) === 2) put(F, SH.P0 + q.x + c + SH.x, y, tone);
    });
  if (SH.press >= 0) for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) put(F, x, round(SH.press) + j, [210 - 40 * j, 216 - 40 * j, 224 - 40 * j]);

  // Sorts in flight, with a short trail.
  for (const f of S.fl) {
    const u = cl(f.t / f.T, 0, 1), e = u * u * (3 - 2 * u);
    for (const [back, a] of [[0.08, 0.35], [0, 1]]) {
      const ue = max(0, e - back);
      const x = round(f.x0 + (f.x1 - f.x0) * ue), y = round(f.y0 + (f.y1 - f.y0) * ue - 6 * sin(PI * ue));
      for (let j = 0; j < 4; j++) put(F, x + (j & 1), y + (j >> 1), f.col, j > 1 ? a * 0.8 : a);
    }
  }

  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, F[o], F[o + 1], F[o + 2]);
}
