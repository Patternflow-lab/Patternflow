// ===== Patternflow pattern =====
// Title:   Mastermind
// Family:  algo
// Idea:    All 1296 codes of four pegs in six colours stand as a 6 by 6 grid of 6 by 6 blocks at the top, and Knuth's minimax player plays real games on the board below: each guess splits the codes still possible into colours by the answer they would give, the answer comes, and every class but one fades out, so the grid empties to a single LED in at most five guesses.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Mastermind (Mordecai Meirowitz, 1970), minimax strategy (Donald E. Knuth, The Computer as Master Mind, 1976), expected size (Robert W. Irving, 1979), most parts (Barteld Kooi, 2005), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strategy=0..3, Codemaker=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together: at 0 the codes still possible are warm white, the six peg colours start from red, and the 14 answers each have their own colour.
// Knob 2: Speed. Beats a second: 2 at 2, so one guess (search 1 beat, place 1, split 2, answer 1, fade 1.5) takes 3.25 s and a game about 17 s; 0.2 at 0.2, 3 at 3.
// Knob 3: Strategy. How the codebreaker picks a guess from all 1296 codes. 0 Knuth's minimax: the guess whose largest answer class is smallest, 4.476 guesses a game over all 1296 secrets. 1 Irving's expected size: the smallest sum of squared class sizes, 4.395. 2 Kooi's most parts: the most answer classes, 4.373. Ties go to a code still possible, then the lowest. 3 A random code still possible, about 4.66. Turning it takes effect from the next guess.
// Knob 4: Codemaker. 0 picks a secret at random and answers honestly. 1 cheats within the rules, behind a red shield: it keeps no secret and always gives the answer that leaves the most codes. Knuth's player still wins in 5 every time, Irving's in 5, Kooi's only in 6, the random one in 5 to 8.

const W = 64, H = 128;
const { floor, round, min, max, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

// ---- Codes. A code is four pegs in six colours, c = 216 p1 + 36 p2 + 6 p3 + p4,
// so Knuth's 1122 is 7. The answer to guess g for secret s is b black pegs
// (right colour, right place) and w white (right colour, wrong place), kept as
// b * 5 + w. Of the 25 slots 14 occur; 3 black and 1 white cannot.
const N = 1296, DIG = new Uint8Array(N * 4), CNT = new Uint8Array(N * 6);
for (let c = 0; c < N; c++)
  for (let j = 0; j < 4; j++) {
    const d = floor(c / [216, 36, 6, 1][j]) % 6;
    DIG[c * 4 + j] = d;
    CNT[c * 6 + d]++;
  }
function answer(g, s) {
  let b = 0, t = 0;
  for (let j = 0; j < 4; j++) if (DIG[g * 4 + j] === DIG[s * 4 + j]) b++;
  for (let d = 0; d < 6; d++) t += min(CNT[g * 6 + d], CNT[s * 6 + d]);
  return b * 5 + t - b;
}
const WIN = 20;
const ANS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 15, 20], CLS = new Int8Array(25).fill(-1);
ANS.forEach((a, i) => (CLS[a] = i));

// The answer table, 1296 by 1296 bytes, built once on the first frame (about
// 30 ms in Node, the only heavy frame): each guess's score is then |S| lookups.
let FB = null;
function table() {
  if (FB) return FB;
  FB = new Uint8Array(N * N);
  for (let g = 0; g < N; g++)
    for (let s = g; s < N; s++) {
      const a = answer(g, s);
      FB[g * N + s] = a;
      FB[s * N + g] = a;
    }
  return FB;
}

