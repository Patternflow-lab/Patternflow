// ===== Patternflow pattern =====
// Title:   Dokkaebibul
// Family:  type
// Idea:    Yun Dong-ju's Prelude is typed key by key on a two-set Korean keyboard at the foot of the panel and builds itself in 18-LED syllables as the input method builds them: a consonant typed after a whole syllable sits as its final, and when the next key is a vowel it leaps out as a cyan flame along a glowing arc to start the next syllable, the jump Korean typists call dokkaebibul, the will-o'-the-wisp.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the two-set (dubeolsik) Hangul keyboard and its syllable automaton, standardised as KS C 5715 (1982, now KS X 5002); the text is Yun Dong-ju's Seosi (Prelude), written 20 November 1941; jamo strokes and slots after the Jamo Assembly pattern (round 63); pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phrase=0..8, Trail=0..1
//
// Knob 1: Hue. Turns all the colours. At 0 the ink is gold, the syllable being composed pale gold on a faint cyan box, the flame, its arc and its light cyan, the vowel keys lilac; at 0.5 the ink is blue and the flame red.
// Knob 2: Speed. At 2 about three keys a second (0.25 to 0.41 s apart, 0.25 s more after a space); a jump flies 0.42 s, and a finished line holds 2.4 s and fades in 0.8 s. The first line's 30 keys take 10.4 s, the whole poem with its 38 jumps 2 minutes. Times go as 2 / Speed.
// Knob 3: Phrase. The line to start from, 0 to 8, then on through the poem. Line 0 (죽는 날까지 하늘을 우러러) has 4 jumps in 30 keys; line 8 (오늘 밤에도 별이 바람에 스치운다.) has 5 in 38 and needs a sixth row, so the page scrolls.
// Knob 4: Trail. How long a jump's glow stays. Each point of the arc fades with a time constant of 0.31 s at the opening 0.06, 1.6 s at 0.5 and 10 s at 1, where a whole line's arcs stay; the arc widens from 5 to 8 LEDs, and a landed consonant cools to ink, and stops lighting the letters within 34 LEDs, over twice that time.

// Nothing on the two-set keyboard says where a syllable ends, so the
// input method decides as the keys come. A consonant after an initial and
// a vowel is taken as the final (받침): 하 + ㄴ shows 한. Another consonant
// ends the syllable or makes a cluster such as ㅄ. A vowel cannot follow
// the final, since a syllable needs a consonant before its vowel: 한 + ㅡ
// becomes 하느, and a cluster gives up its second letter (없 + ㅓ is 업서).
// Users call that jump dokkaebibul, the goblin fire that hops at night.
//
// The keys come from the poem's syllables (ㅚ is ㅗ then ㅣ; ㄲ and ㅆ one
// key with shift); script() runs them through the automaton, which gives
// back each of the nine lines exactly. Syllables are 18 by 18 blocks,
// three to a row and five rows down; the page scrolls a row when a line
// needs a sixth. A letter is strokes on a 20 by 20 grid set in a slot that
// depends on the vowel's shape and on the final; when a key changes the
// syllable its letters slide to their new slots in 0.12 s.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp, cos, sin, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Yun Dong-ju, Seosi, the nine lines without the title.
const POEM = [
  "죽는 날까지 하늘을 우러러",
  "한 점 부끄럼이 없기를,",
  "잎새에 이는 바람에도",
  "나는 괴로워했다.",
  "별을 노래하는 마음으로",
  "모든 죽어 가는 것을 사랑해야지",
  "그리고 나한테 주어진 길을",
  "걸어가야겠다.",
  "오늘 밤에도 별이 바람에 스치운다.",
];

