// ===== Patternflow pattern =====
// Title:   Word Ladder
// Family:  type
// Idea:    Lewis Carroll's word ladders build themselves down the tall panel: the first word writes itself stroke by stroke with the goal word waiting dimly at the bottom, each new rung is lowered from the one above while the ink of its one changed letter runs into the new letter on a lit cell, so the changed column zig-zags down the ladder until the goal lights, holds and clears for the next ladder.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Doublets (Lewis Carroll, 1879), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ladder=0..11, Weight=0..1
//
// Knob 1: Hue. Turns the ladder's colours along the hues from green to pink, leaving out red, orange and yellow, which read brown on a dim cell. At 0 the words run from azure at the top through blue to violet at the goal, each changed letter white on a cell of its rung's colour; at 0.5 pink at the top, then green down to teal.
// Knob 2: Speed. At 2 the first word takes 1.4 s to write, each rung 1.15 s, the solved ladder holds 2.6 s and clears in 1.1 s, so HEAD to TAIL is solved at 7.2 s and the next ladder starts at 10.9 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Ladder. Which of twelve ladders the panel starts on; after it the next follows. 0 is HEAD heal teal tell tall TAIL, the example Carroll gave when Doublets began in Vanity Fair on 29 March 1879. Then FOUR to FIVE, PIG to STY, WHEAT to BREAD, EYE to LID, COLD to WARM, FLOUR to BREAD, ONE to TWO in eight steps, APE to MAN, WET to DRY, LESS to MORE and TEA to HOT. The rungs share the 128 rows, 21 rows each for HEAD to TAIL, 14 for ONE to TWO, and the letters grow to fit: 16 LEDs tall for HEAD, 12 for WHEAT, 19 for EYE.
// Knob 4: Weight. The pen: at 0 a hairline one LED wide, at the opening 0.06 still a hairline, at 1 a bold stroke 4 to 5 LEDs wide on HEAD, where the counters of A and D shrink to a slot.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Carroll's rule: every rung a word, and each differs from the one above in
// exactly one letter. A ladder that breaks it is dropped here.
const LADDERS = [
  "HEAD HEAL TEAL TELL TALL TAIL",
  "FOUR FOUL FOOL FOOT FORT FORE FIRE FIVE",
  "PIG WIG WAG WAY SAY STY",
  "WHEAT CHEAT CHEAP CHEEP CREEP CREED BREED BREAD",
  "EYE DYE DIE DID LID",
  "COLD CORD CARD WARD WARM",
  "FLOUR FLOOR FLOOD BLOOD BROOD BROAD BREAD",
  "ONE OWE EWE EYE DYE DOE TOE TOO TWO",
  "APE APT OPT OAT MAT MAN",
  "WET BET BAT BAY DAY DRY",
  "LESS LOSS LOSE LORE MORE",
  "TEA PEA PET POT HOT",
]
  .map((s) => s.split(" "))
  .filter((w) => w.every((a, r) => r === 0 || (a.length === w[0].length && [...a].filter((ch, i) => ch !== w[r - 1][i]).length === 1)));

// The capitals, drawn for this pattern as pen strokes on a grid 4 wide and
// 6 tall, y down, each stroke a polyline in the order a hand would draw it.
const STROKES = {
  A: [[0, 6, 1.6, 0, 2.4, 0, 4, 6], [0.65, 4, 3.35, 4]],
  B: [[0, 6, 0, 0, 2.8, 0, 3.7, 0.8, 3.7, 2.2, 2.8, 3, 0, 3], [2.8, 3, 4, 3.9, 4, 5.1, 3, 6, 0, 6]],
  C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]],
  D: [[0, 0, 0, 6, 2.4, 6, 4, 4.4, 4, 1.6, 2.4, 0, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3.4, 2.2, 3.4]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3.6, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0]],
  P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2.2, 3, 3.2, 0, 3.2]],
  R: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2.2, 3, 3.2, 0, 3.2], [2, 3.2, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 2.4, 3, 6, 4, 0]],
  Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]],
};

// Every letter resampled to NP points spaced evenly along its strokes, in
// stroke order, so any letter can flow into any other point by point.
const NP = 120;
const GLYPH = {};
for (const ch in STROKES) {
  const st = STROKES[ch];
  let total = 0;
  for (const s of st) for (let i = 2; i < s.length; i += 2) total += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
  const pts = new Float32Array(NP * 2);
  let n = 0;
  for (const s of st) {
    for (let i = 2; i < s.length; i += 2) {
      const len = Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
      const share = (len / total) * NP;
      const from = n, to = min(NP, round(from + share + (i === s.length - 2 && s === st[st.length - 1] ? NP : 0)));
      for (let k = from; k < to; k++) {
        const t = to - from > 1 ? (k - from) / (to - from - 1) : 0;
        pts[2 * k] = s[i - 2] + (s[i] - s[i - 2]) * t;
        pts[2 * k + 1] = s[i - 1] + (s[i + 1] - s[i - 1]) * t;
      }
      n = to;
    }
  }
  GLYPH[ch] = pts;
}