// ---- Strategies. Every guess is chosen over all 1296 codes, those already
// ruled out too, by the sizes n_i of the classes it splits S into:
// 0 Knuth (1976), the smallest largest n_i; 1 Irving (1979), the smallest
// sum of n_i^2, which is the expected size of what is left; 2 Kooi (2005), the
// most classes. Ties go to a code in S, then the lowest. 3 picks a random code
// from S. Played offline against all 1296 secrets with this code: Knuth opens
// 1122 and takes 5801 guesses, 4.476 a game, never more than 5 (1, 6, 62, 533
// and 694 games of 1 to 5 guesses, as in Knuth's paper); Irving opens 1123,
// 5696, 4.395, at most 6; Kooi opens 1123, 5668, 4.373, at most 6; random,
// over ten seeds, 4.626 to 4.693 a game, at most 8.
const counts = new Int32Array(25);
function score(strat, g, S, n) {
  counts.fill(0);
  const row = g * N;
  for (let i = 0; i < n; i++) counts[FB[row + S[i]]]++;
  let v = 0;
  if (strat === 0) for (let a = 0; a < 25; a++) v = max(v, counts[a]);
  else if (strat === 1) for (let a = 0; a < 25; a++) v += counts[a] * counts[a];
  else for (let a = 0; a < 25; a++) v -= counts[a] > 0;
  return v;
}
// The first guess of a game sees all 1296 codes, so it and its scores are the
// same every game: kept after the first search.
const FIRST = [null, null, null];

// A search in progress: the candidates are scored in slices of about 120,000
// lookups a frame, half a millisecond in Node, so the first guess of a game
// (1296 x 1296) spreads over 14 frames, inside its one beat at Speed 2.
function search(strat) {
  return { strat, g: 0, best: -1, bs: 0, bin: false, done: false, sc: new Float32Array(N) };
}
function step(G, q, budget) {
  if (q.done) return;
  const S = G.S, n = G.n;
  if (q.strat === 3) {
    q.best = S[floor(Math.random() * n)];
    q.g = N;
    q.done = true;
    return;
  }
  if (n === N && FIRST[q.strat]) {
    const f = FIRST[q.strat];
    q.best = f.best;
    q.bs = f.bs;
    q.sc = f.sc;
    q.g = N;
    q.done = true;
    return;
  }
  let work = 0;
  while (q.g < N && work < budget) {
    const g = q.g++, v = score(q.strat, g, S, n), inS = G.inS[g] === 1;
    q.sc[g] = v;
    if (q.best < 0 || v < q.bs || (v === q.bs && inS && !q.bin)) {
      q.best = g;
      q.bs = v;
      q.bin = inS;
    }
    work += n;
  }
  if (q.g >= N) {
    q.done = true;
    if (n === N) FIRST[q.strat] = q;
  }
}

// The codemaker. Honest: the answer for the secret. Cheating: the answer with
// the most codes of S behind it, a random one of those on a tie, and 4 black
// only once S is that one code. It never has to commit, since every answer it
// gives fits some code still in S. Against it, in Node: Knuth 5 guesses and
// Irving 5 in every one of 300 games, Kooi 6 in every one, random 5 to 8,
// 6.25 on average over 2,000.
function reply(G, g, adv) {
  if (!adv) return FB[g * N + G.secret];
  counts.fill(0);
  for (let i = 0; i < G.n; i++) counts[FB[g * N + G.S[i]]]++;
  if (G.n === 1 && counts[WIN]) return WIN;
  let top = 0, k = 0, pick = WIN;
  for (let a = 0; a < WIN; a++) top = max(top, counts[a]);
  for (let a = 0; a < WIN; a++) if (counts[a] === top && Math.random() * ++k < 1) pick = a;
  return pick;
}

function newGame(S) {
  const G = {
    secret: floor(Math.random() * N), S: new Int16Array(N), n: N, inS: new Uint8Array(N).fill(1),
    rows: [], phase: "choose", ph: 0, q: null, g: -1, ans: -1,
  };
  for (let i = 0; i < N; i++) G.S[i] = i;
  G.q = search(S.strat);
  return G;
}
// Keep the codes of S that give answer a to guess g.
function cut(G, g, a) {
  let m = 0;
  for (let i = 0; i < G.n; i++) {
    const s = G.S[i];
    if (FB[g * N + s] === a) G.S[m++] = s;
    else G.inS[s] = 0;
  }
  G.n = m;
}
function settle(S, G) {
  // The secret a cheating codemaker ends up with is the last code standing.
  if (S.adv && G.n >= 1) G.secret = G.S[0];
  G.rows.push({ g: G.g, ans: G.ans, rem: G.n });
}

