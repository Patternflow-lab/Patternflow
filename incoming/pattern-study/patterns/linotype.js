// ===== Patternflow pattern =====
// Title:   Linotype
// Family:  type
// Idea:    Brass matrices drop one at a time from a magazine of channels and ride a belt into the assembler, where the line builds up with a steel spaceband in every word space; the spacebands are driven up until the line fills the measure, metal is pumped against it, and the slug, its face the line in mirror image, drops onto a galley of earlier slugs while the matrices are lifted to the distributor bar and slide along it until each falls back into its own channel.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Linotype line-casting machine (Ottmar Mergenthaler, 1886), its magazine, assembler, spacebands, mould and distributor bar; the first verse of the Gospel of John in the King James Version (1611) and the Gettysburg Address (Abraham Lincoln, 1863); capitals drawn for this pattern, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Measure=0..1
//
// Knob 1: Hue. Turns the brass of the matrices and the magazine and the steel of the frame, the spacebands and the slugs round the wheel together. At 0 the matrices are gold and the steel blue-grey, at 0.25 green and mauve, at 0.5 blue and a warm grey, at 0.75 pink and green-grey. The molten metal stays a warm white.
// Knob 2: Speed. At 2 a matrix reaches the assembler every 0.13 s, the next line's matrices already falling while the last one is justified, and a line of 13 goes from its first matrix to the mould in 2.6 s; the lift, 1 s, and the distributor run alongside the next line. Every time goes as 2 / Speed, ten times slower at 0.2 and one and a half times faster at 3.
// Knob 3: Text. 0 the first verse of John, which at the opening measure justifies every line with word spaces of 5 to 10 LEDs; 1 the pangram pack my box with five dozen liquor jugs, whose first line comes in at 59 LEDs and barely needs its spacebands; 2 ETAOIN SHRDLU CMFWYP VBGKQJ, the first four columns of the keyboard's lowercase keys, which operators ran a finger down to fill out a line they meant to throw away, and which draws only on the 24 channels at the left; 3 the Gettysburg Address to all men are created equal. Turning it starts the machine over on the new text, the galley already holding slugs of its opening lines.
// Knob 4: Measure. The width of the line and of the slug: 60 LEDs, 15 matrices of 4, up to 0.16, then 56, 52 to 0.83 and 48. At 48 the Gettysburg Address sets BROUGHT on a line of its own, which has no word space for a spaceband and is quadded left, and ETAOIN SHRDLU comes apart into four lines of one word.

// The machine is drawn standing, top to bottom: the distributor bar with
// its box at the right, the magazine of 29 channels, the belt, the
// assembler with the spaceband box at its right end, the mould, and the
// galley. Pressing a key lets one matrix out of the foot of its channel. It
// falls onto the belt, rides it down to its end above the assembler and
// drops in at the right, so the line grows to the left. A spaceband
// is a long double wedge, thin at the top; when the line is full the
// spacebands are driven up, their thick feet come into the line, and every
// word space opens by the same amount until the line fills the measure.
// The line drops to the mould, metal fills the mould behind it from left to
// right, and the slug that comes out carries the whole line in relief. Its
// face reads in mirror image, as type does: that is what the galley shows,
// newest at the top, each slug pushing the earlier ones down. The
// spacebands go back to their box; the matrices are lifted to the top,
// passing behind the machine, fed one at a time from the right end of the
// line onto the distributor bar, and slide left along it until they come
// over their own channel and fall in. On the real bar a matrix falls where
// the teeth in its V notch stop finding ribs to hang on; here it simply
// falls at its channel.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Capitals 5 rows tall, drawn for this pattern; M and W are 5 wide, N 4.
const FONT = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.",
  E: "###|#..|##.|#..|###", F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#",
  I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.", K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###",
  M: "#...#|##.##|#.#.#|#...#|#...#", N: "#..#|##.#|#.##|#..#|#..#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|##.|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.",
  T: "###|.#.|.#.|.#.|.#.", U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#...#|#...#|#.#.#|##.##|#...#",
  X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.", Z: "###|..#|.#.|#..|###",
  ".": ".|.|.|.|#", ",": "..|..|..|.#|#.", "-": "...|...|###|...|...",
};
const GL = {};
for (const c in FONT) {
  const rows = FONT[c].split("|");
  GL[c] = { w: rows[0].length, px: rows.map((r) => [...r].map((q) => q === "#")) };
}

