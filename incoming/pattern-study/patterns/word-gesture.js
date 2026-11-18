// ===== Patternflow pattern =====
// Title:   Word Gesture
// Family:  type
// Idea:    Five keyboards stand stacked on the panel, QWERTY, AZERTY, Dvorak, Colemak and Workman, and one word is slid through them one after the other as a single stroke, a bright comet running through the key centres of each board in turn and leaving a trace in that board's colour, the letters lighting on their keys and in the word at the foot as it passes, so the same word draws five different shapes, and a knob picks the word or turns the angular key-to-key polyline into a rounded finger stroke.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: word-gesture typing, one stroke through the letters of a word whose shape a recogniser matches against a dictionary, from Shumin Zhai and Per Ola Kristensson, "Shorthand writing on stylus keyboard" (CHI 2003, the SHARK system) and SHARK2 (Kristensson and Zhai, UIST 2004), later on phones as ShapeWriter and Swype; layouts QWERTY (Christopher Latham Sholes, 1873), Dvorak (August Dvorak and William Dealey, 1936), Colemak (Shai Coleman, 2006), AZERTY and Workman; the 3 by 5 letters and the word list drawn for this pattern, pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..23, Smooth=0..1
//
// Knob 1: Hue. Turns all five boards round the wheel together. At 0 QWERTY is aqua, AZERTY magenta, Dvorak green, Colemak blue and Workman red, each board's keys dim in its own colour and its stroke bright; at 0.25 violet, orange, azure, pink and lime; at 0.5 red, green, pink, yellow and aqua. Orange and yellow are paled so they do not read as brown.
// Knob 2: Speed. The comet runs 85 LEDs a second at 2, so a stroke of 150 LEDs takes 1.8 s. A word takes 6.4 s (paik) to 12 s (mirror) from its first key to the next word's, 9.1 s on average, 2.2 s of it the finished word held, and the 24 come round in 3 min 40 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Word. Picks one of 24 words by number, 0 keyboard, 1 pattern, 2 flow and on to 23 sarang. The picture changes at once: the old strokes dissolve in a fifth of a second and the comet starts the new word on QWERTY. After a turn the word repeats instead of moving on, until the knob has rested for 20 s, and then the list goes on from that word.
// Knob 4: Smooth. 0 is the polyline, straight from key centre to key centre as the recogniser stores a word. Turned up, the same keys are joined by a Catmull-Rom curve that rounds every turn, and each chord bows to the right of travel as a hand pivoting at the wrist draws it, by up to 14 per cent of its length and 6 LEDs at 1, where the stroke overshoots and loops where the direction reverses. The opening 0.06 is nearly the polyline.

// Five boards stand in the panel, 17 rows tall and 21 apart, from row 3 down
// to row 103. Under them the word is set at double size on rows 109 to 118,
// and the name of the board the comet is on on rows 122 to 126. A key is 5.8
// LEDs across and 6 down, so a board is 58 LEDs wide, and a key stands in the
// same place on all five, which is what lets the five strokes be compared.
//
// A word plays on the boards one after the other. The comet runs along the
// stroke at 85 LEDs a second, 0.12 s passes between one board and the next,
// the finished word holds 2.2 s, and then the next word starts, or the same
// one again for 20 s after a turn of the Word knob. The trace behind the
// comet fades from white-hot over about 8 LEDs to 78 per cent of the board's
// colour and stays, so by the end the five shapes stand together.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, hypot, exp, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// A colour of this hue at this level. Orange and yellow turn brown and olive
// when they are dim, so near them the colour is paled and lifted; blue and
// red carry a third of green's light at the same level, so they are lifted
// too, the way a dim blue key would otherwise vanish beside a green one.
function sat(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), u = exp(-(((f - 0.66) / 0.07) ** 2));
  return 1 - 0.3 * b - 0.22 * u;
}
function gain(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), c = hsv(h, sat(h), 1);
  return cl(0.5 / (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114), 1, 2) * (1 + 0.5 * b);
}
function tone(h, v) {
  return hsv(h, sat(h), min(1, v * gain(h)));
}