// ---- Timing, in beats (Speed beats a second): search at least 1, place 1,
// split 2, answer 1, fade 1.5; a solved board stays 3 beats, then 1.5 to clear.
const T = { choose: 1, place: 1, split: 2, answer: 1, fade: 1.5, reveal: 3, clear: 1.5 };

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, strat: 0, adv: 0, G: null, rgb: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.strat = cl(round(k[2]), 0, 3);
  const adv = cl(round(k[3]), 0, 1);
  table();
  if (!S.G) {
    // Open on a game in progress: the first guess is on the board and the
    // 1296 codes are splitting by the answer they would give it.
    S.adv = adv;
    const G = (S.G = newGame(S));
    while (!G.q.done) step(G, G.q, 1e9);
    G.g = G.q.best;
    G.ans = reply(G, G.g, adv);
    G.phase = "split";
  }
  let G = S.G;
  // Never left with no code standing; a fresh game if it ever were.
  if (G.n === 0) G = S.G = newGame(S);
  if (adv !== S.adv) {
    S.adv = adv;
    // An honest codemaker taking over needs a secret that fits every answer,
    // the one on its way to the board too.
    if (!adv) {
      const fits = [];
      for (let i = 0; i < G.n; i++) if (G.phase === "choose" || FB[G.g * N + G.S[i]] === G.ans) fits.push(G.S[i]);
      if (fits.length) G.secret = fits[floor(Math.random() * fits.length)];
    }
  }
  if (G.phase === "choose" && G.q && G.q.strat !== S.strat && !G.q.done) G.q = search(S.strat);
  if (G.phase === "choose") step(G, G.q, 120000);
  G.ph += d * S.speed;
  const end = T[G.phase];
  if (G.ph < end) return;
  if (G.phase === "choose") {
    if (!G.q.done) return;
    G.g = G.q.best;
    G.ans = reply(G, G.g, S.adv);
    G.phase = "place";
  } else if (G.phase === "place") G.phase = "split";
  else if (G.phase === "split") G.phase = "answer";
  else if (G.phase === "answer") G.phase = "fade";
  else if (G.phase === "fade") {
    cut(G, G.g, G.ans);
    settle(S, G);
    if (G.ans === WIN) G.phase = "reveal";
    else {
      G.phase = "choose";
      G.q = search(S.strat);
    }
  } else if (G.phase === "reveal") G.phase = "clear";
  else if (G.phase === "clear") {
    S.G = newGame(S);
    return;
  }
  G.ph = 0;
}

// ---- Layout. The grid: block row p1, block column p2, and inside a block row
// p3 and column p4, one LED a code, blocks 6 LEDs with 3 dark between: 51 by
// 51 at x 9, y 3. Bars of p1's colour run down the left, p2's along the top.
// The board below, played from the near end as on a real one: the first
// guess at the bottom (y 122), up to eight every 8 rows, each four 6 by 6
// pegs, the key pegs in a 2 by 2 square and, at the right edge, how many
// codes the answer left. The secret sits behind its shield at the far end,
// y 57. A random player can need 8 guesses; Knuth's never more than 5.
const GX = 9, GY = 3, BP = 9, SY = 57, RY = 122, RP = 8, ROWS = 8, PX = 4, KX = 37;
const GLYPH = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111",
};
const gx = (c) => GX + (floor(c / 36) % 6) * BP + (c % 6);
const gy = (c) => GY + floor(c / 216) * BP + (floor(c / 6) % 6);