// ---- Jamo. Initials, vowels and finals in Unicode order.
const LS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const VS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const TS = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
// Compound vowels and clusters as the two keys that make them.
const PAIR = { ㅘ: "ㅗㅏ", ㅙ: "ㅗㅐ", ㅚ: "ㅗㅣ", ㅝ: "ㅜㅓ", ㅞ: "ㅜㅔ", ㅟ: "ㅜㅣ", ㅢ: "ㅡㅣ", ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ" };
const JOIN = {};
for (const k in PAIR) JOIN[PAIR[k]] = k;
// Tense consonants are drawn as two of the plain letter.
const TENSE = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅉ: "ㅈ", ㅆ: "ㅅ" };
const isVowel = (j) => VS.includes(j);

// ---- The keyboard (KS X 5002): rows, and the shifted keys.
const ROWS = ["ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ", "ㅁㄴㅇㄹㅎㅗㅓㅏㅣ", "ㅋㅌㅊㅍㅠㅜㅡ"];
const SHIFTED = { ㅃ: "ㅂ", ㅉ: "ㅈ", ㄸ: "ㄷ", ㄲ: "ㄱ", ㅆ: "ㅅ", ㅒ: "ㅐ", ㅖ: "ㅔ" };
const ROW_X = [2, 4, 8], KEY_Y = 110, PITCH = 6;
// 5 by 5 key caps, rows top to bottom, 16 the left column.
const CAP = {
  ㅂ: [17, 17, 31, 17, 31], ㅈ: [31, 4, 10, 17, 17], ㄷ: [31, 16, 16, 16, 31], ㄱ: [31, 1, 1, 1, 1], ㅅ: [4, 4, 10, 17, 17],
  ㅛ: [0, 10, 10, 31, 0], ㅕ: [2, 30, 2, 30, 2], ㅑ: [8, 15, 8, 15, 8], ㅐ: [10, 10, 14, 10, 10], ㅔ: [5, 5, 29, 5, 5],
  ㅁ: [31, 17, 17, 17, 31], ㄴ: [16, 16, 16, 16, 31], ㅇ: [14, 17, 17, 17, 14], ㄹ: [31, 1, 31, 16, 31], ㅎ: [4, 31, 14, 17, 14],
  ㅗ: [0, 4, 4, 31, 0], ㅓ: [2, 2, 30, 2, 2], ㅏ: [8, 8, 15, 8, 8], ㅣ: [4, 4, 4, 4, 4],
  ㅋ: [31, 1, 31, 1, 1], ㅌ: [31, 16, 31, 16, 31], ㅊ: [4, 31, 4, 10, 17], ㅍ: [31, 10, 10, 10, 31], ㅠ: [0, 31, 10, 10, 0],
  ㅜ: [0, 31, 4, 4, 0], ㅡ: [0, 0, 31, 0, 0], "⇧": [4, 14, 31, 14, 14],
};
const KEYPOS = {};
ROWS.forEach((row, r) => [...row].forEach((j, i) => (KEYPOS[j] = [ROW_X[r] + i * PITCH, KEY_Y + r * PITCH])));
KEYPOS["⇧"] = [1, KEY_Y + 2 * PITCH];