// ---- The face: 26 capitals, 3 wide and 5 tall, one string a row.
const FONT = {
  a: [".#.", "#.#", "###", "#.#", "#.#"],
  b: ["##.", "#.#", "##.", "#.#", "##."],
  c: [".##", "#..", "#..", "#..", ".##"],
  d: ["##.", "#.#", "#.#", "#.#", "##."],
  e: ["###", "#..", "##.", "#..", "###"],
  f: ["###", "#..", "##.", "#..", "#.."],
  g: [".##", "#..", "#.#", "#.#", ".##"],
  h: ["#.#", "#.#", "###", "#.#", "#.#"],
  i: ["###", ".#.", ".#.", ".#.", "###"],
  j: ["..#", "..#", "..#", "#.#", ".#."],
  k: ["#.#", "#.#", "##.", "#.#", "#.#"],
  l: ["#..", "#..", "#..", "#..", "###"],
  m: ["#.#", "###", "###", "#.#", "#.#"],
  n: ["##.", "#.#", "#.#", "#.#", "#.#"],
  o: [".#.", "#.#", "#.#", "#.#", ".#."],
  p: ["##.", "#.#", "##.", "#..", "#.."],
  q: [".#.", "#.#", "#.#", "###", ".##"],
  r: ["##.", "#.#", "##.", "#.#", "#.#"],
  s: [".##", "#..", ".#.", "..#", "##."],
  t: ["###", ".#.", ".#.", ".#.", ".#."],
  u: ["#.#", "#.#", "#.#", "#.#", "###"],
  v: ["#.#", "#.#", "#.#", "#.#", ".#."],
  w: ["#.#", "#.#", "###", "###", "#.#"],
  x: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  z: ["###", "..#", ".#.", "#..", "###"],
};
const GLY = {};
for (const ch of Object.keys(FONT)) {
  const px = [];
  FONT[ch].forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  GLY[ch] = px;
}

// ---- The boards: the three letter rows of each, "." for a key that holds no
// letter (Dvorak's ' , . and ; keys, the semicolon on Colemak and Workman).
// All five sit on the same ANSI stagger, 0, a quarter and three quarters of a
// key, though a real AZERTY board is an ISO one. A key is 5.8 LEDs across and
// 6 down, so a key is nearly square, and a 3 by 5 letter sits in its middle.
const BOARDS = [
  ["QWERTY", "qwertyuiop", "asdfghjkl", "zxcvbnm", 0.0],
  ["AZERTY", "azertyuiop", "qsdfghjklm", "wxcvbn", 0.34],
  ["DVORAK", "...pyfgcrl", "aoeuidhtns", ".qjkxbmwvz", 0.83],
  ["COLEMAK", "qwfpgjluy.", "arstdhneio", "zxcvbkm", 0.16],
  ["WORKMAN", "qdrwbjfup.", "ashtgyneoi", "zxmcvkl", 0.48],
];
const PX = 5.8, RY = 6, X0 = 2, STAG = [0, 0.25, 0.75];
const TOP = [3, 24, 45, 66, 87];
const HUE0 = 0.5;
const keyOf = BOARDS.map((b, k) => {
  const keys = {};
  for (let r = 0; r < 3; r++)
    [...b[r + 1]].forEach((ch, c) => {
      if (ch === ".") return;
      const x0 = X0 + round((c + STAG[r]) * PX), y0 = TOP[k] + r * RY;
      keys[ch] = { x0, y0, cx: x0 + 1, cy: y0 + 2 };
    });
  return keys;
});

// ---- Twenty-four words, none over eight letters so each fits the foot at
// double size. Each has a letter that sits differently on AZERTY (a, m, w, q or
// z); a word without one draws the same stroke on QWERTY and on AZERTY.
const WORDS = [
  "keyboard", "pattern", "flow", "panel", "rhythm", "paik", "hangul", "arirang", "dokkaebi", "swipe", "shape", "signal",
  "rotary", "wave", "dial", "music", "dance", "dream", "tempo", "lantern", "mirror", "word", "kimchi", "sarang",
];

