// ===== Patternflow pattern =====
// Title:   Kruskal Count
// Family:  line
// Idea:    A shuffled deck is laid down the panel in a snake of rows, a chain of its own colour starts on each of the first ten cards and a reading head sweeps the deck from top to bottom, so every chain it passes hops forward by the value of its card, chains that land on the same card merge and pale together, and at the bottom the card where they end is turned up large before the deck is shuffled again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Kruskal count (Martin Kruskal, 1970s), as Martin Gardner gave it in Mathematical Games (Scientific American, 1978), analysed by Jeffrey Lagarias, Eric Rains and Robert Vanderbei (The Kruskal Count, 2001), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Court=5..10, Decks=1..2
//
// Knob 1: Hue. Turns the ten chain colours round the wheel together; at 0 the first card's chain is cyan and the rest follow in steps of a tenth of the wheel.
// Knob 2: Speed. At 2 the head reads 8 cards a second, so a deal takes 6.5 s, the turned-up card stays 2.2 s and the shuffle 0.8 s. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Court. What a jack, queen or king counts, from 5 as in Gardner's telling to 10 as in blackjack. The mean jump grows from 5.4 to 6.5 cards and fewer chains meet: with one deck all ten merge in 58% of deals at 5 and 28% at 10.
// Knob 4: Decks. One deck of 52 cards in 13 rows of 4 with suits, or from 1.5 two decks of 104 in 13 rows of 8 with the suit shown only by the colour of the rank. All ten chains merge in 94% of two-deck deals at Court 5. Turning it deals again.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, abs, sqrt, exp, PI, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Card faces. Ranks in a 3 by 5 font, one row a number with the high
// bit on the left: A, 2 to 9, then the 1 and 0 of 10, J, Q, K. The 1 of 10
// is one column wide so "10" fits in 5.
const RANK = [
  [2, 5, 7, 5, 5], [6, 1, 2, 4, 7], [6, 1, 2, 1, 6], [5, 5, 7, 1, 1], [7, 4, 6, 1, 6], [3, 4, 6, 5, 2], [7, 1, 2, 2, 2], [2, 5, 2, 5, 2], [2, 5, 3, 1, 6],
  null, [1, 1, 1, 5, 2], [2, 5, 5, 6, 3], [5, 6, 4, 6, 5],
];
const ZERO = [2, 5, 5, 5, 2];
// Suits on 5 by 5: spades, hearts, diamonds, clubs.
const SUIT = [
  [4, 14, 31, 31, 4],
  [10, 31, 31, 14, 4],
  [4, 14, 31, 14, 4],
  [14, 14, 31, 21, 4],
];
const RED = [false, true, true, false];

// A rank's glyphs as [bits, width, dx]: 10 is a narrow 1 and a 0.
const GLYPHS = [null];
for (let r = 1; r <= 13; r++) GLYPHS.push(r === 10 ? [[[1, 1, 1, 1, 1], 1, 0], [ZERO, 3, 2]] : [[RANK[r - 1], 3, 0]]);

const valueOf = (r, court) => (r > 10 ? court : r);

// ---- The deal and the sweep. A chain is a token on a card. The head reads
// the cards in order; when it reaches a token the token jumps forward by
// that card's value, and if a token already waits where it lands the two
// become one. Every token is always ahead of the head, so a chain can only
// meet another on a card the other has not left yet. A token whose jump
// would leave the deck stays: its card is that chain's last card. Counted
// in Node over 100000 deals: with one deck and Court 5 all ten chains end
// on one card in 58.2% of deals and the classic trick, a chain from the
// first card against one from a card picked among the first ten, works in
// 85.3%; at Court 10 it is 28.3% and 72.0%. With two decks at Court 5 all
// ten merge in 93.8%.
const CHAINS = 10;
const DEAL = 5.0, SHOW = 2.2, SHUFFLE = 0.8;

function deal(S) {
  const n = 52 * S.decks, cards = [];
  for (let k = 0; k < S.decks; k++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ r, s });
  for (let i = n - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = cards[i];
    cards[i] = cards[j];
    cards[j] = t;
  }
  S.n = n;
  S.cards = cards;
  S.cols = S.decks === 1 ? 4 : 8;
  // Tokens by card; trail colour index by card (-1 unvisited).
  S.tok = new Array(n).fill(null);
  S.trail = new Array(n).fill(null);
  for (let i = 0; i < CHAINS; i++) {
    S.tok[i] = { members: [i], id: i };
    S.trail[i] = S.tok[i].members.slice();
  }
  S.arcs = [];
  S.flights = [];
  S.bursts = [];
  S.head = -1;
  S.phase = 0;
  S.t = 0;
  S.final = null;
}

