// ===== Patternflow pattern =====
// Title:   Penney's Game
// Family:  data
// Idea:    A fair coin is tossed into a shift register that runs down the panel one game a row, each game ending where A's or B's three tosses first appear in the window at its right end, so the winning triples stack into a column under the two choices while a tall bar of wins settles onto the odds Conway's leading numbers give.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Penney's game (Walter Penney, Journal of Recreational Mathematics, 1969), its odds by John Horton Conway's leading numbers (Martin Gardner, Scientific American, 1974), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, A=0..7, Rival=0..6
//
// Knob 1: Hue. Turns all four colours round the wheel together: at 0 heads are gold and tails azure, A's wins pink and B's green.
// Knob 2: Speed. Tosses a second: 10 at 2, 1 at 0.2, 15 at 3. A game of HHT against THH takes 6.5 tosses on average, so at 2 a new row comes down about once a second.
// Knob 3: A. The triple A picks, in this order: HHT, THH, TTH, HTT, HTH, THT, HHH, TTT. The first four are a loop: each one is B's best reply to the one before it, and B's best reply to HTT is HHT again. Turning it starts the tally again.
// Knob 4: Rival. B's triple, from the seven A left, ranked by its chance against A: 0 is the best reply, (not x2) x1 x2, which wins 2, 3 or 7 times to 1; 6 is the worst, from an even game against HHH or TTT down to losing 7 times to 1 against THH or HTT. Turning it starts the tally again.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Conway's leading numbers. A triple is three bits, oldest toss first,
// heads 0 and tails 1. XY sets the bit worth 2^(L-1) when the last L tosses
// of X are the first L of Y. B's odds against A are (AA - AB) : (BB - BA).
// Checked against 200,000 simulated games for each of the eight A and its
// best reply: the share B won came within 0.0013 of these numbers.
const N = 3, MASK = 7;
const corr = (X, Y) => {
  let c = 0;
  for (let L = N; L >= 1; L--) if ((X & ((1 << L) - 1)) === Y >> (N - L)) c += 1 << (L - 1);
  return c;
};
// HHT, THH, TTH, HTT first: B's best reply to each is the next, and to HTT
// it is HHT. Then HTH, THT, HHH and TTT.
const A_ORDER = [1, 4, 6, 3, 2, 5, 0, 7];
function matchup(A, rank) {
  const rivals = [];
  for (let B = 0; B < 8; B++) {
    if (B === A) continue;
    const a = corr(A, A) - corr(A, B), b = corr(B, B) - corr(B, A);
    rivals.push({ B, a, b, p: a / (a + b) });
  }
  rivals.sort((u, v) => v.p - u.p || u.B - v.B);
  const r = rivals[rank];
  const g = (x, y) => (y ? g(y, x % y) : x);
  const d = g(r.a, r.b);
  // pB is B's chance of winning a game; the odds read A : B.
  return { A, B: r.B, pB: r.p, oddsA: r.b / d, oddsB: r.a / d };
}

// ---- Type: digits and the letters A and B, 3 by 5.
const GLYPH = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
  A: "010101111101101", B: "110101110101110",
};

// ---- Layout. The stream starts at row 14, one game every 5 rows: coins
// 3 by 3 on a 4 LED pitch, an underline row and a gap. Each game is right
// aligned on the window, the three slots at x = 44, 48 and 52 that the coin
// has to match, so the triples that won stand in one column under A's and
// B's own. 13 slots a row; a longer game shows its last 12 behind a mark.
const TOP = 14, PITCH = 5, XW = 52, SLOTS = 13, ROWS = 23;
const BX = 58, BW = 5, BY = TOP, BH = H - TOP;
const RATE = 5;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, key: "", m: null,
    cur: [], games: [], aw: 0, bw: 0,
    phase: 0, hold: 0, winner: -1, acc: 0, slide: 0, last: -9, won: -9,
    rgb: new Float32Array(W * H * 3),
  };
}

// One game from the first toss to the end, for filling the stream at once.
function playOut(m) {
  const g = [];
  let w = 0;
  for (;;) {
    const c = Math.random() < 0.5 ? 0 : 1;
    g.push(c);
    w = ((w << 1) | c) & MASK;
    if (g.length >= N && w === m.A) return { g, w: 0 };
    if (g.length >= N && w === m.B) return { g, w: 1 };
  }
}

function restart(S) {
  S.games = [];
  S.aw = S.bw = 0;
  for (let i = 0; i < ROWS; i++) {
    const r = playOut(S.m);
    S.games.push(r);
    if (r.w) S.bw++;
    else S.aw++;
  }
  S.cur = [];
  S.phase = 0;
  S.acc = 0;
  S.slide = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const ai = cl(round(k[2]), 0, 7), ri = cl(round(k[3]), 0, 6), key = ai + "," + ri;
  if (key !== S.key) {
    S.key = key;
    S.m = matchup(A_ORDER[ai], ri);
    restart(S);
  }
  const m = S.m;
  if (S.phase === 0) {
    S.acc += d * RATE * S.speed;
    while (S.acc >= 1 && S.phase === 0) {
      S.acc -= 1;
      const c = Math.random() < 0.5 ? 0 : 1;
      S.cur.push(c);
      S.last = S.t;
      const n = S.cur.length;
      if (n >= N) {
        const w = (S.cur[n - 3] << 2) | (S.cur[n - 2] << 1) | S.cur[n - 1];
        if (w === m.A || w === m.B) {
          S.winner = w === m.A ? 0 : 1;
          if (S.winner) S.bw++;
          else S.aw++;
          S.phase = 1;
          S.hold = 0;
          S.won = S.t;
        }
      }
    }
  } else {
    // The winning triple holds a moment, then the row goes down.
    S.hold += d;
    if (S.hold >= min(1.5, 0.7 / S.speed)) {
      S.games.unshift({ g: S.cur, w: S.winner });
      if (S.games.length > ROWS + 1) S.games.pop();
      S.cur = [];
      S.phase = 0;
      S.acc = 0;
      S.slide += PITCH;
    }
  }
  S.slide = max(0, S.slide - d * PITCH * 6);
}