// ---- The stroke. The word's letters become key centres; a letter doubled
// in a row is one key, as in a gesture keyboard. The polyline is straight
// between centres. The smooth stroke is a Catmull-Rom curve through the same
// centres, and Smooth blends the two point by point, so the stroke always
// passes through every key.
function rom(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3);
}

function buildPath(k, ls, s) {
  const P = ls.map((ch) => keyOf[k][ch]);
  const m = P.length, X = [], Y = [], V = [];
  for (let i = 0; i < m - 1; i++) {
    const a = P[max(0, i - 1)], b = P[i], c = P[i + 1], d = P[min(m - 1, i + 2)];
    const chord = hypot(c.cx - b.cx, c.cy - b.cy), n = cl(ceil(chord / 0.6), 4, 60);
    // A hand pivoting at the wrist draws every chord a little curved to its
    // right; the bow is 14 per cent of the chord, at most 6 LEDs, so it
    // stays near the board.
    const bow = s * min(6, 0.14 * chord), nx = chord ? -(c.cy - b.cy) / chord : 0, ny = chord ? (c.cx - b.cx) / chord : 0;
    V.push(X.length);
    for (let j = 0; j < n; j++) {
      const u = j / n, o = bow * Math.sin(Math.PI * u);
      X.push(lerp(lerp(b.cx, c.cx, u), rom(a.cx, b.cx, c.cx, d.cx, u), s) + nx * o);
      Y.push(lerp(lerp(b.cy, c.cy, u), rom(a.cy, b.cy, c.cy, d.cy, u), s) + ny * o);
    }
  }
  V.push(X.length);
  X.push(P[m - 1].cx);
  Y.push(P[m - 1].cy);
  const arc = [0];
  for (let i = 1; i < X.length; i++) arc.push(arc[i - 1] + hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]));
  return { X, Y, arc, len: arc[arc.length - 1], vArc: V.map((i) => arc[i]), ls };
}

function newWord(S, idx) {
  const word = WORDS[idx];
  const ls = [...word].filter((c, i, a) => i === 0 || a[i - 1] !== c);
  // For each letter of the word, the vertex it is on, so a doubled letter
  // lights once.
  const L2V = [];
  let v = -1;
  [...word].forEach((c, i, a) => {
    if (i === 0 || a[i - 1] !== c) v++;
    L2V.push(v);
  });
  const paths = BOARDS.map((_, k) => buildPath(k, ls, S.s));
  return {
    idx, word, ls, L2V, paths,
    p: BOARDS.map(() => -1),
    hit: BOARDS.map(() => ls.map(() => -1)),
    done: BOARDS.map(() => -9),
    phase: 0, wait: 0, hold: 0, clock: 0,
  };
}

export function setup(params) {
  params.s = {
    s: 0, speed: 2, ghost: null, a: 1, last: -1, since: 99,
    cur: null, act: BOARDS.map(() => 0),
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
    tr: new Float32Array(N), wf: new Float32Array(N), touched: new Int32Array(N), nt: 0,
  };
}

const COMET = 85, GAP = 0.12, HOLD = 2.2, TAU = 8, FLOOR = 0.78, MANUAL = 20;

