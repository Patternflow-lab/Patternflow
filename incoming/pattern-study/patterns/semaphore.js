// ===== Patternflow pattern =====
// Title:   Semaphore
// Family:  type
// Idea:    A signaller, a white point with two arms each holding a square red and yellow flag, comes down the tall panel from the top edge, stops once for each letter of a word and swings its arms to that letter's pair of the eight clock directions, and every pose it leaves behind stays as a glyph with the decoded capital beside it, drawn in strokes of the same eight directions, so the word reads down the panel's height before the signaller drops off the bottom and the next word comes down over the last one.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: flag semaphore, each letter a pair of arm directions in 45 degree steps as the observer sees them; N over D as Gerald Holtom drew them into the nuclear disarmament symbol (1958); capitals drawn for this pattern in strokes of the same eight directions, pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..7, Guide=0..1
//
// Knob 1: Hue. The panel's own colour, for the arms and the capitals; the flags stay red and yellow. At 0 the arms are azure and the capitals pale azure, at 0.25 violet, at 0.5 a red orange, at 0.75 green; the signaller itself is always near white.
// Knob 2: Speed. At 2 a letter takes 1 s, 0.45 s of swing and 0.55 s held while its capital comes up beside it, and the finished word stands 1.6 s: HELLO takes 6.6 s and SOS 4.6 s. Every time goes as 2 / Speed, 10 s a letter at 0.2 and 0.67 s at 3.
// Knob 3: Word. 0 HELLO, 1 FLAG, 2 SOS, 3 WAVE, 4 SEND, 5 QUIZ, 6 YACHT, 7 KNOT, and after each word the next; in SEND the N and the D stand one over the other. A word fills the 128 rows whatever its length: 42.7 rows a letter for three letters, 32 for four, 25.6 for five, with arms 18.3, 13.8 and 11 LEDs long, flags 7.7, 5.8 and 4.6 LEDs square, and capitals 32, 26 and 21 rows tall. Turning it starts the new word at once from the top, over what was laid of the last.
// Knob 4: Guide. The clock face behind every pose: the eight spokes the arms can take, and at the end of each the outline of the square its flag would fill. Nothing at 0, too faint to see at the opening 0.06, and at 1 half as bright as an arm, so every pose reads as two of eight.

// In flag semaphore a letter is the pair of directions the two arms point
// in, each one of eight, 45 degrees apart. As the observer sees them on a
// clock face, A to G hold one arm at 6 and send the other round from 7:30
// to 4:30; H to N (with no J) hold one at 7:30; O to S at 9; T, U and Y at
// 10:30; and J, V, W, X and Z are what is left. That is 26 of the 28 pairs
// of eight directions. CODE below is that table, written as clock times.
//
// Which arm makes which direction is left out: the observer sees only
// directions, and so does the code. Between letters the two arms swing to
// the new pair along whichever matching of old to new needs the least
// turning, each the short way round, so an arm that holds its direction
// holds still: A to B moves one arm 45 degrees. Before a word and after it
// the arms rest, both pointing down at 6.
//
// The capitals are drawn on a grid four units wide and six tall with
// strokes at 0, 45 and 90 degrees only, the arms' own eight directions:
// round letters are octagons, and N, V, X and Y bend to stay on the grid.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

const CLOCK = { "6": 0, "7:30": 1, "9": 2, "10:30": 3, "12": 4, "1:30": 5, "3": 6, "4:30": 7 };
const CODE = {
  A: "6 7:30", B: "6 9", C: "6 10:30", D: "6 12", E: "6 1:30", F: "6 3", G: "6 4:30",
  H: "7:30 9", I: "7:30 10:30", K: "7:30 12", L: "7:30 1:30", M: "7:30 3", N: "7:30 4:30",
  O: "9 10:30", P: "9 12", Q: "9 1:30", R: "9 3", S: "9 4:30",
  T: "10:30 12", U: "10:30 1:30", Y: "10:30 3",
  J: "12 3", V: "12 4:30", W: "1:30 3", X: "1:30 4:30", Z: "3 4:30",
};
const POSE = {};
for (const c in CODE) POSE[c] = CODE[c].split(" ").map((t) => CLOCK[t]);
const REST = [0, 0];

