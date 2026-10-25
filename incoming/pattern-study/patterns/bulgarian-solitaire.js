// ===== Patternflow pattern =====
// Title:   Bulgarian Solitaire
// Family:  number
// Idea:    Cards stand in piles on the floor, and every move one card lifts off each pile, they fly up into a new pile that drops into its place while the old piles slide into order, until the ten cards stand as the staircase 4, 3, 2, 1, which holds, and they are gathered and dealt again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bulgarian solitaire (Jørgen Brandt, 1982)
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..6, Size=4..8, Extra=0..1
//
// Knob 1: Hue. Turns the cards' colours together. Each pile of a deal has its own colour and its cards keep it through the play; at 0 the piles are azure, blue, violet, rose, orange, lime and so on in steps of 0.13 round the wheel, every card at full brightness, with a white suit on its face.
// Knob 2: Speed. At 2 a move takes 1.6 seconds, so the slowest start of ten cards reaches the staircase in 12 moves and 19 seconds; at 0.25 a move takes 12.8 seconds, at 6 half a second.
// Knob 3: Size. The staircase k, from 4 to 8: 10, 15, 21, 28 or 36 cards. A new size is dealt first from the slowest start, k - 1, k - 1, k - 2, ..., 2, 1, 1, which takes the most moves any start can, k^2 - k: 12, 20, 30, 42 or 56; then twice from a random start, then the slowest again. The tally along the top lights a mark a move against k^2 - k dim marks.
// Knob 4: Extra. Cards beyond k(k + 1)/2: none below 1/(k + 1), 0.2 at Size 4, and one more for each further 1/(k + 1), up to k at 1. Then the play never settles: it falls into a cycle where the piles are the staircase with one extra card, rimmed white, on some of its steps, and the extra cards move round the steps and come back to their places after k + 1 moves or a divisor of it. The cycle is played round once more with gold marks in the tally, and then the cards are dealt again.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// The floor's top row; cards stand on it. Rows above TOP stay clear for the tally.
const FLOOR = 124, TOP = 10;
// Tallest and shortest card, in LEDs, and the widest pile slot.
const CHMAX = 18, CHMIN = 4, SWMAX = 14;
// Seconds at Speed 2: one move, gathering the cards, dealing them, holding the end.
const MOVE = 1.6, GATHER = 0.9, DEAL = 1.8, HOLD = 2.6;
// Phases of a move: the lift ends at A and the flight at B; the old piles
// slide into order from S0 to SL, clearing the place under the new pile,
// which drops from SL to C and bounces BOUNCE LEDs.
const A = 0.14, B = 0.5, S0 = 0.36, SL = 0.68, C = 0.86, BOUNCE = 2;
// Every DEALS-th deal is the slowest start, k - 1, k - 1, k - 2, ..., 2, 1, 1.
const DEALS = 3;
// Hue at Hue 0 and the step between the hues of the dealt piles.
const HUE0 = 0.55, STEP = 0.13;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// One move of Bulgarian solitaire on piles of card ids (each pile bottom to
// top): the top card of every pile, left to right, makes a new pile; the
// piles are then sorted tallest first, the new one after the old of its height.
function move(piles) {
  const fresh = piles.map((p) => p[p.length - 1]);
  const out = piles.map((p) => p.slice(0, -1)).filter((p) => p.length);
  out.push(fresh);
  return out.map((p, i) => [p, i]).sort((a, b) => b[0].length - a[0].length || a[1] - b[1]).map((e) => e[0]);
}

const key = (piles) => piles.map((p) => p.length).join(",");

// Play from a start until the heights repeat: the staircase, or a cycle.
function play(start) {
  const states = [start], seen = new Map([[key(start), 0]]);
  for (;;) {
    const next = move(states[states.length - 1]), k = key(next);
    if (seen.has(k)) return { states, loop: seen.get(k) };
    seen.set(k, states.length);
    states.push(next);
  }
}