function put(rgb, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  rgb[p] += c[0] * v, rgb[p + 1] += c[1] * v, rgb[p + 2] += c[2] * v;
}
function peg(rgb, x, y, c, v) {
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6; i++) {
      const corner = (i === 0 || i === 5) && (j === 0 || j === 5);
      put(rgb, x + i, y + j, c, corner ? v * 0.3 : v);
    }
}
function number(rgb, n, xr, y, c, v) {
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    const g = GLYPH[s[s.length - 1 - i]], x = xr - 3 - 4 * i;
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === "1") put(rgb, x + q, y + r, c, v);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, rgb = S.rgb, hue = S.hue, ph = G.ph;
  rgb.fill(0);
  const tone = hsv(0.12 + hue, 0.22, 0.85), ghost = hsv(0.62 + hue, 0.45, 0.115), white = [1, 1, 1];
  const pegs = [0, 1, 2, 3, 4, 5].map((i) => hsv(0.02 + hue + i / 6, 0.85, 1));
  const cls = ANS.map((a, i) => hsv(0.55 + hue + i * 0.382, 0.75, 1));
  const kb = hsv(0.98 + hue, 0.8, 1), kw = hsv(0.6 + hue, 0.05, 1);
  const live = G.phase === "place" || G.phase === "split" || G.phase === "answer" || G.phase === "fade";
  const truth = live ? CLS[G.ans] : -1;

  // The grid. While a guess is searched for, each code the search has scored
  // shows how good a guess it would be: u is the best score so far over its
  // own (for Kooi its parts over the most), and the LED runs from dim blue to
  // gold as u^5, so only guesses near the best shine. When 1122 gets one white
  // peg and leaves 256 codes, Knuth's best is a largest class of 44, met by 48
  // codes, and half of all 1296 do no better than 57. The heat fades through
  // the place beat.
  const q = G.q, heat = (G.phase === "choose" || G.phase === "place") && q && q.strat < 3;
  const upto = G.phase === "choose" ? floor(min(ph / T.choose, q.g / N) * N) : N;
  const keep = G.phase === "place" ? min(1, ph / 0.8) : 0;
  for (let c = 0; c < N; c++) {
    let col;
    if (!G.inS[c]) col = G.phase === "clear" ? mix(ghost, tone, min(1, ph / 1.2)) : ghost;
    else if (G.phase === "split" || G.phase === "answer" || G.phase === "fade") {
      const k = CLS[FB[G.g * N + c]], cc = cls[k];
      if (G.phase === "split") col = mix(tone, cc, min(1, ph / 0.6));
      else if (G.phase === "answer") col = k === truth ? mix(cc, white, 0.25 + 0.25 * sin(ph * PI * 4)) : cc;
      else col = k === truth ? mix(cc, tone, min(1, ph / 1.2)) : mix(cc, ghost, min(1, ph / 1.2));
    } else col = tone;
    if (heat && c < upto) {
      const u = q.strat === 2 ? q.sc[c] / q.bs : q.bs / q.sc[c], u5 = u ** 5;
      col = mix(hsv(0.62 + hue - 0.47 * u, 0.85 - 0.45 * u5, 0.14 + 0.86 * u5), col, keep);
    }
    put(rgb, gx(c), gy(c), col, 1);
  }
  for (let b = 0; b < 6; b++) {
    for (let j = 0; j < 6; j++) {
      put(rgb, 4, GY + b * BP + j, pegs[b], 0.5);
      put(rgb, 5, GY + b * BP + j, pegs[b], 0.5);
      put(rgb, GX + b * BP + j, 0, pegs[b], 0.5);
    }
  }
  // The search front runs over all 1296 codes, ruled out or not, and the best
  // guess so far shines. A random player rolls among S instead. Then the
  // guess blinks until its answer is in.
  if (G.phase === "choose" && q) {
    if (q.strat < 3) {
      for (let i = 0; i < 8; i++) if (upto - i >= 0 && upto - i < N) put(rgb, gx(upto - i), gy(upto - i), white, 0.9 * (1 - i / 8));
    } else for (let i = 0; i < 6; i++) {
      const c = G.S[floor(Math.random() * G.n)];
      put(rgb, gx(c), gy(c), white, 0.8);
    }
    if (q.best >= 0 && upto > 60) put(rgb, gx(q.best), gy(q.best), white, 0.8);
  } else if (live) put(rgb, gx(G.g), gy(G.g), white, 0.55 + 0.45 * sin(S.t * PI * 6));

  // The board.
  const fadeAll = G.phase === "clear" ? max(0, 1 - ph / 1.2) : 1;
  const rows = G.rows.slice();
  if (live) rows.push({ g: G.g, ans: G.ans, rem: -1, now: true });
  const off = max(0, rows.length - ROWS);
  for (let r = 0; r < ROWS; r++) {
    const y = RY - RP * r, R = rows[r + off];
    if (!R) {
      for (let j = 0; j < 4; j++) for (let h = 0; h < 4; h++) put(rgb, PX + 8 * j + 2 + (h & 1), y + 2 + (h >> 1), ghost, 1.3);
      for (let h = 0; h < 4; h++) put(rgb, KX + 3 * (h & 1), y + 3 * (h >> 1), ghost, 1.3);
      continue;
    }
    // Pegs go in one by one through the place beat; keys through the answer.
    const shown = R.now && G.phase === "place" ? floor(ph / 0.2) + 1 : 4;
    for (let j = 0; j < 4; j++) {
      if (j < shown) peg(rgb, PX + 8 * j, y, pegs[DIG[R.g * 4 + j]], 0.9 * fadeAll);
      else for (let h = 0; h < 4; h++) put(rgb, PX + 8 * j + 2 + (h & 1), y + 2 + (h >> 1), ghost, 1.3);
    }
    const keys = R.now ? (G.phase === "answer" ? min(4, floor(ph / 0.2)) : G.phase === "fade" ? 4 : 0) : 4;
    const b = floor(R.ans / 5), w = R.ans % 5;
    for (let h = 0; h < 4; h++) {
      const x = KX + 3 * (h & 1), yy = y + 3 * (h >> 1);
      const kind = h < keys ? (h < b ? kb : h < b + w ? kw : null) : null;
      if (kind) for (let e = 0; e < 4; e++) put(rgb, x + (e & 1), yy + (e >> 1), kind, fadeAll);
      else put(rgb, x, yy, ghost, 1.3);
    }
    const rem = R.now ? (G.phase === "fade" && ph > 0.5 ? null : -1) : R.rem;
    if (rem !== -1) number(rgb, rem === null ? countClass(G) : rem, 63, y + 1, tone, 0.75 * fadeAll);
  }

  // The secret: behind a hatched shield until it is found.
  if (G.phase === "reveal" || G.phase === "clear") {
    const open = G.phase === "reveal" ? min(1, ph / 0.5) : 1;
    for (let j = 0; j < 4; j++) peg(rgb, PX + 8 * j, SY, pegs[DIG[G.secret * 4 + j]], open * fadeAll);
    if (G.phase === "reveal") put(rgb, gx(G.secret), gy(G.secret), white, 0.5 + 0.5 * sin(ph * PI * 3));
  } else {
    const sh = S.adv ? kb : ghost, v = S.adv ? 0.3 : 2.2;
    for (let j = 0; j < 6; j++) for (let x = PX; x < PX + 30; x++) put(rgb, x, SY + j, sh, (x + j) % 4 === 0 ? v * 1.6 : v * 0.7);
  }

  for (let p = 0; p < W * H; p++) {
    const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2];
    if (r + g + b > 0) display.setPixel(p % W, floor(p / W), min(255, 255 * r) | 0, min(255, 255 * g) | 0, min(255, 255 * b) | 0);
  }
}

// How many codes of S give the answer that came: shown as the fade runs.
function countClass(G) {
  let m = 0;
  for (let i = 0; i < G.n; i++) if (FB[G.g * N + G.S[i]] === G.ans) m++;
  return m;
}