// Direction k of the eight, k = 0 at 6 o'clock and on clockwise as the
// observer sees it, as a unit vector on the panel (y down). A fractional k
// is an arm on its way between two.
const dirOf = (k) => {
  const a = PI + (k * PI) / 4;
  return [sin(a), -cos(a)];
};

// Capitals: polylines through points xy of the 4 by 6 grid, y down.
const STROKES = {
  A: "06 02 20 42 46|04 44", B: "06 00 30 41 42 33 03|33 44 45 36 06", C: "41 30 10 01 05 16 36 45",
  D: "00 20 42 44 26 06 00", E: "40 00 06 46|03 33", F: "40 00 06|03 33", G: "41 30 10 01 05 16 36 45 43 23",
  H: "00 06|40 46|03 43", I: "10 30|20 26|16 36", J: "40 45 36 16 05", K: "00 06|40 13 46|03 13",
  L: "00 06 46", M: "06 00 22 40 46", N: "06 00|01 45|40 46", O: "10 30 41 45 36 16 05 01 10",
  P: "06 00 30 41 42 33 03", Q: "10 30 41 45 36 16 05 01 10|24 46", R: "06 00 30 41 42 33 03|23 45 46",
  S: "41 30 10 01 02 13 33 44 45 36 16 05", T: "00 40|20 26", U: "00 05 16 36 45 40", V: "00 04 26 44 40",
  W: "00 06 24 46 40", X: "00 01 45 46|40 41 05 06", Y: "00 01 23 41 40|23 26", Z: "00 40 41 05 06 46",
};
const SEGS = {};
for (const c in STROKES) {
  const s = [];
  for (const line of STROKES[c].split("|")) {
    const p = line.split(" ").map((t) => [+t[0], +t[1]]);
    for (let i = 1; i < p.length; i++) s.push([p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]]);
  }
  SEGS[c] = s;
}

const WORDS = ["HELLO", "FLAG", "SOS", "WAVE", "SEND", "QUIZ", "YACHT", "KNOT"];

// Seconds at Speed 2: the swing, a letter, the finished word's stand.
const SWING = 0.45, LETTER = 1, STAND = 1.6, DIM = 0.3, OLD = 0.3;
const RED = [1, 0.07, 0.04], YEL = [1, 0.8, 0], WHITE = [1, 1, 1];

// Where a word of n letters puts things: slot height, arm, flag, the
// hub's x, the capital's grid unit, its left edge and stroke.
function layout(n) {
  const h = H / n, r = 0.43 * h, u = n <= 3 ? 5.4 : n === 4 ? 4.3 : 3.5;
  const hx = r + 2.5, cx = (hx + r + 65) / 2 - 2 * u;
  return { n, h, r, s: 0.42 * r, hx, u, cx, sw: 0.68 * u + 0.2, aw: 0.08 * r + 0.9 };
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function paint(buf, x, y, c, a) {
  if (a <= 0 || x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  if (a > 1) a = 1;
  buf[p] += (c[0] - buf[p]) * a;
  buf[p + 1] += (c[1] - buf[p + 1]) * a;
  buf[p + 2] += (c[2] - buf[p + 2]) * a;
}

// A line of width w from (x0, y0) to (x1, y1), its edge a pixel soft.
function line(buf, x0, y0, x1, y1, w, c, a) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9, e = w / 2 + 0.5;
  for (let y = max(0, floor(min(y0, y1) - e)); y <= min(H - 1, floor(max(y0, y1) + e)); y++)
    for (let x = max(0, floor(min(x0, x1) - e)); x <= min(W - 1, floor(max(x0, x1) + e)); x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * dx + py * dy) / L2, 0, 1);
      const ex = px - t * dx, ey = py - t * dy;
      paint(buf, x, y, c, a * cl(e - sqrt(ex * ex + ey * ey), 0, 1));
    }
}