// The magazine's channels, left to right, in the order of the Linotype
// keyboard's lowercase keys, etaoin shrdlu cmfwyp vbgkqj, then x and z, the
// full point, the comma and the hyphen. Each starts with more matrices the
// more often its letter comes in English, 18 for E down to 3 for Q, J, X and
// Z, one LED of the channel for each.
const ORDER = "ETAOINSHRDLUCMFWYPVBGKQJXZ.,-";
const BASE = [18, 14, 13, 12, 11, 11, 10, 10, 10, 8, 8, 6, 6, 6, 6, 6, 5, 5, 4, 5, 5, 4, 3, 3, 3, 3, 6, 6, 5];
const CI = {};
for (let i = 0; i < ORDER.length; i++) CI[ORDER[i]] = i;
const chX = (i) => 2 * i + 1;

// Texts, with | where a word may be broken by a hyphen.
const TEXTS = [
  "IN THE BE|GIN|NING WAS THE WORD, AND THE WORD WAS WITH GOD, AND THE WORD WAS GOD.",
  "PACK MY BOX WITH FIVE DOZ|EN LIQ|UOR JUGS.",
  "ETAOIN SHRDLU CMFWYP VBGKQJ",
  "FOUR SCORE AND SEV|EN YEARS AGO OUR FA|THERS BROUGHT FORTH ON THIS CON|TI|NENT, A NEW NA|TION, CON|CEIVED IN LIB|ER|TY, AND DED|I|CAT|ED TO THE PROP|O|SI|TION THAT ALL MEN ARE CRE|AT|ED E|QUAL.",
];

// Geometry, rows from the top.
const BOXX = 59, BAR = 9, HANG = 10, MAG0 = 18, MAG1 = 35, ESC = 36;
const ENT = 61, LINE = 63, RAIL = 70, MOULD = 76, CAV = 83, GAL = 93, SLUG = 7;
const SLOPE = 0.22, GMIN = 1, RISE = 3, LIP = 8;
// Machine seconds at Speed 2.
const DT = 0.13, G = 400, VB = 90, TSB = 0.2, TJ = 0.6, TD = 0.35, TP = 0.3, TH = 0.35, TL = 1.0;
const VF = 45, VBAR = 80, TCH = 0.12, TE = 0.3, COOL = 1.5, TAU = 0.05;
const MOLTEN = [1, 0.92, 0.62], HOT_B = [0.78, 0.72, 0.6], HOT_S = [0.5, 0.45, 0.38], HOT_F = [1, 0.97, 0.86];

const wOf = (s) => {
  let w = 0;
  for (const c of s) if (GL[c]) w += GL[c].w + 1;
  return w;
};