// Partitions of n into at most b parts of at most a each, counted, so a
// random start can be drawn evenly from those that fit a box of side k + 1.
const QCOUNT = new Map();
function qcount(n, a, b) {
  if (n === 0) return 1;
  if (a === 0 || b === 0 || n > a * b) return 0;
  const key = (n * 64 + a) * 64 + b;
  if (QCOUNT.has(key)) return QCOUNT.get(key);
  let s = 0;
  for (let p = 1; p <= min(n, a); p++) s += qcount(n - p, p, b - 1);
  QCOUNT.set(key, s);
  return s;
}
function randomPartition(n, side) {
  const out = [];
  let a = side, b = side;
  while (n > 0) {
    let r = Math.random() * qcount(n, a, b), p = min(n, a);
    for (; p > 1; p--) {
      const c = qcount(n - p, p, b - 1);
      if (r < c) break;
      r -= c;
    }
    out.push(p);
    n -= p;
    a = p;
    b--;
  }
  return out;
}

export function setup(params) {
  params.s = {
    begun: false, k: 4, extra: 0, hue: 0, rate: 1, deals: 0,
    game: null, mode: "deal", t: 0, at: 0, hues: null, prevHues: null, suits: null, prevSuits: null, prev: null, cards: null,
    rgb: new Float32Array(W * H * 3), c3: new Float32Array(3),
  };
}

// A new game: the heights of the start, the cards dealt into them, the play
// worked out to the end, and the layout that fits every state of it.
function newGame(S) {
  const k = S.k, tri = (k * (k + 1)) / 2, n = tri + S.extra;
  let heights;
  if (S.extra === 0 && S.deals % DEALS === 0) {
    heights = [k - 1];
    for (let h = k - 1; h >= 1; h--) heights.push(h);
    heights.push(1);
  } else heights = randomPartition(n, k + 1);
  S.deals++;
  let id = 0;
  const start = heights.map((h) => Array.from({ length: h }, () => id++));
  const hues = new Float32Array(n), suits = new Uint8Array(n);
  start.forEach((p, i) => p.forEach((c) => ((hues[c] = i * STEP), (suits[c] = i % 4))));
  const g = play(start);
  // Slots for the most piles of any state; cards as tall as the tallest pile allows.
  let slots = 0, tall = 0;
  for (const s of g.states) {
    slots = max(slots, s.length);
    for (const p of s) tall = max(tall, p.length);
  }
  const sw = min(SWMAX, floor(W / slots)), cw = sw - (sw >= 8 ? 2 : 1);
  const ch = cl(floor((FLOOR - TOP) / (tall + 0.6)), CHMIN, CHMAX);
  const moves = g.states.length - 1;
  S.game = { ...g, n, k, tri: S.extra === 0, sw, cw, ch, moves, period: g.states.length - g.loop };
  S.prevHues = S.hues;
  S.prevSuits = S.suits;
  S.hues = hues;
  S.suits = suits;
  S.prev = S.cards;
  S.mode = "gather";
  S.t = 0;
  S.at = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0];
  S.rate = cl(kn[1], 0.25, 6) / 2;
  const k = round(cl(kn[2], 4, 8)), extra = min(k, floor(cl(kn[3], 0, 1) * (k + 1)));
  if (!S.begun || k !== S.k || extra !== S.extra) {
    // A new size starts again from the slowest start.
    if (k !== S.k || !S.begun) S.deals = 0;
    S.k = k;
    S.extra = extra;
    newGame(S);
    if (!S.begun) (S.mode = "deal"), (S.prev = null);
    S.begun = true;
  }
  S.t += d * S.rate;
  const G = S.game;
  if (S.mode === "gather" && S.t >= GATHER) (S.mode = "deal"), (S.t = 0);
  else if (S.mode === "deal" && S.t >= DEAL) (S.mode = "move"), (S.t = 0), (S.at = 0);
  else if (S.mode === "move") {
    while (S.t >= MOVE && S.mode === "move") {
      S.t -= MOVE;
      S.at++;
      // A cycle is played round once more after it is found.
      const last = G.states.length - 1 + (G.tri ? 0 : G.period);
      if (S.at >= last) (S.mode = "hold"), (S.t = 0);
    }
  } else if (S.mode === "hold" && S.t >= HOLD) newGame(S);
}

// The state after `i` moves; past the end of a cycle's states it goes round the cycle.
function stateAt(G, i) {
  const L = G.states.length;
  if (i < L) return G.states[i];
  return G.states[G.loop + ((i - G.loop) % G.period)];
}

// In a cycle every state is the staircase k, k - 1, ..., 1, 0 with one card
// more on some of its k + 1 steps; those top cards are the extra ones.
function extras(G, i) {
  const out = new Set();
  if (G.tri || i < G.loop) return out;
  stateAt(G, i).forEach((p, j) => {
    if (p.length > G.k - j) out.add(p[p.length - 1]);
  });
  return out;
}

