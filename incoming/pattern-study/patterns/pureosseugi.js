// ===== Patternflow pattern =====
// Title:   Pureosseugi
// Family:  type
// Idea:    A Korean phrase stands as syllable blocks, then one block after another comes apart into its jamo, which stretch from their squeezed places in the block into full-height letters standing on a line, so the text reflows longer and wraps further down the panel with every block opened, until the whole phrase is one row of letters; a miniature of the line and a count at the bottom grow with it, and then the letters pack back into blocks.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: writing Hangul as a row of letters instead of syllable blocks (pureosseugi), proposed by Ju Si-gyeong, whose Mal-ui sori (1914) ends with a passage written that way; jamo drawn for this pattern in a squeezed and a linear form; pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phrase=0..5, Spacing=0..1
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 consonants are azure and vowels pink, pale while they sit in a block and full once they stand as letters; at 0.5 consonants are orange and vowels green.
// Knob 2: Speed. At 2 the blocks stand 1 s, then a block opens every 0.8 s and its letters take 0.65 s to reach their places, peeling off 0.06 s apart; the row holds 3 s, the blocks pack again one every 0.6 s and stand 3 s before the next round. A round is 11.5 s for a four-syllable phrase, 8.7 s for 한글; ten times as long at 0.2, two thirds at 3.
// Knob 3: Phrase. 0 풀어쓰기, 1 한나라 말, 2 말의 소리, 3 모아쓰기, 4 한 줄로 써요, 5 한글. Four blocks on two lines become 10 letters on three (9 on two for 모아쓰기), five blocks on three lines become 13 letters on four, and 한글's two blocks on one line become 6 letters on two. Double letters and compound vowels come apart into the letters they are made of: ㅆ into ㅅ ㅅ, ㅢ into ㅡ ㅣ.
// Knob 4: Spacing. The gap between letters in the row, 1 LED at 0 and the opening 0.06 up to 6 at 1, where 풀어쓰기 stands three letters to a line where it stood four and 모아쓰기 needs a third line (from a gap of 3). A phrase that would need more than four lines takes the widest gap that fits: 한 줄로 써요 stops at 5.

// A syllable block is 25 by 25 LEDs, 3 apart, two to a line. The letters
// are as tall as the block, 25 LEDs, on bodies 13 wide for the consonants
// and for ㅗ ㅛ ㅜ ㅠ ㅡ, 9 for ㅏ ㅑ ㅓ ㅕ and 4 for ㅣ, with strokes 2 LEDs
// wide. Lines are 31 LEDs apart, four of them in the 119 rows above the
// counter.
//
// Each basic letter is drawn once as strokes on its linear body, in whole
// LEDs: that is the linear form. The squeezed form is the same strokes
// pressed into the letter's slot in the block, where the slot depends on
// the vowel: an initial sits left of ㅏ ㅑ ㅓ ㅕ ㅣ and above ㅗ ㅛ ㅜ ㅠ ㅡ,
// a final takes the bottom third, and a compound vowel splits into a
// horizontal part under the initial and a vertical part at the right. ㅊ, ㅎ
// and ㅇ have their own squeezed drawing, since their top strokes vanish when
// pressed. Moving between the two, every point of every stroke slides from
// one form to the other while the letter travels, so a letter stretches as
// it leaves its block and squeezes as it returns.
//
// The text is laid out afresh whenever a block opens or closes: blocks and
// letters in reading order, a line wrapped when the next one does not fit
// in 64 LEDs, each line centred, the lines centred down the panel. Every
// letter and block that has to move glides to its new place in 0.65 s, so
// the block that opens pushes the rest of the phrase along and down, and
// a syllable's letters may end up split over two lines.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sin, cos, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const PHRASES = ["풀어쓰기", "한나라 말", "말의 소리", "모아쓰기", "한 줄로 써요", "한글"];

const B = 25, BGAP = 3, LH = 25, LP = 31, PAGE = 119, SPW = 6, MAXL = 4;
// Seconds at Speed 2: the opening hold, one block opening after another,
// a letter's journey, the row's hold, packing, and the blocks' hold.
const HOLD0 = 1.0, STEP_U = 0.8, FLY = 0.65, HOLD_R = 3.0, STEP_P = 0.6, HOLD_B = 2.0, PEEL = 0.06;