// ---- Letters as strokes on a 20 by 20 grid (from Jamo Assembly, round 63).
// A stroke is a polyline of x, y pairs; one that starts with O is an
// ellipse cx, cy, rx, ry.
const O = -1;
const BASE = {
  ㄱ: [[3, 3, 17, 3, 17, 18]],
  ㄴ: [[3, 2, 3, 17, 18, 17]],
  ㄷ: [[17, 3, 3, 3, 3, 17, 18, 17]],
  ㄹ: [[3, 2, 17, 2, 17, 10, 3, 10, 3, 18, 18, 18]],
  ㅁ: [[3, 3, 17, 3, 17, 17, 3, 17, 3, 3]],
  ㅂ: [[3, 2, 3, 18, 17, 18, 17, 2], [3, 10, 17, 10]],
  ㅅ: [[10, 2, 2, 18], [10, 2, 18, 18]],
  ㅇ: [[O, 10, 10, 7.5, 7.5]],
  ㅈ: [[3, 3, 17, 3], [10, 3, 3, 18], [10, 3, 17, 18]],
  ㅊ: [[10, 0, 10, 4], [3, 5, 17, 5], [10, 5, 3, 19], [10, 5, 17, 19]],
  ㅋ: [[3, 3, 17, 3, 17, 18], [3, 10, 17, 10]],
  ㅌ: [[17, 2, 3, 2, 3, 18, 18, 18], [3, 10, 17, 10]],
  ㅍ: [[2, 3, 18, 3], [2, 17, 18, 17], [7, 3, 7, 17], [13, 3, 13, 17]],
  ㅎ: [[10, 0, 10, 3], [3, 5, 17, 5], [O, 10, 13, 5.5, 5]],
  ㅣ: [[10, 1, 10, 19]],
  ㅏ: [[7, 1, 7, 19], [7, 10, 17, 10]],
  ㅑ: [[7, 1, 7, 19], [7, 7, 17, 7], [7, 13, 17, 13]],
  ㅓ: [[13, 1, 13, 19], [3, 10, 13, 10]],
  ㅕ: [[13, 1, 13, 19], [3, 7, 13, 7], [3, 13, 13, 13]],
  ㅐ: [[5, 1, 5, 19], [5, 10, 13, 10], [15, 0, 15, 20]],
  ㅒ: [[5, 1, 5, 19], [5, 7, 13, 7], [5, 13, 13, 13], [15, 0, 15, 20]],
  ㅔ: [[2, 10, 9, 10], [9, 1, 9, 19], [16, 0, 16, 20]],
  ㅖ: [[2, 7, 9, 7], [2, 13, 9, 13], [9, 1, 9, 19], [16, 0, 16, 20]],
  ㅡ: [[1, 10, 19, 10]],
  ㅗ: [[10, 4, 10, 13], [1, 13, 19, 13]],
  ㅛ: [[7, 4, 7, 13], [13, 4, 13, 13], [1, 13, 19, 13]],
  ㅜ: [[1, 7, 19, 7], [10, 7, 10, 16]],
  ㅠ: [[1, 7, 19, 7], [7, 7, 7, 16], [13, 7, 13, 16]],
  ".": [[3, 16, 4, 17]],
  ",": [[4, 15, 2, 19]],
};
const HORIZONTAL = "ㅗㅛㅜㅠㅡ";
// Slots on the 20 by 20 block, [x, y, w, h]: initial, vowel parts, final.
const SLOTS = {
  V: [[1, 3, 11, 14], [[12, 0, 7, 20]]],
  VF: [[1, 1, 11, 10], [[12, 0, 7, 12]], [3, 13, 14, 7]],
  H: [[3, 1, 14, 10], [[0, 10, 20, 9]]],
  HF: [[3, 0, 14, 7], [[0, 6, 20, 6]], [3, 13, 14, 7]],
  C: [[1, 1, 11, 9], [[0, 9, 14, 8], [13, 0, 7, 20]]],
  CF: [[1, 0, 11, 6], [[0, 5, 14, 6], [13, 0, 7, 13]], [3, 13, 14, 7]],
};
const ALONE = [3, 2, 14, 16];

// Cells: 21 LEDs apart, the 18 by 18 block inside each.
const CELL = 21, BLOCK = 18, COLS = 3, ROWS_SHOWN = 5, TOP = 1, TEXT_BOTTOM = 107;

// Script timings in seconds at Speed 2.
const KEY = 0.33, SPACE = 0.25, FLY = 0.42, SLIDE = 0.12, HOLD = 2.4, FADE = 0.8, LEAD = 0.4;

// ---- The automaton. A syllable is { L: [key], V: [keys], T: [keys] }.
const syl = (L, V, T) => ({ L, V, T });
const copy = (s) => syl(s.L.slice(), s.V.slice(), s.T.slice());
const PUNCT = ",.";

// The keys of a line, from its syllables.
function keysOf(text) {
  const keys = [];
  for (const ch of text) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c >= 11172) keys.push(ch);
    else {
      const v = VS[floor((c % 588) / 28)], t = TS[c % 28];
      keys.push(LS[floor(c / 588)], ...(PAIR[v] || v));
      if (t !== " ") keys.push(...(PAIR[t] || t));
    }
  }
  return keys;
}