function put(rgb, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  rgb[p] += c[0] * v, rgb[p + 1] += c[1] * v, rgb[p + 2] += c[2] * v;
}
// A coin: a 3 by 3 disc with soft corners.
function coin(rgb, x, y, c, v) {
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(rgb, x + i, y + j, c, i !== 1 && j !== 1 ? v * 0.35 : v);
}
function glyph(rgb, ch, x, y, c, v) {
  const g = GLYPH[ch];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") put(rgb, x + q, y + r, c, v);
}
function number(rgb, n, xr, y, c, v) {
  const s = String(n);
  for (let i = 0; i < s.length; i++) glyph(rgb, s[s.length - 1 - i], xr - 3 - 4 * i, y, c, v);
}

// One game's row with its top at y. live: the game still being tossed.
function row(S, rgb, g, w, y, live, cols) {
  if (y + 3 < TOP - 1 || y >= H) return;
  const n = g.length, show = n > SLOTS ? SLOTS - 1 : n, t = S.t;
  for (let j = 0; j < show; j++) {
    const c = g[n - 1 - j], x = XW - 4 * j;
    let v = j < N ? 0.95 : 0.62;
    if (live) {
      v = j < N ? 0.85 : 0.6;
      if (j === 0) v = min(1, v + 0.6 * exp(-(t - S.last) * 8));
    }
    if (y >= TOP - 1) coin(rgb, x, y, c ? cols.T : cols.H, v);
  }
  if (n > SLOTS) for (let j = 0; j < 3; j++) put(rgb, XW - 4 * (SLOTS - 1) + j, y + 1, cols.dim, 0.5);
  if (w >= 0 && n >= N && y + 3 >= TOP) {
    let v = 0.7;
    if (live) v = 0.6 + 0.4 * (0.5 + 0.5 * Math.cos((t - S.won) * 18));
    for (let x = XW - 8; x <= XW + 2; x++) put(rgb, x, y + 3, w ? cols.B : cols.A, v);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.m) return;
  const rgb = S.rgb, m = S.m, hue = S.hue;
  rgb.fill(0);
  const cols = {
    H: hsv(0.14 + hue, 0.66, 1), T: hsv(0.57 + hue, 0.8, 1),
    A: hsv(0.9 + hue, 0.62, 1), B: hsv(0.36 + hue, 0.72, 1),
    dim: hsv(0.6 + hue, 0.1, 1), ink: hsv(0.6 + hue, 0.06, 1),
  };

  // Header: count, letter, triple, and the player's side of the odds.
  for (let s = 0; s < 2; s++) {
    const y = 1 + 6 * s, c = s ? cols.B : cols.A, X = s ? m.B : m.A;
    number(rgb, s ? S.bw : S.aw, 35, y, c, 0.75);
    glyph(rgb, s ? "B" : "A", 38, y, c, 1);
    for (let j = 0; j < N; j++) coin(rgb, XW - 8 + 4 * j, y + 1, (X >> (N - 1 - j)) & 1 ? cols.T : cols.H, 1);
    glyph(rgb, String(s ? m.oddsB : m.oddsA), 59, y, cols.ink, 0.9);
  }

  // The stream: the game being tossed at the top, the finished ones below.
  const sl = round(S.slide);
  row(S, rgb, S.cur, S.phase === 1 ? S.winner : -1, TOP - sl, true, cols);
  for (let k = 0; k < S.games.length; k++) {
    const y = TOP + PITCH * (k + 1) - sl;
    if (y >= H) break;
    row(S, rgb, S.games[k].g, S.games[k].w, y, false, cols);
  }

  // The tally: A's share of the games from the top of the bar, B's below,
  // and a white tick where Conway's numbers put the line.
  const tot = S.aw + S.bw, ha = tot ? round((BH * S.aw) / tot) : 0;
  for (let y = BY; y < H; y++) {
    const isA = y - BY < ha, c = isA ? cols.A : cols.B;
    for (let x = BX; x < BX + BW; x++) put(rgb, x, y, c, 0.55);
  }
  const yt = BY + round(BH * (1 - m.pB));
  for (let x = BX - 2; x < W; x++) put(rgb, x, yt, cols.ink, x >= BX && x < BX + BW ? 0.45 : 1);

  for (let p = 0; p < W * H; p++) {
    const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2];
    if (r + g + b > 0) display.setPixel(p % W, floor(p / W), min(255, 255 * r) | 0, min(255, 255 * g) | 0, min(255, 255 * b) | 0);
  }
}