function start(S, idx) {
  if (S.cur) {
    S.ghost = S.cur;
    S.a = 1;
  }
  S.cur = newWord(S, idx);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.05, 3);
  const s = cl(k[3], 0, 1), want = cl(round(k[2]), 0, WORDS.length - 1);
  const step = (dt * S.speed) / 2;
  S.since += dt;
  if (S.last < 0) {
    S.s = s;
    S.last = want;
    start(S, want);
    S.ghost = null;
  } else if (want !== S.last) {
    // A turn of the knob: the new word starts this frame, and the next
    // twenty seconds repeat it instead of moving on.
    S.last = want;
    S.since = 0;
    start(S, want);
  }
  if (abs(s - S.s) > 0.004) {
    S.s = s;
    S.cur.paths = BOARDS.map((_, b) => buildPath(b, S.cur.ls, s));
  }
  if (S.ghost) {
    S.a -= dt / 0.22;
    if (S.a <= 0) S.ghost = null;
  }
  const C = S.cur;
  C.clock += step;
  if (C.phase < BOARDS.length) {
    const b = C.phase;
    if (C.wait > 0) C.wait -= step;
    else {
      const pa = C.paths[b];
      C.p[b] = min(1, max(0, C.p[b]) + (COMET * step) / pa.len);
      pa.vArc.forEach((va, i) => {
        if (C.hit[b][i] < 0 && C.p[b] * pa.len >= va - 1e-6) C.hit[b][i] = C.clock;
      });
      if (C.p[b] >= 1) {
        C.done[b] = C.clock;
        C.phase++;
        C.wait = GAP;
      }
    }
  } else {
    C.hold += step;
    if (C.hold >= HOLD) start(S, S.since < MANUAL ? C.idx : (C.idx + 1) % WORDS.length);
  }
  // The board the comet is on lights its keys a little.
  const on = min(C.phase, BOARDS.length - 1);
  for (let b = 0; b < BOARDS.length; b++) S.act[b] += ((b === on ? 1 : 0) - S.act[b]) * min(1, dt * 7);
}

function add(S, i, r, g, b) {
  S.R[i] += r;
  S.G[i] += g;
  S.B[i] += b;
}

function glyph(S, ch, x0, y0, r, g, b, scale) {
  const px = GLY[ch];
  for (let i = 0; i < px.length; i += 2)
    for (let dy = 0; dy < scale; dy++)
      for (let dx = 0; dx < scale; dx++) {
        const x = x0 + px[i] * scale + dx, y = y0 + px[i + 1] * scale + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = y * W + x;
        S.R[o] = max(S.R[o], r);
        S.G[o] = max(S.G[o], g);
        S.B[o] = max(S.B[o], b);
      }
}

const mix3 = (c, w, t) => [lerp(c[0], w, t), lerp(c[1], w, t), lerp(c[2], w, t)];

// How lit a key is for a word's pass over a board: 0 not yet, otherwise a
// level that flashes white as the comet arrives and settles.
function lit(Wd, b, ch) {
  if (!Wd) return null;
  const i = Wd.paths[b].ls.indexOf(ch);
  if (i < 0) return null;
  // A key the stroke visits twice counts from its first visit.
  let t = -1;
  Wd.paths[b].ls.forEach((c, j) => {
    if (c === ch && Wd.hit[b][j] >= 0 && (t < 0 || Wd.hit[b][j] < t)) t = Wd.hit[b][j];
  });
  if (t < 0) return null;
  const f = exp(-(Wd.clock - t) / 0.3);
  return { v: 0.55 + 0.4 * f, w: 0.2 + 0.65 * f };
}

function keys(S, hue) {
  for (let b = 0; b < BOARDS.length; b++) {
    const h = hue + BOARDS[b][4] + HUE0;
    const base = 0.25 + 0.12 * S.act[b];
    for (const ch of Object.keys(keyOf[b])) {
      const key = keyOf[b][ch];
      let v = base, w = 0, sat = 0.55;
      for (const [Wd, al] of [[S.ghost, S.a], [S.cur, 1]]) {
        const l = lit(Wd, b, ch);
        if (l && l.v * al > v) (v = l.v * al), (w = l.w * al), (sat = 1);
      }
      const c = tone(h, v);
      const grey = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
      const q = sat < 1 ? [lerp(grey, c[0], sat), lerp(grey, c[1], sat), lerp(grey, c[2], sat)] : c;
      const m = mix3(q, v, w);
      glyph(S, ch, key.x0, key.y0, m[0], m[1], m[2], 1);
    }
  }
}