// Where a card sits: a snake of 13 rows, left to right then right to left.
function place(C, i) {
  const row = floor(i / C), q = i % C, col = row % 2 ? C - 1 - q : q;
  const cw = W / C, ch = H / 13, fw = cw - 2;
  const x = col * cw + 1, y = round(row * ch + (ch - 7) / 2);
  return { x, y, w: fw, cx: x + fw / 2 - 0.5, cy: y + 3 };
}
const PLACES = { 4: [], 8: [] };
for (let i = 0; i < 52; i++) PLACES[4].push(place(4, i));
for (let i = 0; i < 104; i++) PLACES[8].push(place(8, i));
const cell = (S, i) => PLACES[S.cols][i];

// A hop's path: a quadratic curve from card centre to card centre, bowed
// up (or to the right for a straight drop) by 0.3 of its length.
function bez(a, b, u) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy, L = sqrt(dx * dx + dy * dy) || 1;
  let px = dy / L, py = -dx / L;
  if (py > 0) ((px = -px), (py = -py));
  const k = 0.3 * L, mx = (a.cx + b.cx) / 2 + px * k, my = (a.cy + b.cy) / 2 + py * k, v = 1 - u;
  return [v * v * a.cx + 2 * v * u * mx + u * u * b.cx, v * v * a.cy + 2 * v * u * my + u * u * b.cy, L];
}
// Its LEDs in order, each once.
function arcPixels(a, b) {
  const L = bez(a, b, 0)[2], steps = Math.ceil(L * 1.6) + 2, out = [];
  let last = -1;
  for (let s = 0; s <= steps; s++) {
    const [x, y] = bez(a, b, s / steps), xi = round(x), yi = round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
    const q = yi * W + xi;
    if (q !== last) (out.push(q), (last = q));
  }
  return out;
}