// A typist's unevenness, the same every time a line comes round.
const jitter = (n) => {
  const v = sin(n * 12.9898 + 4.1) * 43758.5453;
  return 0.75 + 0.5 * (v - floor(v));
};

// Each cell keeps the history of its syllable; each event is a key, the
// cell it went to and the jump it caused, if any.
function script(text) {
  const cells = [], events = [];
  let cur = -1, t = LEAD, row = 0, col = 0, n = text.length * 7;
  const place = () => {
    if (col === COLS) { col = 0; row++; }
    cells.push({ row, col: col++, hist: [{ t: -1, s: syl([], [], []) }] });
    return cells.length - 1;
  };
  const set = (i, s) => cells[i].hist.push({ t, s });
  const fresh = (s) => set((cur = place()), s);
  for (const k of keysOf(text)) {
    const ev = { t, key: k, cell: -1, jump: null }, h = cur >= 0 ? cells[cur].hist : null;
    const s = h ? copy(h[h.length - 1].s) : null;
    if (k === " " || PUNCT.includes(k)) {
      // A space takes a cell, except where it would start a row.
      cur = -1;
      if (k !== " ") set(place(), syl([], [], [k]));
      else if (col === COLS) { col = 0; row++; }
      else if (col > 0) place();
    } else if (!isVowel(k)) {
      if (s && s.L.length && s.V.length && !s.T.length && !"ㄸㅃㅉ".includes(k)) set(cur, ((s.T = [k]), s));
      else if (s && s.T.length === 1 && JOIN[s.T[0] + k]) set(cur, (s.T.push(k), s));
      else fresh(syl([k], [], []));
    } else if (s && !s.V.length) set(cur, ((s.V = [k]), s));
    else if (s && !s.T.length && s.V.length === 1 && JOIN[s.V[0] + k]) set(cur, (s.V.push(k), s));
    else if (s && s.T.length && s.L.length) {
      // The jump: the final, or the second letter of a cluster, leaves.
      const moved = s.T.pop(), from = cur;
      set(cur, s);
      fresh(syl([moved], [k], []));
      ev.jump = { from, to: cur, letter: moved, src: s.T.length };
    } else fresh(syl([], [k], []));
    if (k !== " " && !PUNCT.includes(k)) ev.cell = cur;
    events.push(ev);
    t += KEY * jitter(n++) + (k === " " ? SPACE : 0);
  }
  const rows = cells.length ? cells[cells.length - 1].row + 1 : 1, jumps = events.filter((e) => e.jump);
  return { cells, events, end: t + HOLD, off: max(0, (ROWS_SHOWN - rows) / 2), third: jumps.length > 2 ? jumps[2].t : 0 };
}

// ---- Layout: the pieces of a syllable with their rects on the 20 grid.
// One letter, or two side by side, in a rect; a tense consonant is two.
function split(keys, r, role, out) {
  const ls = keys.length === 1 && TENSE[keys[0]] ? [TENSE[keys[0]], TENSE[keys[0]]] : keys;
  const w = ls.length === 1 ? r[2] : r[2] * 0.47;
  ls.forEach((ch, i) => out.push({ id: role + i + ch, ch, r: [r[0] + i * (r[2] - w), r[1], w, r[3]] }));
}
function layout(s) {
  const out = [];
  if (PUNCT.includes(s.T[0])) return [{ id: "P", ch: s.T[0], r: [0, 0, 20, 20] }];
  if (!s.V.length) {
    if (s.L.length) split(s.L, ALONE, "L", out);
    return out;
  }
  if (!s.L.length) {
    out.push({ id: "V0" + s.V[0], ch: s.V[0], r: ALONE });
    return out;
  }
  const shape = (s.V.length === 2 ? "C" : HORIZONTAL.includes(s.V[0]) ? "H" : "V") + (s.T.length ? "F" : "");
  const sl = SLOTS[shape];
  split(s.L, sl[0], "L", out);
  s.V.forEach((v, i) => out.push({ id: "V" + i + v, ch: v, r: sl[1][i] }));
  if (s.T.length) split(s.T, sl[2], "T", out);
  return out;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    line: -1, chosen: -1, t: 0, sc: null, hue: 0, trail: 0.06,
    buf: new Float32Array(W * H * 3), fire: new Float32Array(W * H * 3), c: [0, 0, 0], c2: [0, 0, 0],
  };
}