// An ellipse as a closed polyline of 16 points.
function ell(cx, cy, rx, ry) {
  const p = [];
  for (let k = 0; k <= 16; k++) p.push(cx + rx * sin((k * PI) / 8), cy - ry * cos((k * PI) / 8));
  return p;
}
// Linear forms: body width and strokes on a body 25 tall, y down. A stroke
// is drawn 2 LEDs wide, thickened to the right or downward, so its points
// run 0..w-2 across and 0..23 down.
const LIN = {
  "ㄱ": [13, [[0, 0, 11, 0, 11, 23]]],
  "ㄴ": [13, [[0, 0, 0, 23, 11, 23]]],
  "ㄷ": [13, [[11, 0, 0, 0, 0, 23, 11, 23]]],
  "ㄹ": [13, [[0, 0, 11, 0, 11, 11, 0, 11, 0, 23, 11, 23]]],
  "ㅁ": [13, [[0, 0, 11, 0, 11, 23, 0, 23, 0, 0]]],
  "ㅂ": [13, [[0, 0, 0, 23, 11, 23, 11, 0], [0, 11, 11, 11]]],
  "ㅅ": [13, [[5, 0, 0, 23], [6, 0, 11, 23]]],
  "ㅇ": [13, [ell(5.5, 11.5, 5.5, 11.5)]],
  "ㅈ": [13, [[0, 0, 11, 0], [5, 0, 0, 23], [6, 0, 11, 23]]],
  "ㅊ": [13, [[5, 0, 5, 2], [0, 4, 11, 4], [5, 4, 0, 23], [6, 4, 11, 23]]],
  "ㅋ": [13, [[0, 0, 11, 0, 11, 23], [0, 11, 11, 11]]],
  "ㅌ": [13, [[11, 0, 0, 0, 0, 23, 11, 23], [0, 11, 10, 11]]],
  "ㅍ": [13, [[0, 0, 11, 0], [0, 23, 11, 23], [3, 0, 3, 23], [8, 0, 8, 23]]],
  "ㅎ": [13, [[5, 0, 5, 2], [0, 5, 11, 5], ell(5.5, 15, 5.5, 8)]],
  "ㅏ": [9, [[1, 0, 1, 23], [1, 11, 7, 11]]],
  "ㅑ": [9, [[1, 0, 1, 23], [1, 7, 7, 7], [1, 15, 7, 15]]],
  "ㅓ": [9, [[6, 0, 6, 23], [0, 11, 6, 11]]],
  "ㅕ": [9, [[6, 0, 6, 23], [0, 7, 6, 7], [0, 15, 6, 15]]],
  "ㅗ": [13, [[5, 0, 5, 23], [0, 23, 11, 23]]],
  "ㅛ": [13, [[3, 0, 3, 23], [8, 0, 8, 23], [0, 23, 11, 23]]],
  "ㅜ": [13, [[0, 0, 11, 0], [5, 0, 5, 23]]],
  "ㅠ": [13, [[0, 0, 11, 0], [3, 0, 3, 23], [8, 0, 8, 23]]],
  "ㅡ": [13, [[0, 11, 11, 11]]],
  "ㅣ": [4, [[1, 0, 1, 23]]],
};
// Squeezed forms drawn apart, in the slot's own 0..1 square. The same
// strokes and points as the linear form, so they pair up.
const SQZ = {
  "ㅇ": [ell(0.5, 0.5, 0.5, 0.5)],
  "ㅊ": [[0.5, 0, 0.5, 0.1], [0, 0.25, 1, 0.25], [0.5, 0.25, 0, 1], [0.5, 0.25, 1, 1]],
  "ㅎ": [[0.5, 0, 0.5, 0.1], [0, 0.28, 1, 0.28], ell(0.5, 0.71, 0.5, 0.29)],
};
const VOWELS = "ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ";
const FLAT = "ㅗㅛㅜㅠㅡ";
// Each letter's strokes as pairs of points: squeezed (0..1) and linear (LEDs).
const GLYPH = {};
for (const [ch, [w, strokes]] of Object.entries(LIN)) {
  const sq = SQZ[ch] || strokes.map((s) => s.map((v, i) => (i & 1 ? v / (LH - 2) : v / (w - 2))));
  GLYPH[ch] = { w, vowel: VOWELS.includes(ch), lin: strokes, sq };
}