export function setup(params) {
  params.s = {
    lad: -1, k3: -1, t: 0, hue: 0, speed: 2, weight: 0.06,
    ink: new Float32Array(W * H * 3), col: [0, 0, 0],
    PALE: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => [0, 0, 0]), ACC: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => [0, 0, 0]),
    CELL: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => [0, 0, 0]),
  };
}

const T_WRITE = 1.4, T_STEP = 1.15, T_HOLD = 2.6, T_CLEAR = 1.1;
const length = (n) => T_WRITE + (n - 1) * T_STEP + T_HOLD + T_CLEAR;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.weight = cl(kv[3], 0, 1);
  const k3 = cl(round(kv[2]), 0, LADDERS.length - 1);
  if (k3 !== S.k3) { S.k3 = k3; S.lad = k3; S.t = 0; }
  S.t += (d * S.speed) / 2;
  if (S.t > length(LADDERS[S.lad].length)) { S.t = 0; S.lad = (S.lad + 1) % LADDERS.length; }
}

// Lays a letter's points into the ink, each a disc of radius rad.
function stamp(S, ch, x0, y0, sx, sy, rad, c, bright, upto) {
  const pts = GLYPH[ch], ink = S.ink, n = upto === undefined ? NP : upto;
  for (let k = 0; k < n; k++) dot(ink, x0 + pts[2 * k] * sx, y0 + pts[2 * k + 1] * sy, rad, c, bright);
}

function dot(ink, x, y, rad, c, b) {
  const r = rad + 0.5, xa = max(0, floor(x - r)), xb = min(W - 1, floor(x + r)), ya = max(0, floor(y - r)), yb = min(H - 1, floor(y + r));
  for (let Y = ya; Y <= yb; Y++)
    for (let X = xa; X <= xb; X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y, w = cl(r - sqrt(dx * dx + dy * dy), 0, 1) * b;
      if (w <= 0) continue;
      const o = (Y * W + X) * 3;
      if (c[0] * w > ink[o]) ink[o] = c[0] * w;
      if (c[1] * w > ink[o + 1]) ink[o + 1] = c[1] * w;
      if (c[2] * w > ink[o + 2]) ink[o + 2] = c[2] * w;
    }
}