function start(S, line, t0) {
  S.line = line;
  S.sc = script(POEM[line]);
  S.t = t0;
  S.fire.fill(0);
}

// Cell i's block corner in LEDs at scroll offset sc (in rows).
function cellXY(S, i, scroll) {
  const c = S.sc.cells[i];
  return [c.col * CELL + 1.5, TOP + (c.row - scroll + S.sc.off) * CELL + 1.5];
}

// The scroll, in rows, at time t: a row up whenever the cell being typed
// sits below the fifth row, eased over 0.3 s.
function scrollAt(S, t) {
  let s = 0, from = 0, at = -1;
  for (const e of S.sc.events) {
    if (e.t > t) break;
    if (e.cell < 0) continue;
    const want = max(0, S.sc.cells[e.cell].row - (ROWS_SHOWN - 1));
    if (want > s) { from = s; s = want; at = e.t; }
  }
  return at < 0 ? s : from + (s - from) * smooth((t - at) / 0.3);
}

// The flame: where a jumping letter is at time t, as a rect in LEDs, with
// the page scrolled as it is at time t or as given.
function flight(S, e, t, scroll) {
  const u = (t - e.t) / FLY;
  if (u < 0 || u >= 1) return null;
  const sc = scroll == null ? scrollAt(S, t) : scroll, j = e.jump;
  // From the final's slot (the cluster's second half) before the key, to
  // the initial's slot in the block it lands in as that block stands now.
  const sr = roleBox(S, j.from, e.t - 1e-6, sc, (p) => p.id[0] === "T" && +p.id[1] >= j.src), dr = roleBox(S, j.to, t, sc, isL);
  if (!sr || !dr) return null;
  const q = smooth(u), m = u * u * (3 - 2 * u);
  // A hop: a quadratic arc whose top is about 10 LEDs over the higher end.
  const sx = sr[0] + sr[2] / 2, sy = sr[1] + sr[3] / 2, ex = dr[0] + dr[2] / 2, ey = dr[1] + dr[3] / 2;
  const cx = (sx + ex) / 2, cy = max(-8, min(sy, ey) - 20);
  const x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * cx + q * q * ex, y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * cy + q * q * ey;
  const w = sr[2] + (dr[2] - sr[2]) * m, h = sr[3] + (dr[3] - sr[3]) * m;
  return { r: [x - w / 2, y - h / 2, w, h] };
}

// The rect in LEDs that the pieces of cell i chosen by keep fill at time t.
const isL = (p) => p.id[0] === "L";
function roleBox(S, i, t, scroll, keep) {
  const ps = layout(histAt(S.sc.cells[i].hist, t).s).filter(keep);
  if (!ps.length) return null;
  const [x, y] = cellXY(S, i, scroll), k = BLOCK / 20, a = ps[0].r, b = ps[ps.length - 1].r;
  return [x + a[0] * k, y + a[1] * k, (b[0] + b[2] - a[0]) * k, (b[1] + b[3] - a[1]) * k];
}