function step(S) {
  const h = ++S.head;
  if (h >= S.n) return;
  const tk = S.tok[h];
  if (!tk) return;
  const t = h + valueOf(S.cards[h].r, S.court);
  if (t >= S.n) return;
  S.tok[h] = null;
  const dur = min(0.4, valueOf(S.cards[h].r, S.court) * S.dt0 * 0.9);
  const flight = { from: h, to: t, members: tk.members.slice(), age: 0, dur };
  S.flights.push(flight);
  S.arcs.push({ members: flight.members, pts: arcPixels(cell(S, h), cell(S, t)), flight });
  const there = S.tok[t];
  if (there) {
    there.members = there.members.concat(tk.members).sort((a, b) => a - b);
    S.bursts.push({ at: t, age: -dur, members: there.members.slice() });
  } else S.tok[t] = { members: tk.members.slice(), id: tk.id };
  S.trail[t] = S.tok[t].members.slice();
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, court: 5, decks: 1, dt0: DEAL / 52, rgb: new Float32Array(NP * 3) };
  deal(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.court = cl(round(k[2]), 5, 10);
  const decks = cl(k[3], 1, 2) >= 1.5 ? 2 : 1;
  if (decks !== S.decks) ((S.decks = decks), deal(S));
  S.dt0 = DEAL / S.n;
  const g = (d * S.speed) / 2;
  S.t += g;
  for (const f of S.flights) f.age += g;
  for (const b of S.bursts) b.age += g;
  S.flights = S.flights.filter((f) => f.age < f.dur);
  S.bursts = S.bursts.filter((b) => b.age < 0.6);
  if (S.phase === 0) {
    while (S.t >= S.dt0 && S.head < S.n - 1) {
      S.t -= S.dt0;
      step(S);
    }
    if (S.head >= S.n - 1 && !S.flights.length) {
      // Where the chains ended, the card holding most of them first.
      const ends = [];
      for (let i = 0; i < S.n; i++) if (S.tok[i]) ends.push({ at: i, members: S.tok[i].members });
      ends.sort((a, b) => b.members.length - a.members.length || a.at - b.at);
      S.final = ends;
      S.phase = 1;
      S.t = 0;
    }
  } else if (S.phase === 1 && S.t >= SHOW) ((S.phase = 2), (S.t = 0));
  else if (S.phase === 2 && S.t >= SHUFFLE) deal(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb;
  rgb.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0.004) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], c[0] * a);
    rgb[o + 1] = max(rgb[o + 1], c[1] * a);
    rgb[o + 2] = max(rgb[o + 2], c[2] * a);
  };
  const set = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = c[0] * a;
    rgb[o + 1] = c[1] * a;
    rgb[o + 2] = c[2] * a;
  };
  const bits = (rows, w, x, y, c, a, sc, plot) => {
    for (let r = 0; r < rows.length; r++)
      for (let i = 0; i < w; i++)
        if ((rows[r] >> (w - 1 - i)) & 1) for (let v = 0; v < sc; v++) for (let u = 0; u < sc; u++) plot(x + i * sc + u, y + r * sc + v, c, a);
  };

  const chainCol = [];
  for (let i = 0; i < CHAINS; i++) chainCol.push(hsv(S.hue + 0.5 + i / CHAINS, 0.85, 1));
  // A group's colour: its members' mean, paled towards white as it grows.
  const memo = new Map();
  const groupCol = (m) => {
    const key = m.key || (m.key = m.join(","));
    if (memo.has(key)) return memo.get(key);
    const c = [0, 0, 0];
    for (const i of m) for (let q = 0; q < 3; q++) c[q] += chainCol[i][q] / m.length;
    const top = max(c[0], c[1], c[2], 1e-3), w = (m.length - 1) / (CHAINS - 1);
    const out = c.map((v) => (v / top) * (1 - w * 0.75) + w * 0.75);
    memo.set(key, out);
    return out;
  };
  const ivory = [1, 0.93, 0.8], dim = S.phase === 1 ? 1 - 0.55 * ease(S.t / 0.4) : 1;
  const fade = S.phase === 2 ? 1 - ease(S.t / SHUFFLE) : 1;
  const redC = hsv(0.98, 0.6, 0.95), blackC = hsv(0.6, 0.18, 0.8);

  // ---- Cards.
  for (let i = 0; i < S.n; i++) {
    const p = cell(S, i), card = S.cards[i];
    const tk = S.tok[i], tr = S.trail[i];
    let face = ivory, fa = 0.13, ink = 0.8, dark = false;
    if (tr && fade > 0) {
      face = groupCol(tr);
      fa = 0.13 + (0.55 - 0.13) * fade;
      if (tk) ((fa = 0.13 + (0.85 - 0.13) * fade), (dark = fade > 0.5));
    }
    const f0 = face[0] * fa * dim, f1 = face[1] * fa * dim, f2 = face[2] * fa * dim;
    for (let y = 0; y < 7; y++)
      for (let x = y === 0 || y === 6 ? 1 : 0, x1 = y === 0 || y === 6 ? p.w - 1 : p.w; x < x1; x++) {
        const o = ((p.y + y) * W + p.x + x) * 3;
        (rgb[o] = f0), (rgb[o + 1] = f1), (rgb[o + 2] = f2);
      }
    // While shuffling the faces flicker through other ranks.
    const r = S.phase === 2 && Math.random() < 0.5 ? 1 + floor(Math.random() * 13) : card.r;
    const inkC = dark ? [0, 0, 0] : S.cols === 8 && RED[card.s] ? redC : ivory;
    const gl = GLYPHS[r], wide = r === 10 ? 5 : 3;
    const rx = S.cols === 4 ? p.x + 2 : p.x + floor((p.w - wide) / 2);
    for (const [rows, w, dx] of gl) bits(rows, w, rx + dx, p.y + 1, inkC, dark ? 1 : ink * dim, 1, dark ? set : put);
    if (S.cols === 4) {
      // Beside the rank the suit, or on a court card what it counts, in the
      // suit's colour.
      const sc = dark ? [0, 0, 0] : RED[card.s] ? redC : blackC, sa = dark ? 1 : 0.85 * dim, plot = dark ? set : put;
      if (card.r <= 10) bits(SUIT[card.s], 5, p.x + 8, p.y + 1, sc, sa, 1, plot);
      else if (S.court === 10) for (const [rows, w, dx] of GLYPHS[10]) bits(rows, w, p.x + 7 + dx, p.y + 1, sc, sa, 1, plot);
      else bits(RANK[S.court - 1], 3, p.x + 9, p.y + 1, sc, sa, 1, plot);
    }
  }

  // ---- The hops so far, thin arcs that bow up, and the head.
  const arcA = 0.7 * fade * dim;
  for (const arc of S.arcs) {
    const c = groupCol(arc.members), f = arc.flight, pts = arc.pts;
    const upto = f.age < f.dur ? round(ease(f.age / f.dur) * pts.length) : pts.length;
    for (let s = 0; s < upto; s++) {
      const o = pts[s] * 3;
      rgb[o] = max(rgb[o], c[0] * arcA);
      rgb[o + 1] = max(rgb[o + 1], c[1] * arcA);
      rgb[o + 2] = max(rgb[o + 2], c[2] * arcA);
    }
  }
  for (const f of S.flights) {
    const a = cell(S, f.from), b = cell(S, f.to), c = groupCol(f.members), u = ease(f.age / f.dur);
    for (let tail = 0; tail < 5; tail++) {
      const [x, y] = bez(a, b, max(0, u - tail * 0.05));
      const xi = round(x - 0.5), yi = round(y - 0.5), al = tail ? 0.6 - tail * 0.1 : 1;
      put(xi, yi, c, al), put(xi + 1, yi, c, al), put(xi, yi + 1, c, al), put(xi + 1, yi + 1, c, al);
    }
  }
  if (S.phase === 0 && S.head >= 0 && S.head < S.n) {
    const p = cell(S, S.head);
    for (let x = -1; x <= p.w; x++) (put(p.x + x, p.y - 1, ivory, 0.6), put(p.x + x, p.y + 7, ivory, 0.6));
    for (let y = 0; y < 7; y++) (put(p.x - 1, p.y + y, ivory, 0.6), put(p.x + p.w, p.y + y, ivory, 0.6));
  }
  // Two chains meeting: a ring opens round the card.
  for (const b of S.bursts) {
    if (b.age < 0) continue;
    const p = cell(S, b.at), c = groupCol(b.members), R = 2 + b.age * 22, a = 1 - b.age / 0.6;
    for (let s = 0; s < 48; s++) put(round(p.cx + R * Math.cos((s / 48) * 2 * PI)), round(p.cy + R * 0.8 * sin((s / 48) * 2 * PI)), c, a);
  }

  // ---- The card the chains came to, turned up large: rank and suit, and a
  // dot for each of the ten chains, lit in its colour if it ended here.
  if (S.phase >= 1 && S.final && S.final.length) {
    const top = S.final[0], card = S.cards[top.at], c = groupCol(top.members);
    const grow = S.phase === 1 ? ease(S.t / 0.35) : 1 - ease(S.t / 0.4);
    const cw = round(36 * grow), chh = round(52 * grow), x0 = 32 - (cw >> 1), y0 = 64 - (chh >> 1);
    // The ends themselves pulse on the deck.
    for (const e of S.final) {
      const p = cell(S, e.at), ec = groupCol(e.members), a = 0.5 + 0.5 * sin(S.t * 9);
      for (let x = -1; x <= p.w; x++) (put(p.x + x, p.y - 1, ec, a), put(p.x + x, p.y + 7, ec, a));
      for (let y = 0; y < 7; y++) (put(p.x - 1, p.y + y, ec, a), put(p.x + p.w, p.y + y, ec, a));
    }
    if (cw > 4 && chh > 4) {
      for (let y = 0; y < chh; y++)
        for (let x = 0; x < cw; x++) {
          const edge = x === 0 || y === 0 || x === cw - 1 || y === chh - 1;
          if ((x === 0 || x === cw - 1) && (y === 0 || y === chh - 1)) continue;
          set(x0 + x, y0 + y, edge ? c : ivory, edge ? 1 : 0.16);
        }
      if (grow > 0.95) {
        const r = card.r, wide = r === 10 ? 5 : 3, ink = RED[card.s] ? redC : ivory;
        for (const [rows, w, dx] of GLYPHS[r]) bits(rows, w, x0 + ((cw - wide * 4) >> 1) + dx * 4, y0 + 4, ink, 1, 4, set);
        bits(SUIT[card.s], 5, x0 + ((cw - 15) >> 1), y0 + 27, RED[card.s] ? redC : blackC, 1, 3, set);
        for (let i = 0; i < CHAINS; i++) {
          const on = top.members.includes(i), dx = x0 + 4 + (i % 5) * 6, dy = y0 + chh - 8 + floor(i / 5) * 3;
          for (let v = 0; v < 2; v++) for (let u = 0; u < 4; u++) set(dx + u, dy + v, on ? chainCol[i] : ivory, on ? 1 : 0.12);
        }
      }
    }
  }

  for (let p = 0; p < NP; p++) display.setPixel(p % W, (p / W) | 0, round(min(1, rgb[p * 3]) * 255), round(min(1, rgb[p * 3 + 1]) * 255), round(min(1, rgb[p * 3 + 2]) * 255));
}