// The flag on an arm from the hub (x, y) in direction d: a square of side
// s on the staff's clockwise side, its outer edge at the arm's tip, split
// on the diagonal from the staff's inner corner, red on the staff's side.
function flag(buf, x, y, d, r, s, a) {
  const px = -d[1], py = d[0], x0 = x + d[0] * (r - s), y0 = y + d[1] * (r - s);
  const xs = [x0, x0 + d[0] * s, x0 + d[0] * s + px * s, x0 + px * s], ys = [y0, y0 + d[1] * s, y0 + d[1] * s + py * s, y0 + py * s];
  for (let Y = max(0, floor(min(...ys))); Y <= min(H - 1, floor(max(...ys))); Y++)
    for (let X = max(0, floor(min(...xs))); X <= min(W - 1, floor(max(...xs))); X++) {
      let nr = 0, ny = 0;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          const qx = X + (i + 0.5) / 3 - x0, qy = Y + (j + 0.5) / 3 - y0, u = qx * d[0] + qy * d[1], v = qx * px + qy * py;
          if (u < 0 || u > s || v < 0 || v > s) continue;
          if (u >= v) nr++;
          else ny++;
        }
      if (nr) paint(buf, X, Y, RED, (a * nr) / 9);
      if (ny) paint(buf, X, Y, YEL, (a * ny) / 9);
    }
}

// The outline of a flag's square, for the clock face.
function ghost(buf, x, y, d, r, s, c, a) {
  const px = -d[1], py = d[0], x0 = x + d[0] * (r - s), y0 = y + d[1] * (r - s);
  const xs = [x0, x0 + d[0] * s, x0 + d[0] * s + px * s, x0 + px * s], ys = [y0, y0 + d[1] * s, y0 + d[1] * s + py * s, y0 + py * s];
  for (let Y = max(0, floor(min(...ys))); Y <= min(H - 1, floor(max(...ys))); Y++)
    for (let X = max(0, floor(min(...xs))); X <= min(W - 1, floor(max(...xs))); X++) {
      const qx = X + 0.5 - x0, qy = Y + 0.5 - y0, u = qx * d[0] + qy * d[1], v = qx * px + qy * py;
      const e = min(u, s - u, v, s - v);
      paint(buf, X, Y, c, a * cl(1 - abs(e) * 1.4, 0, 1));
    }
}

// The clock face behind a pose: the eight spokes, and at the end of each
// the outline of the square a flag would fill there.
function guide(buf, L, x, y, c, a) {
  if (a <= 0.004) return;
  for (let k = 0; k < 8; k++) {
    const d = dirOf(k);
    line(buf, x + d[0] * 2.5, y + d[1] * 2.5, x + d[0] * L.r, y + d[1] * L.r, 1, c, a);
    ghost(buf, x, y, d, L.r, L.s, c, a);
  }
}

// A pose: arms at directions (fractional k) a0 and a1 from the hub.
function pose(buf, L, x, y, a0, a1, arm, alpha, live) {
  for (const k of [a0, a1]) {
    const d = dirOf(k);
    line(buf, x, y, x + d[0] * L.r, y + d[1] * L.r, L.aw, arm, alpha);
    flag(buf, x, y, d, L.r, L.s, alpha * (live ? 1 : 0.85));
  }
  // The signaller's body is a white point; a laid glyph keeps a dot.
  if (live) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) paint(buf, floor(x) + dx, floor(y) + dy, WHITE, alpha * cl(2.3 - sqrt(dx * dx + dy * dy), 0, 1));
  else paint(buf, floor(x), floor(y), arm, alpha);
}

function capital(buf, L, ch, top, c, a) {
  const segs = SEGS[ch];
  if (!segs || a <= 0) return;
  const u = L.u, x0 = L.cx, e = L.sw / 2 + 0.5;
  for (let y = max(0, floor(top - e)); y <= min(H - 1, floor(top + 6 * u + e)); y++)
    for (let x = max(0, floor(x0 - e)); x <= min(W - 1, floor(x0 + 4 * u + e)); x++) {
      const gx = (x + 0.5 - x0) / u, gy = (y + 0.5 - top) / u;
      let dmin = 1e9;
      for (const s of segs) {
        const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy, px = gx - s[0], py = gy - s[1];
        const t = cl((px * dx + py * dy) / L2, 0, 1), ex = px - t * dx, ey = py - t * dy, dd = ex * ex + ey * ey;
        if (dd < dmin) dmin = dd;
      }
      paint(buf, x, y, c, a * cl(e - sqrt(dmin) * u, 0, 1));
    }
}