function histAt(hist, t) {
  let h = hist[0];
  for (const x of hist) {
    if (x.t > t) break;
    h = x;
  }
  return h;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const phrase = round(cl(k[2] || 0, 0, POEM.length - 1));
  S.trail = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  // The first line opens 2 s before its third jump is halfway, with most
  // of its keys already struck; a line chosen later starts from its start.
  if (phrase !== S.chosen) {
    start(S, phrase, 0);
    if (S.chosen < 0) S.t = max(0, S.sc.third + FLY / 2 - 2);
    S.chosen = phrase;
  }
  const tau = (d * speed) / 2;
  S.tau = tau;
  S.t += tau;
  if (S.t > S.sc.end + FADE) start(S, (S.line + 1) % POEM.length, 0);
  // Sparks the flames shed: four a frame, rising 6 LEDs a second and
  // fading with the trail.
  const f = S.fire, fade = exp(-tau / trailTime(S)), c = S.c;
  for (let i = 0; i < f.length; i++) f[i] *= fade;
  S.rise = (S.rise || 0) + 6 * tau;
  while (S.rise >= 1) {
    S.rise -= 1;
    f.copyWithin(0, W * 3);
    f.fill(0, (H - 1) * W * 3);
  }
  for (const e of S.sc.events) {
    if (!e.jump || e.t > S.t || S.t - e.t > FLY) continue;
    const b = flight(S, e, S.t);
    if (!b) continue;
    hsv(S.hue + 0.5, 0.7, 1, c);
    for (let i = 0; i < 4; i++) {
      const sx = floor(b.r[0] + b.r[2] / 2 + (random() - 0.5) * 12), sy = floor(b.r[1] + b.r[3] / 2 + (random() - 0.3) * 12);
      if (sx >= 0 && sx < W && sy >= 0 && sy <= TEXT_BOTTOM) put(f, sx, sy, c, 0.5 + 0.5 * random());
    }
  }
}

// The trail's time constant, in seconds at Speed 2: 0.31 s at Trail 0.06,
// 1.6 s at 0.5, 10 s at 1. A landed flame cools, and the light it throws
// on the page dies, over twice that.
const trailTime = (S) => 0.25 * 40 ** S.trail;
const coolTime = (S) => 2 * trailTime(S);

// Max-blend colour c at level v into LED (x, y).
function put(buf, x, y, c, v) {
  const i = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) if (buf[i + j] < c[j] * v) buf[i + j] = c[j] * v;
}

// A soft disc of light, radius R, a at its centre.
function halo(buf, cx, cy, R, c, a) {
  for (let y = max(0, floor(cy - R)); y <= min(TEXT_BOTTOM, floor(cy + R)); y++)
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, floor(cx + R)); x++) {
      const d = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / R;
      if (d < 1) put(buf, x, y, c, a * (1 - d) * (1 - d));
    }
}

// A flying letter in its rect.
function stampPiece(buf, letter, fl, c, w) {
  const ps = [];
  split([letter], fl.r, "", ps);
  for (const p of ps) strokes(buf, BASE[p.ch], p.r, w, c);
}

// Max-blend a segment of width w into the buffer, above the keyboard.
function seg(buf, x0, y0, x1, y1, w, c) {
  const r = w / 2 + 0.5;
  const lx = max(0, floor(min(x0, x1) - r)), hx = min(W - 1, floor(max(x0, x1) + r));
  const ly = max(0, floor(min(y0, y1) - r)), hy = min(TEXT_BOTTOM, floor(max(y0, y1) + r));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = ly; y <= hy; y++)
    for (let x = lx; x <= hx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const u = cl((px * dx + py * dy) / L2, 0, 1), ex = px - u * dx, ey = py - u * dy;
      const f = cl(r - sqrt(ex * ex + ey * ey), 0, 1);
      if (f > 0) put(buf, x, y, c, f);
    }
}