const slotX = (G, i, count) => (W - count * G.sw) / 2 + i * G.sw + (G.sw - G.cw) / 2;
const levelY = (G, j) => FLOOR - (j + 1) * G.ch;

// Where every card is, as [id, x, y] (top-left corner), for the current frame.
function layout(S) {
  const G = S.game, out = [];
  const rest = (piles, ex) => piles.forEach((p, i) => p.forEach((c, j) => out.push([c, slotX(G, i, piles.length), levelY(G, j), 0, ex.has(c)])));
  if (S.mode === "gather" || S.mode === "deal") {
    // The deck sits high in the middle; cards fly to it and from it.
    const dx = (W - G.cw) / 2, dy = 30;
    if (S.mode === "gather") {
      const u = S.t / GATHER;
      for (const [c, x, y] of S.prev || []) {
        const e = sm(u * 1.4 - (c % 7) * 0.05);
        out.push([-1 - c, lerp(x, dx, e), lerp(y, dy, e) - 14 * sin(PI * e), 0]);
      }
      return out;
    }
    const start = G.states[0], n = G.n, u = S.t / DEAL;
    let order = 0;
    start.forEach((p, i) =>
      p.forEach((c, j) => {
        const e = sm((u - (order++ / n) * 0.7) / 0.3);
        out.push([c, lerp(dx, slotX(G, i, start.length), e), lerp(dy, levelY(G, j), e) - 10 * sin(PI * e), 0]);
      }),
    );
    return out;
  }
  const P = stateAt(G, S.at);
  if (S.mode === "hold") {
    rest(P, extras(G, S.at));
    return out;
  }
  const Q = stateAt(G, S.at + 1), m = P.length, u = S.t / MOVE;
  // The top cards lift, fly up and stack bottom first into the new pile,
  // which hangs at the top of the panel above its place in Q; the old piles
  // slide into their places, and it drops to the floor.
  const a = sm(u / A), c = sm((u - S0) / (SL - S0)), d = cl((u - SL) / (C - SL), 0, 1);
  const qIndex = new Map(Q.map((p, i) => [p[0], i]));
  const nx = slotX(G, qIndex.get(P[0][P[0].length - 1]), Q.length);
  const R = max(0, FLOOR - m * G.ch - TOP);
  const drop = R * (1 - d * d) - (u > C ? BOUNCE * sin((PI * (u - C)) / (1 - C)) : 0);
  const st = min(0.03, (B - A) / (2 * m)), lift = a * (G.ch * 0.5 + 3), ex = extras(G, u < SL ? S.at : S.at + 1);
  P.forEach((p, i) => {
    const below = p.length - 1;
    let x = slotX(G, i, m);
    if (below > 0) x = lerp(x, slotX(G, qIndex.get(p[0]), Q.length), c);
    for (let j = 0; j < below; j++) out.push([p[j], x, levelY(G, j), 0, ex.has(p[j])]);
    const f = sm((u - A - i * st) / (B - A - (m - 1) * st));
    const tx = lerp(x, nx, f), ty = lerp(levelY(G, below) - lift, levelY(G, i) - R, f) - 6 * sin(PI * f) + (u >= B ? R - drop : 0);
    out.push([p[below], u < B ? tx : nx, ty, 1, ex.has(p[below])]);
  });
  return out;
}

// Suits, 5 by 5, one row per string: diamond, heart, spade, club.
const SUITS = [
  ["..#..", ".###.", "#####", ".###.", "..#.."],
  [".#.#.", "#####", "#####", ".###.", "..#.."],
  ["..#..", ".###.", "#####", "#.#.#", "..#.."],
  ["..#..", ".###.", "##.##", "#####", "..#.."],
].map((rows) => rows.map((r) => [...r].map((ch) => ch === "#")));
// The same, 3 by 3, for the corners.
const PIPS = [
  [".#.", "###", ".#."],
  ["#.#", "###", ".#."],
  [".#.", "###", "#.#"],
  [".#.", "###", "###"],
].map((rows) => rows.map((r) => [...r].map((ch) => ch === "#")));