function box(S, x0, y0, w, h, c, b) {
  const ink = S.ink;
  for (let y = max(0, round(y0)); y < min(H, round(y0 + h)); y++)
    for (let x = max(0, round(x0)); x < min(W, round(x0 + w)); x++) {
      const o = (y * W + x) * 3;
      ink[o] = max(ink[o], c[0] * b); ink[o + 1] = max(ink[o + 1], c[1] * b); ink[o + 2] = max(ink[o + 2], c[2] * b);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.lad < 0) return;
  const words = LADDERS[S.lad], n = words.length, L = words[0].length, ink = S.ink;
  ink.fill(0);
  const rh = H / n, cw = (W - 4) / L;
  const gh = min(rh * 0.74, (cw - 3) * 1.5), gw = min(cw - 3, gh * (L < 4 ? 0.8 : 0.68));
  const sx = gw / 4, sy = gh / 6;
  const rad = 0.42 + S.weight * 0.1 * gh;
  // The colour walks from the first word to the goal, azure to violet at 0,
  // on the hues from green to pink: red, orange and yellow read brown on a
  // dim cell.
  const col = S.col, PALE = S.PALE, ACC = S.ACC, CELL = S.CELL;
  for (let r = 0; r < n; r++) {
    const u = 0.39 + S.hue + (0.44 * r) / (n - 1), h = 0.3 + 0.64 * (u - floor(u));
    hsv(h, 0.7, 1, PALE[r]);
    hsv(h, 0.12, 1, ACC[r]);
    hsv(h, 0.9, 1, CELL[r]);
  }
  const gx = (i) => 2 + i * cw + (cw - gw) / 2, gy = (r) => r * rh + (rh - gh) / 2;
  const diff = (r) => { const a = words[r - 1], b = words[r]; for (let i = 0; i < L; i++) if (a[i] !== b[i]) return i; return -1; };

  const t = S.t, steps = n - 1;
  const tEnd = T_WRITE + steps * T_STEP;
  // How many rungs stand finished, and the one being lowered.
  const done = t < T_WRITE ? 1 : min(n, 1 + floor((t - T_WRITE) / T_STEP));
  const live = t >= T_WRITE && t < tEnd ? done : -1;
  const tau = live > 0 ? t - T_WRITE - (live - 1) * T_STEP : 0;
  const hold = t >= tEnd ? t - tEnd : -1;
  const clear = hold > T_HOLD ? hold - T_HOLD : -1;
  const fade = (r) => (clear < 0 ? 1 : 1 - ease((clear - r * 0.07) / 0.35));

  for (let r = 0; r < n; r++) {
    const f = fade(r);
    if (f <= 0) continue;
    const y0 = gy(r), pale = PALE[r], acc = ACC[r], cell = CELL[r];
    if (r < done && r !== live) {
      // A finished rung: the changed letter on its tinted cell.
      const c = r > 0 ? diff(r) : -1;
      let pulse = 0;
      if (hold >= 0 && r > 0) pulse = max(0, 1 - abs(hold - 0.25 - r * 0.16) / 0.25);
      if (c >= 0) box(S, 2 + c * cw + 1, r * rh + 1, cw - 2, rh - 2, cell, (0.3 + 0.3 * pulse) * f);
      for (let i = 0; i < L; i++) {
        const ch = words[r][i];
        if (r === 0 && t < T_WRITE) {
          // The first word writes itself, letter after letter in stroke order.
          const p = cl((t / (T_WRITE * 0.85)) * L - i, 0, 1);
          stamp(S, ch, gx(i), y0, sx, sy, rad, pale, f, floor(p * NP));
        } else {
          const goal = r === n - 1 && hold >= 0 ? max(0, 1 - hold / 0.6) : 0;
          stamp(S, ch, gx(i), y0, sx, sy, rad, i === c ? acc : pale, f * (1 + 0.6 * pulse + goal));
        }
      }
    } else if (r === live) {
      // Lowering a copy of the rung above while one letter re-forms.
      const c = diff(r), a = words[r - 1], drop = ease(tau / 0.5);
      const yd = gy(r - 1) + drop * rh;
      box(S, 2 + c * cw + 1, r * rh + 1, cw - 2, rh - 2, cell, 0.3 * ease((tau - 0.3) / 0.5));
      if (r === n - 1) for (let i = 0; i < L; i++) stamp(S, words[r][i], gx(i), y0, sx, sy, rad, pale, 0.38 * (1 - drop));
      for (let i = 0; i < L; i++) if (i !== c) stamp(S, a[i], gx(i), yd, sx, sy, rad, pale, 0.25 + 0.75 * drop);
      // The changed letter rides down as the old glyph, then its ink runs
      // point by point, in stroke order, into the new glyph.
      const p0 = GLYPH[a[c]], p1 = GLYPH[words[r][c]], x0 = gx(c);
      for (let k = 0; k < NP; k++) {
        const e = ease((tau - 0.3 - 0.35 * (k / NP)) / 0.4);
        const xa = x0 + p0[2 * k] * sx, ya = yd + p0[2 * k + 1] * sy;
        const xb = x0 + p1[2 * k] * sx, yb = y0 + p1[2 * k + 1] * sy;
        const sw = sin(PI * e) * gh * 0.18, an = (2 * PI * k) / NP;
        for (let j = 0; j < 3; j++) col[j] = pale[j] + (acc[j] - pale[j]) * min(1, e * 3);
        dot(ink, xa + (xb - xa) * e + sw * cos(an), ya + (yb - ya) * e + sw * sin(an), rad, col, (0.25 + 0.75 * drop) * (1 + 0.5 * sin(PI * e)));
      }
    } else {
      // A rung still to find: blanks, and the goal word waiting dimly.
      const a = t < T_WRITE ? cl(t / T_WRITE, 0, 1) : 1;
      if (r === n - 1) for (let i = 0; i < L; i++) stamp(S, words[r][i], gx(i), y0, sx, sy, rad, pale, 0.38 * a * f);
      else for (let i = 0; i < L; i++) box(S, gx(i), y0 + gh - 1, gw, 1, pale, 0.3 * a * f);
    }
  }
  // The rails, down to the lowest rung so far: the panel's two edge columns.
  const reach = t < T_WRITE ? (rh * t) / T_WRITE : live > 0 ? (live - 1 + ease(tau / 0.5)) * rh + rh : done * rh;
  for (let y = 0; y < min(H, round(reach)); y++) {
    const r = min(n - 1, floor(y / rh)), f = fade(r) * 0.6;
    if (f <= 0) continue;
    box(S, 0, y, 1, 1, PALE[r], f);
    box(S, W - 1, y, 1, 1, PALE[r], f);
  }
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, round(cl(ink[o], 0, 1) * 255), round(cl(ink[o + 1], 0, 1) * 255), round(cl(ink[o + 2], 0, 1) * 255));
  }
}