// A letter's strokes from the 20 grid into a rect in LEDs.
function strokes(buf, g, r, w, c) {
  if (!g) return;
  const X = (gx) => r[0] + (r[2] * gx) / 20, Y = (gy) => r[1] + (r[3] * gy) / 20;
  for (const st of g) {
    if (st[0] === O) {
      let px = X(st[1] + st[3]), py = Y(st[2]);
      for (let i = 1; i <= 16; i++) {
        const a = (i / 16) * 2 * PI, nx = X(st[1] + st[3] * cos(a)), ny = Y(st[2] + st[4] * sin(a));
        seg(buf, px, py, nx, ny, w, c);
        px = nx;
        py = ny;
      }
    } else for (let i = 2; i < st.length; i += 2) seg(buf, X(st[i - 2]), Y(st[i - 1]), X(st[i]), Y(st[i + 1]), w, c);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.sc) return;
  const buf = S.buf, c = S.c, c2 = S.c2, t = S.t, h = S.hue, sc = S.sc, k = BLOCK / 20;
  buf.fill(0);
  const out = 1 - smooth((t - sc.end) / FADE), scroll = scrollAt(S, t), cool = coolTime(S);
  // The syllable being composed: the cell of the last key, until a space.
  let last = null;
  for (const e of sc.events) if (e.t <= t) last = e;
  const cur = last && last.cell >= 0 && t < sc.end ? last.cell : -1;
  if (cur >= 0) {
    const [x0, y0] = cellXY(S, cur, scroll);
    hsv(h + 0.5, 0.8, 0.13, c);
    for (let y = max(0, floor(y0 - 1)); y <= min(TEXT_BOTTOM, floor(y0 + BLOCK)); y++)
      for (let x = max(0, floor(x0 - 1)); x <= min(W - 1, floor(x0 + BLOCK)); x++) put(buf, x, y, c, 1);
  }
  // Jumps in the air hide their letter in the block they fly to. Landed
  // ones burn there, cooling from flame to ink, in a soft disc of light
  // 24 LEDs across.
  // Every flame, flying or landed, lights the letters round it: a letter
  // takes the flame's colour by 1.5 (1 - d / 34) of the flame's heat, up to 0.9.
  const air = new Map(), glow = new Map(), flying = [], lights = [];
  for (const e of sc.events) {
    if (!e.jump || e.t > t) continue;
    if (t < e.t + FLY) {
      air.set(e.jump.to, true);
      const fl = flight(S, e, t);
      if (!fl) continue;
      flying.push([e, fl]);
      lights.push([fl.r[0] + fl.r[2] / 2, fl.r[1] + fl.r[3] / 2, out]);
    } else {
      const g = exp(-(t - e.t - FLY) / cool) * out;
      glow.set(e.jump.to, g);
      const b = roleBox(S, e.jump.to, t, scroll, isL);
      if (!b || g < 0.02) continue;
      const lx = b[0] + b[2] / 2, ly = b[1] + b[3] / 2;
      lights.push([lx, ly, g]);
      hsv(h + 0.5, 0.8, 1, c);
      halo(buf, lx, ly, 12, c, 0.4 * g);
    }
  }
  // Each flame's path stays as a soft line, 5 LEDs wide at Trail 0 and 8
  // at 1, each point fading from the moment the flame passed it.
  const tt = trailTime(S);
  for (const e of sc.events) {
    if (!e.jump || e.t > t || exp(-(t - e.t - FLY) / tt) < 0.04) continue;
    const top = min(1, (t - e.t) / FLY);
    hsv(h + 0.5, 0.8, 1, c);
    for (let i = 0; i <= 40; i++) {
      const at = e.t + min(i / 40, top) * FLY, v = 0.8 * exp(-(t - at) / tt) * out;
      const fl = flight(S, e, min(at, e.t + FLY - 1e-6), scroll);
      if (fl && v > 0.03) halo(buf, fl.r[0] + fl.r[2] / 2, fl.r[1] + fl.r[3] / 2, 2.5 + 1.5 * S.trail, c, v);
      if (i / 40 >= top) break;
    }
  }
  const lightAt = (x, y) => {
    let v = 0;
    for (const [lx, ly, s] of lights) {
      const d = 1 - sqrt((x - lx) ** 2 + (y - ly) ** 2) / 34;
      if (d > 0) v += 1.5 * s * d;
    }
    return min(1, v);
  };
  sc.cells.forEach((cell, i) => {
    const hist = cell.hist;
    const now = histAt(hist, t);
    if (now.t < 0) return;
    const [x0, y0] = cellXY(S, i, scroll);
    if (y0 + BLOCK < 0) return;
    let before = hist[0];
    for (const x of hist) {
      if (x === now) break;
      before = x;
    }
    const u = smooth((t - now.t) / SLIDE);
    const pa = layout(before.s), pb = layout(now.s);
    const composing = i === cur;
    for (const p of pb) {
      const old = pa.find((q) => q.id === p.id);
      if (isL(p) && air.get(i)) continue;
      const r = old ? p.r.map((v, j) => old.r[j] + (v - old.r[j]) * u) : p.r;
      // Ink, brighter while composed; a new letter flashes white; a landed
      // jumper burns in flame colour and cools.
      hsv(h + 0.12, composing ? 0.25 : 0.6, (composing ? 1 : 0.9) * out, c);
      const fl = old ? 0 : exp(-(t - now.t) / 0.15);
      const rr = [x0 + r[0] * k, y0 + r[1] * k, r[2] * k, r[3] * k];
      const lit = 0.9 * lightAt(rr[0] + rr[2] / 2, rr[1] + rr[3] / 2);
      if (lit > 0) {
        hsv(h + 0.5, 0.65, out, c2);
        for (let j = 0; j < 3; j++) c[j] += (c2[j] - c[j]) * lit;
      }
      const g = isL(p) && glow.has(i) ? glow.get(i) : 0;
      if (g > 0) {
        hsv(h + 0.5, 0.75, out, c2);
        for (let j = 0; j < 3; j++) c[j] += (c2[j] - c[j]) * g;
      }
      for (let j = 0; j < 3; j++) c[j] += (out - c[j]) * fl;
      strokes(buf, BASE[p.ch], rr, PUNCT.includes(p.ch) ? 2 : 1.5, c);
    }
  });
  // The flames in the air, crisp over their trails, each in a halo.
  for (const [e, fl] of flying) {
    hsv(h + 0.5, 0.8, 1, c);
    halo(buf, fl.r[0] + fl.r[2] / 2, fl.r[1] + fl.r[3] / 2, 9, c, 0.45);
    hsv(h + 0.5, 0.45, 1, c);
    stampPiece(buf, e.jump.letter, fl, c, 1.6);
  }
  // The keyboard: dim caps, consonants in ink and vowels in lilac, the
  // struck key and shift lit for 0.3 s, a jump's vowel in flame.
  const lit = {};
  for (const e of sc.events) {
    if (e.t > t || t - e.t > 0.3 || !CAP[SHIFTED[e.key] || e.key]) continue;
    const base = SHIFTED[e.key] || e.key, a = 1 - (t - e.t) / 0.3;
    lit[base] = { a, jump: !!e.jump };
    if (SHIFTED[e.key]) lit["⇧"] = { a, jump: false };
  }
  for (const key in KEYPOS) {
    const [kx, ky] = KEYPOS[key], cap = CAP[key], L = lit[key];
    const vowel = isVowel(key);
    hsv(h + (vowel ? 0.78 : 0.12), 0.35, 0.34, c);
    if (L) {
      if (L.jump) hsv(h + 0.5, 0.75, 1, c2);
      else hsv(h + 0.12, 0.1, 1, c2);
      for (let j = 0; j < 3; j++) c[j] += (c2[j] - c[j]) * L.a;
    }
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) put(buf, kx + x, ky + y, c, (cap[y] >> (4 - x)) & 1 ? 1 : L ? 0.22 * L.a : 0);
  }
  const f = S.fire;
  for (let p = 0, i = 0; p < W * H; p++, i += 3)
    display.setPixel(p & 63, p >> 6, round(cl(max(buf[i], f[i] * out), 0, 1) * 255), round(cl(max(buf[i + 1], f[i + 1] * out), 0, 1) * 255), round(cl(max(buf[i + 2], f[i + 2] * out), 0, 1) * 255));
}