// A word's laid glyphs: the first `count`, each pose with its capital at
// alpha a, those whose slot starts above row `cut` left out.
function glyphs(buf, S, word, count, a, cut, col) {
  const L = layout(word.length);
  for (let k = 0; k < count; k++) {
    const top = k * L.h, f = a * cl((top - cut) / 4 + 1, 0, 1);
    if (f <= 0) continue;
    const ch = word[k], p = POSE[ch], y = top + L.h / 2;
    guide(buf, L, L.hx, y, col.guide, f * S.guide);
    pose(buf, L, L.hx, y, p[0], p[1], col.arm, f, false);
    capital(buf, L, ch, y - 3 * L.u, col.cap, f);
  }
}

// The arms' matching from one pair to the next that turns them least,
// each the short way round: [from, turn, from, turn] in eighths of a turn.
function swing(p, q) {
  const turn = (a, b) => {
    let d = (((b - a) % 8) + 8) % 8;
    if (d > 4) d -= 8;
    return d;
  };
  const s1 = abs(turn(p[0], q[0])) + abs(turn(p[1], q[1])), s2 = abs(turn(p[0], q[1])) + abs(turn(p[1], q[0]));
  return s1 <= s2 ? [p[0], turn(p[0], q[0]), p[1], turn(p[1], q[1])] : [p[0], turn(p[0], q[1]), p[1], turn(p[1], q[0])];
}

function start(S, wi, oldWord, oldCount, dimmed) {
  S.wi = ((wi % WORDS.length) + WORDS.length) % WORDS.length;
  S.word = WORDS[S.wi];
  S.old = oldWord;
  S.oldCount = oldCount;
  S.dimmed = !!dimmed;
  S.tau = 0;
}

export function setup(params) {
  params.s = { buf: new Float32Array(N * 3), tau: 0, wi: 0, word: WORDS[0], old: "", oldCount: 0, dimmed: true, knob: -1, guide: 0, hue: 0 };
  start(params.s, 0, WORDS[WORDS.length - 1], WORDS[WORDS.length - 1].length, true);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.guide = cl(k[3] == null ? 0.06 : k[3], 0, 1) * 0.5;
  const kw = round(cl(k[2] || 0, 0, 7));
  if (kw !== S.knob) {
    // A fresh start opens on the word before, already sent; a turn of the
    // knob keeps what is laid of the word in hand.
    const before = WORDS[(kw + WORDS.length - 1) % WORDS.length];
    if (S.knob < 0) start(S, kw, before, before.length, true);
    else start(S, kw, S.word, min(S.word.length, floor(S.tau / LETTER)), false);
    S.knob = kw;
  }
  S.tau += (d * speed) / 2;
  const n = S.word.length;
  if (S.tau >= n * LETTER + STAND) start(S, S.wi + 1, S.word, n);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, tau = S.tau, word = S.word, n = word.length, L = layout(n);
  buf.fill(0);
  const col = { arm: hsv(S.hue + 0.55, 0.8, 0.95), cap: hsv(S.hue + 0.55, 0.6, 1), guide: hsv(S.hue + 0.55, 0.25, 1) };
  const pale = hsv(S.hue + 0.55, 0.3, 1);

  // Where the signaller is: k is the letter in hand, n while it leaves.
  const k = min(n, floor(tau / LETTER)), u = tau - k * LETTER, e = smooth(u / SWING);
  const sy = ((k - 1) * (1 - e) + k * e + 0.5) * L.h;
  const from = k === 0 ? REST : POSE[word[k - 1]], to = k < n ? POSE[word[k]] : REST, m = swing(from, to);

  // The last word, dimmed as this one starts, wiped where this one has come.
  const fade = S.dimmed ? OLD : OLD + (1 - OLD) * (1 - smooth(tau / DIM));
  if (S.old) glyphs(buf, S, S.old, S.oldCount, fade, k < n ? sy + L.h / 2 : H + 99, col);
  glyphs(buf, S, word, k, 1, -99, col);

  // The letter in hand: its capital comes up while the pose is held.
  if (k < n) {
    const ch = word[k], c = smooth((u - SWING) / (LETTER - SWING));
    capital(buf, L, ch, sy - 3 * L.u, col.cap, c);
  }
  guide(buf, L, L.hx, sy, col.guide, S.guide * 1.3);
  pose(buf, L, L.hx, sy, m[0] + m[1] * e, m[2] + m[3] * e, pale, 1, true);

  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