// Line breaking over the whole text at once: a line may end at a word space
// or at a | with a hyphen, and the breaks are the ones whose word spaces
// come out nearest 5 LEDs, a hyphen costing as much as a space 4.5 LEDs off.
// The last line costs nothing, and is quadded when the text ends a sentence.
function breakLines(text, M) {
  const fr = [];
  for (const word of text.split(" ")) {
    const parts = word.split("|");
    parts.forEach((p, j) => fr.push({ s: p, end: j === parts.length - 1 }));
  }
  const n = fr.length, best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let a = 0; a < n; a++) {
    if (best[a] === Infinity) continue;
    let w = 0, gaps = 0;
    for (let b = a + 1; b <= n; b++) {
      const f = fr[b - 1];
      w += wOf(f.s);
      if (b - 1 > a && fr[b - 2].end) gaps++;
      const hy = !f.end, width = w + gaps * GMIN + (hy ? wOf("-") : 0);
      if (width > M && b > a + 1) break;
      let cost;
      if (b === n) cost = 0;
      else if (gaps === 0) cost = 4 * (M - width) * (M - width) + 400;
      else {
        const g = (M - width + gaps * GMIN) / gaps - 5;
        cost = gaps * g * g + (hy ? 20 : 0);
      }
      if (best[a] + cost < best[b]) {
        best[b] = best[a] + cost;
        from[b] = a;
      }
    }
  }
  const cuts = [];
  for (let b = n; b > 0; b = from[b]) cuts.unshift([from[b], b]);
  return cuts.map(([a, b], k) => {
    const words = [];
    let cur = "";
    for (let i = a; i < b; i++) {
      cur += fr[i].s;
      if (fr[i].end) {
        words.push(cur);
        cur = "";
      }
    }
    if (cur) words.push(cur + "-");
    return setLine(words, M, k === cuts.length - 1 && /\.$/.test(text));
  });
}