// One word's strokes. The trace behind the comet fades from white-hot to the
// board's colour and settles at FLOOR, so the finished shapes stay.
function strokes(S, Wd, al, hue) {
  for (let b = 0; b < BOARDS.length; b++) {
    if (Wd.p[b] < 0) continue;
    const pa = Wd.paths[b], head = Wd.p[b] * pa.len, h = hue + BOARDS[b][4] + HUE0;
    const col = hsv(h, sat(h), 1), g = gain(h);
    S.nt = 0;
    for (let i = 0; i < pa.X.length && pa.arc[i] <= head; i++) {
      const d = head - pa.arc[i];
      const I = FLOOR + (1 - FLOOR) * exp(-d / TAU), white = 0.7 * exp(-d / 3.5);
      const x = pa.X[i], y = pa.Y[i];
      for (let py = round(y) - 1; py <= round(y) + 1; py++)
        for (let px = round(x) - 1; px <= round(x) + 1; px++) {
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const w = cl((1.15 - hypot(px - x, py - y)) / 0.7, 0, 1) * I;
          const o = py * W + px;
          if (w > S.tr[o]) {
            if (S.tr[o] === 0) S.touched[S.nt++] = o;
            S.tr[o] = w;
            S.wf[o] = white;
          }
        }
    }
    for (let j = 0; j < S.nt; j++) {
      const o = S.touched[j], v = min(1, S.tr[o] * g) * al, w = S.wf[o];
      add(S, o, lerp(col[0], 1, w) * v, lerp(col[1], 1, w) * v, lerp(col[2], 1, w) * v);
      S.tr[o] = 0;
    }
    // The comet's head, a small hot disc, fading a third of a second after
    // it has arrived.
    const age = Wd.clock - Wd.done[b];
    const glow = Wd.p[b] < 1 ? 1 : exp(-age / 0.15);
    if (glow > 0.02) {
      let i = 0;
      while (i < pa.X.length - 1 && pa.arc[i + 1] < head) i++;
      const x = pa.X[i], y = pa.Y[i];
      for (let py = round(y) - 2; py <= round(y) + 2; py++)
        for (let px = round(x) - 2; px <= round(x) + 2; px++) {
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const w = cl(1 - hypot(px - x, py - y) / 2.3, 0, 1) ** 1.4 * glow * al;
          if (w > 0.01) add(S, py * W + px, lerp(col[0], 1, 0.75) * w, lerp(col[1], 1, 0.75) * w, lerp(col[2], 1, 0.75) * w);
        }
    }
  }
}

// The word at the foot at double size, each letter taking the colour of the
// board the comet is on as it arrives; letters it has not reached yet keep
// the previous board's colour.
function foot(S, hue) {
  const C = S.cur, kb = min(C.phase, BOARDS.length - 1), n = C.word.length;
  const wid = n * 8 - 2, x0 = floor((W - wid) / 2);
  const now = tone(hue + BOARDS[kb][4] + HUE0, 0.95);
  const before = kb > 0 ? tone(hue + BOARDS[kb - 1][4] + HUE0, 0.7) : tone(hue + BOARDS[kb][4] + HUE0, 0.2);
  for (let i = 0; i < n; i++) {
    const t = C.hit[kb][C.L2V[i]];
    let c = before;
    if (t >= 0) {
      const f = exp(-(C.clock - t) / 0.3);
      c = mix3(now, 1, 0.8 * f);
    }
    glyph(S, C.word[i], x0 + i * 8, 109, c[0], c[1], c[2], 2);
  }
  // The name of the board, at single size.
  const name = BOARDS[kb][0], lc = tone(hue + BOARDS[kb][4] + HUE0, 0.6);
  const nx = floor((W - (name.length * 4 - 1)) / 2);
  for (let i = 0; i < name.length; i++) glyph(S, name[i].toLowerCase(), nx + i * 4, 122, lc[0], lc[1], lc[2], 1);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  S.R.fill(0);
  S.G.fill(0);
  S.B.fill(0);
  keys(S, S.hue);
  if (S.ghost) strokes(S, S.ghost, S.a, S.hue);
  strokes(S, S.cur, 1, S.hue);
  foot(S, S.hue);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const r = S.R[o], g = S.G[o], b = S.B[o];
      if (r + g + b > 0.004) display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
}