// Unicode's 19 initials, 21 vowels and 28 finals, spelled in basic letters.
const INIT = ["ㄱ", "ㄱㄱ", "ㄴ", "ㄷ", "ㄷㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅂㅂ", "ㅅ", "ㅅㅅ", "ㅇ", "ㅈ", "ㅈㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const MED = ["ㅏ", "ㅏㅣ", "ㅑ", "ㅑㅣ", "ㅓ", "ㅓㅣ", "ㅕ", "ㅕㅣ", "ㅗ", "ㅗㅏ", "ㅗㅏㅣ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅓㅣ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"];
const FIN = ["", "ㄱ", "ㄱㄱ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅅㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

// Slots on the 25 by 25 block, [x, y, w, h]: initial, horizontal vowel part,
// vertical vowel part, final.
const SLOT = {
  V: { i: [0, 3, 13, 19], v: [15, 0, 10, 25] },
  VF: { i: [0, 0, 13, 14], v: [15, 0, 10, 16], f: [3, 17, 19, 8] },
  H: { i: [4, 0, 17, 14], h: [0, 16, 25, 9] },
  HF: { i: [4, 0, 17, 8], h: [0, 9, 25, 6], f: [4, 17, 17, 8] },
  C: { i: [0, 0, 14, 12], h: [0, 13, 18, 8], v: [19, 0, 6, 25] },
  CF: { i: [0, 0, 14, 8], h: [0, 9, 18, 6], v: [19, 0, 6, 16], f: [3, 17, 19, 8] },
};

// Splits a slot side by side among letters, by their linear widths.
function split(rect, letters) {
  if (letters.length === 1) return [rect];
  const [x, y, w, h] = rect, gaps = letters.length - 1;
  const ws = letters.map((c) => GLYPH[c].w), sum = ws.reduce((a, b) => a + b, 0);
  const out = [];
  let at = x;
  letters.forEach((c, k) => {
    const cw = k === letters.length - 1 ? x + w - at : max(2, round(((w - gaps) * ws[k]) / sum));
    out.push([at, y, cw, h]);
    at += cw + 1;
  });
  return out;
}

// A syllable: its letters in reading order, each with its slot in the block.
function syllable(ch) {
  const c = ch.charCodeAt(0) - 0xac00;
  const ini = [...INIT[floor(c / 588)]], med = [...MED[floor((c % 588) / 28)]], fin = [...FIN[c % 28]];
  const flat = FLAT.includes(med[0]);
  const kind = (flat ? (med.length > 1 ? "C" : "H") : "V") + (fin.length ? "F" : "");
  const sl = SLOT[kind];
  const letters = [];
  split(sl.i, ini).forEach((r, k) => letters.push({ ch: ini[k], slot: r }));
  if (flat) letters.push({ ch: med[0], slot: sl.h });
  const vert = flat ? med.slice(1) : med;
  if (vert.length) split(sl.v, vert).forEach((r, k) => letters.push({ ch: vert[k], slot: r }));
  if (fin.length) split(sl.f, fin).forEach((r, k) => letters.push({ ch: fin[k], slot: r }));
  return letters;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// 3 by 5 figures, rows top first, bit 4 the left column.
const DIG = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7]];

export function setup(params) {
  params.s = { phrase: -1, gap: -1, t: 0, clock: 0, open: [], sylls: [], jamo: [], ink: new Float32Array(N * 2), hue: 0 };
}

function begin(S, n) {
  S.phrase = n;
  S.t = 0;
  S.sylls = [];
  S.jamo = [];
  S.chars = [...PHRASES[n]];
  S.chars.forEach((ch) => {
    if (ch === " ") return;
    const i = S.sylls.length;
    const letters = syllable(ch);
    S.sylls.push({ letters: letters.map((l, k) => S.jamo.length + k) });
    letters.forEach((l, k) => S.jamo.push({ syl: i, k, ch: l.ch, g: GLYPH[l.ch], slot: l.slot, from: null, to: null, t0: 0 }));
  });
  S.open = S.sylls.map(() => false);
  S.gap = -1;
  // Timeline of this phrase.
  const n1 = S.sylls.length - 1;
  S.packAt = HOLD0 + n1 * STEP_U + FLY + HOLD_R;
  S.loop = S.packAt + n1 * STEP_P + FLY + HOLD_B;
}

// Lays the text out with the given blocks open, at the given letter gap.
// Returns each jamo's target rect [x, y, w, h] and form (0 squeezed, 1 linear).
function layout(S, open, gap) {
  for (let g = gap; g >= 0; g--) {
    const units = [];
    let si = 0;
    for (const ch of S.chars) {
      if (ch === " ") {
        units.push({ sp: true });
        continue;
      }
      const s = S.sylls[si];
      if (open[si]) for (const j of s.letters) units.push({ j, w: S.jamo[j].g.w, letter: true });
      else units.push({ syl: si, w: B });
      si++;
    }
    const lines = [[]];
    let x = 0, prev = null;
    for (const u of units) {
      let line = lines[lines.length - 1];
      if (u.sp) {
        if (x > 0) {
          x += SPW;
          prev = null;
        }
        continue;
      }
      const sep = prev ? (prev.letter && u.letter ? g : BGAP) : 0;
      if (x > 0 && x + sep + u.w > W) {
        lines.push((line = []));
        x = 0;
        prev = null;
      }
      const at = x + (prev ? (prev.letter && u.letter ? g : BGAP) : 0);
      line.push({ u, x: at });
      x = at + u.w;
      prev = u;
    }
    if (lines.length > MAXL && g > 0) continue;
    const out = new Array(S.jamo.length);
    const top = floor((PAGE - (lines.length * LP - (LP - LH))) / 2);
    lines.forEach((line, li) => {
      if (!line.length) return;
      const last = line[line.length - 1];
      const off = floor((W - (last.x + last.u.w)) / 2), y = top + li * LP;
      for (const { u, x } of line) {
        if (u.letter) out[u.j] = { r: [off + x, y, u.w, LH], m: 1 };
        else for (const j of S.sylls[u.syl].letters) {
          const sl = S.jamo[j].slot;
          out[j] = { r: [off + x + sl[0], y + sl[1], sl[2], sl[3]], m: 0 };
        }
      }
    });
    return { out, lines: lines.length, gap: g };
  }
}

// Where a jamo is now: its tween from -> to at the clock.
function now(S, jm) {
  if (!jm.from) return jm.to;
  const e = ease((S.clock - jm.t0) / FLY);
  const a = jm.from, b = jm.to;
  return { r: a.r.map((v, i) => v + (b.r[i] - v) * e), m: a.m + (b.m - a.m) * e, e };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const phrase = round(cl(k[2] || 0, 0, PHRASES.length - 1));
  const gap = round(1 + 5 * cl(k[3] == null ? 0.06 : k[3], 0, 1));
  if (phrase !== S.phrase) begin(S, phrase);
  const step = (d * speed) / 2;
  S.clock += step;
  S.t += step;
  if (S.t >= S.loop) S.t -= S.loop;
  const open = S.sylls.map((_, i) => S.t >= HOLD0 + i * STEP_U && S.t < S.packAt + i * STEP_P);
  if (gap === S.gap && open.every((o, i) => o === S.open[i])) return;
  const first = S.gap < 0;
  S.gap = gap;
  S.open = open;
  const L = layout(S, open, gap);
  S.jamo.forEach((jm, j) => {
    const target = L.out[j];
    if (first) {
      jm.to = target;
      jm.from = null;
      return;
    }
    const same = jm.to && jm.to.m === target.m && jm.to.r.every((v, i) => v === target.r[i]);
    if (same) return;
    // Letters peel off a block one after another.
    const flips = jm.to.m !== target.m;
    jm.from = now(S, jm);
    jm.to = target;
    jm.t0 = S.clock + (flips ? jm.k * PEEL : 0);
  });
}

// Max-splats a point into an ink plane, bilinear.
function splat(ink, x, y, v) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++) {
      const px = x0 + dx, py = y0 + dy;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * v, p = py * W + px;
      if (w > ink[p]) ink[p] = w;
    }
}
function line1(ink, x0, y0, x1, y1, crisp) {
  if (crisp) {
    // Bresenham between whole LEDs.
    x0 = round(x0), y0 = round(y0), x1 = round(x1), y1 = round(y1);
    const dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) ink[y0 * W + x0] = 1;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x0 += sx);
      if (e2 <= dx) (err += dx), (y0 += sy);
    }
    return;
  }
  const n = max(1, Math.ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 2));
  for (let i = 0; i <= n; i++) splat(ink, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1);
}
// A stroke 2 LEDs wide: the line again one LED to the right if it is
// steep, one LED down if it is flat.
function line(ink, x0, y0, x1, y1, crisp) {
  line1(ink, x0, y0, x1, y1, crisp);
  if (abs(y1 - y0) > abs(x1 - x0)) line1(ink, x0 + 1, y0, x1 + 1, y1, crisp);
  else line1(ink, x0, y0 + 1, x1, y1 + 1, crisp);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.jamo.length) return;
  const ink = S.ink;
  ink.fill(0);
  // Ink planes: 0..N-1 consonants, N..2N-1 vowels. The form m also goes in
  // a side table for the colour.
  const form = S.form || (S.form = new Float32Array(N));
  form.fill(0);
  for (const jm of S.jamo) {
    const st = now(S, jm), [rx, ry, rw, rh] = st.r, m = ease(st.m), g = jm.g;
    const crisp = !jm.from || st.e >= 1;
    const plane = g.vowel ? N : 0;
    const sub = ink.subarray(plane, plane + N);
    // A small hop while it travels.
    const hop = jm.from && st.e < 1 ? -3 * sin(PI * st.e) * abs(jm.to.m - jm.from.m) : 0;
    for (let s = 0; s < g.lin.length; s++) {
      const L = g.lin[s], Q = g.sq[s];
      let px = 0, py = 0;
      for (let i = 0; i < L.length; i += 2) {
        const u = Q[i] + (L[i] / (g.w - 2) - Q[i]) * m, v = Q[i + 1] + (L[i + 1] / (LH - 2) - Q[i + 1]) * m;
        const x = rx + u * (rw - 2), y = ry + v * (rh - 2) + hop;
        if (i) line(sub, px, py, x, y, crisp);
        px = x;
        py = y;
      }
    }
    // Remember the form over the letter's box, for its saturation.
    for (let y = max(0, floor(ry - 3)); y < min(H, ry + rh + 1); y++)
      for (let x = max(0, floor(rx)); x < min(W, rx + rw + 1); x++) form[y * W + x] = max(form[y * W + x], st.m);
  }
  const h = S.hue + 0.55;
  const cP = hsv(h, 0.3, 1), cF = hsv(h, 0.75, 1), vP = hsv(h + 0.33, 0.3, 1), vF = hsv(h + 0.33, 0.7, 1);
  for (let p = 0; p < N; p++) {
    const a = ink[p], b = ink[N + p], m = form[p];
    let r = 0, g = 0, bl = 0;
    if (a > 0) {
      r += a * (cP[0] + (cF[0] - cP[0]) * m);
      g += a * (cP[1] + (cF[1] - cP[1]) * m);
      bl += a * (cP[2] + (cF[2] - cP[2]) * m);
    }
    if (b > 0) {
      r = max(r, b * (vP[0] + (vF[0] - vP[0]) * m));
      g = max(g, b * (vP[1] + (vF[1] - vP[1]) * m));
      bl = max(bl, b * (vP[2] + (vF[2] - vP[2]) * m));
    }
    display.setPixel(p % W, floor(p / W), round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, bl)));
  }
  // The counter: how many written units the line holds now, then the line
  // itself in miniature, a 3 by 5 square for a block and a 1 by 5 bar for a
  // letter.
  let units = 0;
  const mini = [];
  S.sylls.forEach((s, i) => {
    const jm = S.jamo[s.letters[0]], st = now(S, jm);
    if (st.m > 0.5) for (const j of s.letters) (units++, mini.push(S.jamo[j].g.vowel ? 2 : 1));
    else (units++, mini.push(0));
  });
  const grey = hsv(h, 0.15, 0.8);
  const digits = String(units);
  let x = 1;
  for (const ch of digits) {
    const rows = DIG[ch.charCodeAt(0) - 48];
    for (let yy = 0; yy < 5; yy++)
      for (let xx = 0; xx < 3; xx++)
        if (rows[yy] & (4 >> xx)) display.setPixel(x + xx, 121 + yy, round(255 * grey[0]), round(255 * grey[1]), round(255 * grey[2]));
    x += 4;
  }
  x = 10;
  for (const u of mini) {
    const c = u === 0 ? cP : u === 1 ? cF : vF, w = u === 0 ? 3 : 1;
    for (let yy = 0; yy < 5; yy++)
      for (let xx = 0; xx < w; xx++) if (x + xx < W) display.setPixel(x + xx, 121 + yy, round(200 * c[0]), round(200 * c[1]), round(200 * c[2]));
    x += w + 1;
  }
}