// A line's matrices and spacebands, and where each stands once the line is
// justified to the measure: the spare width shared out between the word
// spaces as evenly as whole LEDs allow. A line left unjustified, the last
// of a sentence or a line of one word, is quadded left.
function setLine(words, M, last) {
  const items = [];
  words.forEach((wd, k) => {
    if (k) items.push({ sp: true, w: GMIN });
    for (const c of wd) if (GL[c]) items.push({ ch: c, ci: CI[c], w: GL[c].w + 1 });
  });
  const gaps = words.length - 1, letters = items.reduce((s, it) => s + (it.sp ? 0 : it.w), 0);
  const just = !last && gaps > 0, spare = M - letters;
  let x = ENT - M, g = 0;
  for (const it of items) {
    it.fx = x;
    if (it.sp) {
      it.fw = just ? floor(((g + 1) * spare) / gaps) - floor((g * spare) / gaps) : GMIN;
      g++;
    } else it.fw = it.w;
    x += it.fw;
  }
  return { items, just };
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The schedule of one line through the machine, all in absolute machine
// time from its first matrix reaching the assembler at `start`.
function schedule(S, n, start) {
  const src = S.lines[n % S.lines.length];
  const items = src.items.map((it, k) => {
    const m = { ...it, a: start + k * DT };
    if (it.sp) m.r = m.a - TSB;
    else {
      m.x0 = cl(chX(it.ci) - floor(it.w / 2), 0, ENT - it.w);
      const yb = LINE - LIP - SLOPE * (ENT - it.w - m.x0);
      m.tf = sqrt((2 * max(0, yb - ESC)) / G);
      m.r = m.a - TAU - m.tf - (ENT - it.w - m.x0) / VB;
    }
    return m;
  });
  const L = { n, items, just: src.just, aEnd: items[items.length - 1].a };
  L.j0 = L.aEnd + 0.08;
  L.j1 = L.j0 + TJ;
  L.d1 = L.j1 + TD;
  L.p1 = L.d1 + TP;
  L.l0 = L.p1 + TH;
  L.l1 = L.l0 + TL;
  L.end = L.l1;
  for (const m of items) {
    if (m.sp) continue;
    m.tin = L.l1 + (BOXX - (m.fx + m.w)) / VF;
    m.tout = m.tin + 0.08;
    m.xc = max(0, chX(m.ci) - floor(m.w / 2));
    m.tdrop = m.tout + max(0, BOXX - m.w - m.xc) / VBAR;
    m.back = m.tdrop + TCH;
    L.end = max(L.end, m.back);
  }
  return L;
}

function start(S) {
  S.lines = breakLines(TEXTS[S.text], S.M);
  S.active = [];
  S.slugs = [];
  // The machine opens as if it had been running: cold slugs of the text's
  // opening lines in the galley, one line on the distributor bar, one at
  // the mould and the next coming down into the assembler.
  const nl = S.lines.length;
  for (let n = 0; n < 5; n++) S.slugs.push({ L: schedule(S, n % nl, -100 + n), tE: -100 + n, hot: -100 });
  S.t = 0;
  let t0 = -5.2;
  for (let n = 5; n < 8; n++) {
    const L = schedule(S, n, t0);
    S.active.push(L);
    t0 = L.d1;
  }
  S.next = 8;
  for (const L of S.active) if (L.l0 <= 0) S.slugs.push({ L, tE: L.l0, hot: L.d1 });
}

export function setup(params) {
  params.s = { t: 0, hue: 0, text: 0, M: 60, key: "", buf: new Float32Array(N * 3), c: [0, 0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const text = round(cl(k[2] || 0, 0, 3)), M = 60 - 4 * round(3 * cl(k[3] == null ? 0.06 : k[3], 0, 1));
  const key = text + ":" + M;
  if (key !== S.key) {
    S.key = key;
    S.text = text;
    S.M = M;
    start(S);
  }
  const t0 = S.t;
  S.t += (d * speed) / 2;
  // Keep the next line scheduled ahead; a slug joins the galley when ejected.
  while (S.active[S.active.length - 1].d1 < S.t + 3) {
    const last = S.active[S.active.length - 1];
    S.active.push(schedule(S, S.next++, last.d1));
  }
  for (const L of S.active) if (L.l0 > t0 && L.l0 <= S.t) S.slugs.push({ L, tE: L.l0, hot: L.d1 });
  S.active = S.active.filter((L) => L.end > S.t - 0.5);
  while (S.slugs.length > 7) S.slugs.shift();
}

// Drawing into a float buffer, 0..1.
function paint(S, x, y, c, a) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3, b = S.buf;
  if (a == null || a >= 1) {
    b[p] = c[0];
    b[p + 1] = c[1];
    b[p + 2] = c[2];
  } else {
    b[p] += (c[0] - b[p]) * a;
    b[p + 1] += (c[1] - b[p + 1]) * a;
    b[p + 2] += (c[2] - b[p + 2]) * a;
  }
}

// A matrix: a thin brass plate, its ears top and bottom, the letter between.
function matrix(S, ch, x, y, a) {
  const g = GL[ch], C = S.col;
  x = round(x);
  y = round(y);
  for (let i = 0; i < g.w; i++) {
    paint(S, x + i, y, C.ear, a);
    paint(S, x + i, y + 6, C.ear, a);
    for (let r = 0; r < 5; r++) paint(S, x + i, y + 1 + r, g.px[r][i] ? C.brass : C.plate, a);
  }
}

// A spaceband: a long steel double wedge, a thin stem above the line and
// its thick foot below it. `w` is its width across the line, `rise` how far
// it has been driven up: the foot comes up into the line and pushes the
// words apart.
function band(S, x, y, w, rise) {
  const C = S.col, top = round(y - 5 - rise), x0 = round(x);
  for (let r = 0; r < 15; r++) {
    const ww = r < 5 ? 1 : min(w, round(1 + ((r - 4) * (w - 1)) / 7)), Y = top + r, inLine = Y >= y && Y < y + 7;
    for (let i = 0; i < ww; i++) paint(S, x0 + floor((w - ww) / 2) + i, Y, C.band, inLine ? 0.5 : 0.9);
  }
}

// Where each matrix of a line stands across the assembler at time t:
// packed against the entrance as they come, then spread to the measure.
function across(L, t, out) {
  const it = L.items, n = it.length;
  let x = ENT;
  for (let k = n - 1; k >= 0; k--) {
    const u = cl((t - (it[k].a - 2 * TAU)) / TAU, 0, 1);
    x -= it[k].w * u;
    out[k] = x;
  }
  if (t > L.j0) {
    const p = ease((t - L.j0) / (L.j1 - L.j0));
    for (let k = 0; k < n; k++) out[k] += (it[k].fx - out[k]) * p;
  }
  return out;
}

// A slug: one bar of type metal the width of the measure, its face the
// line in relief and in mirror image. Fresh from the mould it is pale and
// warm, and it cools to the grey of the galley.
function slug(S, L, y, heat) {
  const C = S.col, c = S.c, x0 = ENT - S.M, x1 = ENT - 1;
  for (let r = 0; r < SLUG; r++) {
    const base = r === 0 || r === SLUG - 1 ? C.shoulder : C.body, hot = r === 0 || r === SLUG - 1 ? HOT_S : HOT_B;
    for (let q = 0; q < 3; q++) c[q] = base[q] + (hot[q] - base[q]) * heat;
    for (let x = x0; x <= x1; x++) paint(S, x, y + r, c);
  }
  for (let q = 0; q < 3; q++) c[q] = C.face[q] + (HOT_F[q] - C.face[q]) * heat;
  for (const m of L.items) {
    if (m.sp) continue;
    const g = GL[m.ch];
    for (let i = 0; i < g.w; i++) for (let r = 0; r < 5; r++) if (g.px[r][i]) paint(S, x0 + x1 - (m.fx + i), y + 1 + r, c);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.active) return;
  const t = S.t, b = S.buf, hue = S.hue;
  b.fill(0);
  S.col = {
    brass: hsv(hue + 0.13, 0.55, 1, [0, 0, 0]),
    ear: hsv(hue + 0.12, 0.6, 0.62, [0, 0, 0]),
    plate: hsv(hue + 0.12, 0.6, 0.12, [0, 0, 0]),
    fill: hsv(hue + 0.12, 0.6, 0.7, [0, 0, 0]),
    steel: hsv(hue + 0.58, 0.25, 0.3, [0, 0, 0]),
    band: hsv(hue + 0.58, 0.15, 0.85, [0, 0, 0]),
    body: hsv(hue + 0.58, 0.1, 0.36, [0, 0, 0]),
    shoulder: hsv(hue + 0.58, 0.12, 0.22, [0, 0, 0]),
    face: hsv(hue + 0.58, 0.06, 0.9, [0, 0, 0]),
  };
  const C = S.col, pos = [];

  // Lines lifted back to the top, behind everything, dim while they rise.
  for (const L of S.active) {
    if (t < L.l0 || t > L.end) continue;
    const y = t < L.l1 ? MOULD + (1 - MOULD) * ease((t - L.l0) / TL) : 1, a = t < L.l1 ? 0.5 : 1;
    const shift = t > L.l1 ? VF * (t - L.l1) : 0;
    for (const m of L.items) if (!m.sp && t < m.tin) matrix(S, m.ch, m.fx + shift, y, a);
  }

  // The frame: distributor bar and box, magazine walls, belt, rail.
  for (let x = 0; x < BOXX; x++) paint(S, x, BAR, C.steel);
  for (let y = 0; y <= BAR; y++) for (let x = BOXX; x < W; x++) paint(S, x, y, y === 0 || y === BAR || x === BOXX ? C.steel : [0, 0, 0]);
  for (let i = 0; i <= ORDER.length; i++) for (let y = MAG0; y <= MAG1; y++) paint(S, 2 * i, y, C.steel);
  for (let x = 0; x <= ENT - 4; x++) paint(S, x, LINE - LIP + 7 - SLOPE * (ENT - 4 - x), C.steel, 0.8);
  for (let x = ENT - S.M - 1; x <= ENT; x++) paint(S, x, RAIL, C.steel);
  for (let y = 44; y <= 54; y++) for (let x = 61; x < W; x++) paint(S, x, y, y === 44 || x === 61 ? C.steel : [0, 0, 0]);
  // The mould's jaws, warm while the metal is in.
  let glow = 0;
  for (const L of S.active) if (t >= L.d1) glow = max(glow, t < L.l0 ? 1 : exp(-(t - L.l0) / 0.4));
  for (let y = CAV - 1; y <= CAV + SLUG; y++)
    for (const x of [ENT - S.M - 1, ENT]) {
      paint(S, x, y, C.steel);
      paint(S, x, y, MOLTEN, glow * 0.8);
    }

  // Magazine fills: each channel's matrices stacked from its escapement.
  const count = BASE.slice();
  for (const L of S.active)
    for (const m of L.items) if (!m.sp && t >= m.r && t < (m.back ?? 1e9)) count[m.ci]--;
  for (let i = 0; i < ORDER.length; i++)
    for (let r = 0; r < min(MAG1 - MAG0 + 1, max(0, count[i])); r++) paint(S, chX(i), MAG1 - r, r === count[i] - 1 ? C.brass : C.fill);

  for (const L of S.active) {
    across(L, t, pos);
    const yLine = t < L.j1 ? LINE : t < L.d1 ? LINE + (MOULD - LINE) * ease((t - L.j1) / TD) : MOULD;
    const rise = L.just ? RISE * ease((t - L.j0) / TJ) : 0;
    for (let k = 0; k < L.items.length; k++) {
      const m = L.items[k];
      if (t < m.r) continue;
      if (m.sp) {
        if (t < m.a) band(S, ENT - GMIN, 49 + (LINE - 49) * ((t - m.r) / TSB), GMIN, 0);
        else if (t < L.l0) {
          const w = t < L.j0 ? GMIN : GMIN + (m.fw - GMIN) * ease((t - L.j0) / TJ);
          band(S, pos[k], yLine, round(w), rise);
        } else if (t < L.l0 + 0.4) band(S, pos[k] + 120 * (t - L.l0), yLine, m.fw, rise);
        continue;
      }
      if (t < m.a) {
        // Falling from the escapement, riding the belt to its end above the
        // entrance, then dropping into the line once the line has moved up.
        const tf = t - m.r;
        if (tf < m.tf) matrix(S, m.ch, m.x0, ESC + 0.5 * G * tf * tf, 1);
        else if (t < m.a - TAU) {
          const x = m.x0 + VB * (tf - m.tf);
          matrix(S, m.ch, x, LINE - LIP - SLOPE * (ENT - m.w - x), 1);
        } else {
          const u = (t - (m.a - TAU)) / TAU;
          matrix(S, m.ch, ENT - m.w, LINE - LIP * (1 - u * u), 1);
        }
      } else if (t < L.l0) matrix(S, m.ch, pos[k], yLine, 1);
      else if (t >= m.tout && t < m.back) {
        // Along the distributor bar to its channel, then down into it.
        const x = max(m.xc, BOXX - m.w - VBAR * (t - m.tout));
        const y = t < m.tdrop ? HANG : HANG + (MAG0 - HANG) * ((t - m.tdrop) / TCH);
        matrix(S, m.ch, x, y, 1);
      }
    }
    // The cast: metal pumped into the mould behind the line, left to right.
    if (t >= L.d1 && t < L.l0) {
      const x0 = ENT - S.M, f = (t - L.d1) / TP;
      if (f < 1) {
        const xe = x0 + S.M * f;
        for (let y = CAV; y < CAV + SLUG; y++) for (let x = x0; x < xe; x++) paint(S, x, y, MOLTEN);
      } else slug(S, L, CAV, 1);
    }
  }

  // The galley: the newest slug at the top, each pushing the earlier down.
  const sl = S.slugs.filter((s) => s.tE <= t);
  for (let i = sl.length - 1; i >= 0; i--) {
    let y = CAV + (GAL - CAV) * ease((t - sl[i].tE) / TE);
    for (let j = i + 1; j < sl.length; j++) y += SLUG * ease((t - sl[j].tE) / TE);
    if (y < H) slug(S, sl[i].L, y, exp(-max(0, t - sl[i].hot - TP) / COOL));
  }

  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(cl(b[p * 3], 0, 1) * 255), round(cl(b[p * 3 + 1], 0, 1) * 255), round(cl(b[p * 3 + 2], 0, 1) * 255));
}