function put(rgb, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= FLOOR) return;
  const o = (y * W + x) * 3;
  (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.game) return;
  const G = S.game, { rgb, c3 } = S;
  rgb.fill(0);
  const cards = layout(S);
  S.cards = cards.filter((e) => e[0] >= 0);
  // The floor.
  for (let x = 0; x < W; x++)
    for (let y = FLOOR; y < FLOOR + 2; y++) {
      const o = (y * W + x) * 3;
      (rgb[o] = 0.3), (rgb[o + 1] = 0.26), (rgb[o + 2] = 0.42);
    }
  // Cards: resting ones first, flying ones on top. A card is its pile's
  // colour with a paler rim and a white suit in the middle; an extra card of
  // a cycle has a white rim.
  cards.sort((p, q) => p[3] - q[3]);
  const cw = G.cw, chh = G.ch - 1;
  for (const [id, x0, y0, , mark] of cards) {
    const old = id < 0, c = old ? -1 - id : id;
    hsv(HUE0 + S.hue + (old ? S.prevHues : S.hues)[c], 0.85, 1, c3, 0);
    const [r, g, b] = c3, X = round(x0), Y = round(y0);
    const rr = mark ? 1 : r + (1 - r) * 0.45, rg = mark ? 1 : g + (1 - g) * 0.45, rb = mark ? 1 : b + (1 - b) * 0.45;
    for (let y = Y; y < Y + chh; y++)
      for (let x = X; x < X + cw; x++) {
        const rim = x === X || x === X + cw - 1 || y === Y || y === Y + chh - 1;
        if (rim) put(rgb, x, y, rr, rg, rb);
        else put(rgb, x, y, r, g, b);
      }
    if (cw >= 7 && chh >= 7) {
      const suit = SUITS[(old ? S.prevSuits : S.suits)[c]], sx = X + ((cw - 5) >> 1), sy = Y + ((chh - 5) >> 1);
      for (let v = 0; v < 5; v++) for (let u = 0; u < 5; u++) if (suit[v][u]) put(rgb, sx + u, sy + v, 1, 1, 1);
      if (cw >= 9 && chh >= 15) {
        // Corner pips, the bottom one upside down.
        const pip = PIPS[(old ? S.prevSuits : S.suits)[c]];
        for (let v = 0; v < 3; v++)
          for (let u = 0; u < 3; u++)
            if (pip[v][u]) put(rgb, X + 2 + u, Y + 2 + v, 1, 1, 1), put(rgb, X + cw - 3 - u, Y + chh - 3 - v, 1, 1, 1);
      }
    } else if (cw >= 3 && chh >= 3) put(rgb, X + ((cw - 1) >> 1), Y + ((chh - 1) >> 1), 1, 1, 1);
  }
  // The staircase, once reached, is outlined in white step by step.
  if (S.mode === "hold" && G.tri) {
    const P = stateAt(G, S.at), e = cl(S.t / 0.8, 0, 1) * P.length;
    for (let i = 0; i < P.length && i < e; i++) {
      const x0 = round(slotX(G, i, P.length)) - 1, y0 = round(levelY(G, P[i].length - 1)) - 2, x1 = x0 + G.sw;
      for (let x = x0; x <= x1; x++) put(rgb, x, y0, 1, 1, 1);
      const y1 = i + 1 < P.length ? round(levelY(G, P[i + 1].length - 1)) - 2 : FLOOR;
      for (let y = y0; y <= y1; y++) put(rgb, x1, y, 1, 1, 1);
    }
  }
  // The tally: a mark a move, along the top; for a staircase the dim marks
  // count out the most moves any start can take, k^2 - k.
  const done = S.mode === "hold" ? S.at : S.mode === "move" ? S.at + (S.t / MOVE > C ? 1 : 0) : 0;
  const total = G.tri ? G.k * G.k - G.k : G.states.length - 1 + G.period;
  const rows = Math.ceil(total / 32), per = Math.ceil(total / rows), pitch = floor(W / per), tw = max(1, pitch - 1);
  const x0 = floor((W - per * pitch + 1) / 2);
  for (let i = 0; i < total; i++) {
    const lit = i < done, loop = !G.tri && i >= G.loop;
    const v = lit ? 1 : G.tri ? 0.22 : 0;
    if (!v) continue;
    const X = x0 + (i % per) * pitch, Y = 2 + floor(i / per) * 5;
    for (let y = Y; y < Y + 3; y++) for (let x = X; x < X + tw; x++) put(rgb, x, y, v, v * (loop ? 0.8 : 1), v * (loop ? 0.2 : 1));
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, rgb[o] * 255, rgb[o + 1] * 255, rgb[o + 2] * 255);
}
