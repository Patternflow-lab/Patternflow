// ===== Patternflow pattern =====
// Title:   Hitomezashi
// Family:  line
// Idea:    Rows and columns of running stitches, each line's dashes set one step on or off by a bit, split a woven cloth into regions of two colours, and as the bits flip one at a time a whole line of dashes jumps over by one and a wave recolours everything on one side of it, while a light runs round the newest closed loop of thread.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hitomezashi sashiko, with the loop theorem of Colin Defant and Noah Kravitz (2022), pattern round 43
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cell=6..10, Loops=0..1
//
// Knob 1: Hue. Turns the light cloth round the colour wheel: aqua at 0, blue at 0.2, violet at 0.3, pink at 0.45, orange at 0.6, yellow at 0.7 and green at 0.85; the dark cloth stays indigo to violet and the thread stays cream.
// Knob 2: Speed. How often a bit flips and how fast the light runs: at 2 about 2.7 flips a second and 24 stitches a second round the loop; at 0.2 one flip every 3.7 seconds, at 3 four flips a second.
// Knob 3: Cell. The stitch length in LEDs, 6 to 10: at 6 the panel holds 11 by 22 crossings of the thread lines, at 10 it holds 7 by 13.
// Knob 4: Loops. Picks the closed loops out of the open threads: the loops are lit gold, biggest first, and the threads that run off the panel dim. At 0 only the loop with the running light is gold; at 0.06 the biggest 6% of the others are too; at 1 every closed loop on the panel is gold, each 4, 12, 20, 28 or more stitches long and always 4 more than a multiple of 8, and the open threads are down to a third.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The thread, the gold of a lit loop, and the head of the running light.
const THREAD = [1, 0.94, 0.84], GOLD = [1, 0.62, 0.1], HEAD = [1, 1, 0.85];
// The cloth is a plain weave: an LED with x + y even is a thread lying on
// top and catches more light. Brightness of the two kinds in each fill.
const WEAVE = { lightHi: 1, lightLo: 0.6, darkHi: 0.2, darkLo: 0 };
// The recolouring runs out from a flipped line at this many LEDs a second.
const WAVE = 150;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, pitch: 0, loopsK: 0.06,
    // Row line bits a[j] and column line bits b[i], enough for any pitch.
    a: new Uint8Array(32), b: new Uint8Array(16),
    nextFlip: 0.4, swap: 0, recent: [],
    // Cells: colour (0 dark, 1 light), the colour shown, and when it turned.
    col: new Uint8Array(0), show: new Uint8Array(0), when: new Float32Array(0),
    // Lines that just flipped glow for a moment: [row?, index, glow].
    flash: [],
    loops: [], cur: null, head: 0, laps: 0,
    loopOf: new Int16Array(N), posOf: new Float32Array(N),
    geo: null, pal: null, palHue: NaN,
  };
  const S = params.s;
  for (let j = 0; j < S.a.length; j++) S.a[j] = Math.random() < 0.5 ? 1 : 0;
  for (let i = 0; i < S.b.length; i++) S.b[i] = Math.random() < 0.5 ? 1 : 0;
}

// The lattice for a pitch P: node columns i = 0..NI-1 at x = OX + P i and
// node rows j = 0..NJ-1 at y = OY + P j. Cells run one past the nodes on
// every side (cell i lies between node columns i and i+1) and are stored
// at i + 1.
function geometry(P) {
  const NI = floor(63 / P) + 1, NJ = floor(127 / P) + 1;
  const OX = floor((63 - P * (NI - 1)) / 2), OY = floor((127 - P * (NJ - 1)) / 2);
  return { P, NI, NJ, OX, OY, CW: NI + 1, CH: NJ + 1 };
}

// The stitch rule. On row line j the segment from node i to i+1 is a stitch
// when i + a[j] is even; on column line i the segment from node j to j+1 is
// a stitch when j + b[i] is even. So every node has exactly one horizontal
// and one vertical stitch, and the thread turns at every node.
const hs = (S, i, j) => ((i + S.a[j]) & 1) === 0;
const vs = (S, i, j) => ((j + S.b[i]) & 1) === 0;

// Two-colour the cells: crossing a stitch changes colour, crossing a gap
// does not. It is consistent because two stitches meet at every node.
// Starts from the top-left cell, coloured S.swap.
function colour(S, out) {
  const { NI, NJ, CW } = S.geo;
  let c = S.swap;
  for (let j = -1; j < NJ; j++) {
    if (j >= 0) c ^= hs(S, -1, j) ? 1 : 0;
    let r = c;
    out[(j + 1) * CW] = r;
    for (let i = 0; i < NI; i++) {
      r ^= vs(S, i, j) ? 1 : 0;
      out[(j + 1) * CW + i + 1] = r;
    }
  }
}

// Follow the thread from node (i0, j0): its nodes in order if it closes into
// a loop on the panel's lattice, or null if it runs off the edge.
function trace(S, i0, j0) {
  const { NI, NJ } = S.geo;
  const path = [];
  let i = i0, j = j0, pi = -9, pj = -9;
  for (let n = 0; n <= NI * NJ; n++) {
    path.push(j * NI + i);
    const hx = hs(S, i, j) ? i + 1 : i - 1, vy = vs(S, i, j) ? j + 1 : j - 1;
    if (hx < 0 || hx >= NI || vy < 0 || vy >= NJ) return null;
    // The thread alternates: after a horizontal stitch comes a vertical one.
    if (hx === pi && j === pj) (pi = i), (pj = j), (j = vy);
    else (pi = i), (pj = j), (i = hx);
    if (i === i0 && j === j0) return path;
  }
  return null;
}

// Every closed loop on the lattice, biggest first, and which LED lies on
// which loop and how far round it, in stitches.
function findLoops(S) {
  const { NI, NJ, P, OX, OY } = S.geo;
  const seen = new Uint8Array(NI * NJ), loops = [];
  for (let n = 0; n < NI * NJ; n++) {
    if (seen[n]) continue;
    const path = trace(S, n % NI, floor(n / NI));
    if (!path) continue;
    for (const u of path) seen[u] = 1;
    loops.push(path);
  }
  loops.sort((p, q) => q.length - p.length);
  S.loops = loops;
  S.loopOf.fill(-1);
  loops.forEach((path, n) => {
    const L = path.length;
    for (let k = 0; k < L; k++) {
      const u = path[k], v = path[(k + 1) % L];
      const x0 = OX + P * (u % NI), y0 = OY + P * floor(u / NI), x1 = OX + P * (v % NI), y1 = OY + P * floor(v / NI);
      for (let s = 0; s < P; s++) {
        const x = x0 + ((x1 - x0) / P) * s, y = y0 + ((y1 - y0) / P) * s;
        S.loopOf[y * W + x] = n;
        S.posOf[y * W + x] = k + s / P;
      }
    }
  });
}

// The longest loop through line k (a row line or a column line), which is
// the longest loop a flip of that line's bit makes or keeps whole: a loop
// that does not touch the line is left as it was.
function longestThrough(S, row, k) {
  const { NI, NJ } = S.geo;
  let best = 0;
  for (let n = 0; n < (row ? NI : NJ); n++) {
    const path = row ? trace(S, n, k) : trace(S, k, n);
    if (path) best = max(best, path.length);
  }
  return best;
}

// Put the running light on a loop: the given one, or a loop drawn at random
// weighted by length cubed, so the long winding loops come round far more
// often than the squares of 4 stitches.
function setLoop(S, path) {
  if (!path) {
    let total = 0;
    for (const p of S.loops) total += p.length ** 3;
    let r = Math.random() * total;
    for (const p of S.loops) if ((r -= p.length ** 3) <= 0) {
      path = p;
      break;
    }
  }
  S.cur = path || null;
  S.head = 0;
  S.laps = 0;
}

function rebuild(S, P) {
  S.pitch = P;
  S.geo = geometry(P);
  const n = S.geo.CW * S.geo.CH;
  S.col = new Uint8Array(n);
  S.when = new Float32Array(n).fill(-9);
  colour(S, S.col);
  S.show = S.col.slice();
  S.flash = [];
  S.recent = [];
  findLoops(S);
  setLoop(S, null);
}

// Flip one bit: every stitch on that line moves over by one, and every cell
// on one side of the line changes colour. The line is drawn at random,
// weighted towards lines whose flip closes a long loop. Which side changes
// colour is a choice (the other is the same picture with the colours
// swapped): take the bigger side, and let the change run out from the line.
function flip(S) {
  const { NI, NJ, CW, CH, P, OX, OY } = S.geo;
  const cand = [];
  let total = 0;
  for (let row = 0; row < 2; row++)
    for (let k = 0; k < (row ? NJ : NI); k++) {
      if (S.recent.some((r) => r[0] === row && r[1] === k)) continue;
      const bits = row ? S.a : S.b;
      bits[k] ^= 1;
      const L = longestThrough(S, row, k);
      bits[k] ^= 1;
      const w = L >= 12 ? (L / 4) ** 2 : 1;
      cand.push([row, k, w]);
      total += w;
    }
  let r = Math.random() * total, pick = cand[cand.length - 1];
  for (const c of cand) if ((r -= c[2]) <= 0) {
    pick = c;
    break;
  }
  const [row, k] = pick;
  (row ? S.a : S.b)[k] ^= 1;
  S.recent.push([row, k]);
  if (S.recent.length > 3) S.recent.shift();
  const old = S.col.slice();
  colour(S, S.col);
  let changed = 0;
  for (let c = 0; c < old.length; c++) changed += old[c] !== S.col[c] ? 1 : 0;
  if (changed * 2 < old.length) {
    S.swap ^= 1;
    colour(S, S.col);
  }
  const at = row ? OY + P * k : OX + P * k;
  for (let cj = 0; cj < CH; cj++)
    for (let ci = 0; ci < CW; ci++) {
      const c = cj * CW + ci;
      if (old[c] === S.col[c]) continue;
      const centre = row ? OY + P * (cj - 1) + P / 2 : OX + P * (ci - 1) + P / 2;
      S.when[c] = max(S.when[c], S.t + abs(centre - at) / WAVE);
    }
  S.flash.push([row, k, 1]);
  // The light stays on its loop if the flip left it whole; it moves to the
  // longest loop the flip closed if that one is longer.
  const kept = S.cur && !S.cur.some((u) => (row ? floor(u / NI) : u % NI) === k);
  findLoops(S);
  if (kept) {
    const u = S.cur[0];
    S.cur = S.loops[S.loopOf[(OY + P * floor(u / NI)) * W + OX + P * (u % NI)]];
  }
  let fresh = null;
  for (const p of S.loops) if (p.some((u) => (row ? floor(u / NI) : u % NI) === k)) {
    fresh = p;
    break;
  }
  if (fresh && fresh.length >= 12 && (!kept || fresh.length >= S.cur.length)) setLoop(S, fresh);
  else if (!kept) setLoop(S, null);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.loopsK = cl(k[3], 0, 1);
  const P = cl(round(k[2]), 6, 10);
  if (P !== S.pitch) rebuild(S, P);
  S.t += d;
  // Flips come at random, 1.34 a second per unit of Speed on average, never
  // closer than 0.28 seconds at Speed 1.
  S.nextFlip -= d * S.speed * 1.2;
  if (S.nextFlip <= 0) {
    flip(S);
    S.nextFlip = 0.33 - 0.67 * log(1 - Math.random() * 0.95);
  }
  for (let c = 0; c < S.show.length; c++) if (S.t >= S.when[c]) S.show[c] = S.col[c];
  for (const f of S.flash) f[2] -= d * 2.5;
  S.flash = S.flash.filter((f) => f[2] > 0);
  // The running light: 12 stitches a second per unit of Speed, two laps
  // round a short loop and one round a long one before it moves on.
  if (S.cur) {
    const L = S.cur.length;
    S.head += d * S.speed * 12;
    if (S.head >= L) {
      S.head -= L;
      if (++S.laps >= (L < 40 ? 2 : 1)) {
        const was = S.cur;
        setLoop(S, null);
        if (S.cur === was && S.loops.length > 1) setLoop(S, S.loops.find((p) => p !== was));
      }
    }
  }
}

function palette(S) {
  const hB = 0.47 + S.hue;
  const band = max(0, 1 - abs(hB - floor(hB) - 0.1) / 0.12);
  const hD = 0.66 + 0.06 * sin(TAU * S.hue);
  S.pal = {
    // The light cloth takes any hue; near orange its low threads are lifted
    // so they do not read brown.
    lightHi: hsv(hB, 0.45, WEAVE.lightHi),
    lightLo: hsv(hB, 0.85, WEAVE.lightLo + 0.2 * band),
    // The dark cloth keeps to indigo and violet: a dark warm cloth reads brown.
    darkHi: hsv(hD, 0.8, WEAVE.darkHi),
    darkLo: hsv(hD, 0.9, WEAVE.darkLo),
  };
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.geo) return;
  if (S.palHue !== S.hue) palette(S);
  const { P, NI, NJ, OX, OY, CW } = S.geo;
  const pal = S.pal;
  // K4 lights the closed loops gold, the biggest first. It also dims the
  // threads that run off the panel, down to a third at 1.
  const lit = round(S.loopsK * S.loops.length), open = 1 - 0.67 * S.loopsK;
  const cur = S.cur ? S.loops.indexOf(S.cur) : -1, Lc = S.cur ? S.cur.length : 1;
  const rowGlow = new Float32Array(NJ), colGlow = new Float32Array(NI);
  for (const [row, k, g] of S.flash) {
    if (row) rowGlow[k] = max(rowGlow[k], g);
    else colGlow[k] = max(colGlow[k], g);
  }
  for (let y = 0; y < H; y++) {
    const v = y - OY, j = floor(v / P), fy = v - j * P;
    for (let x = 0; x < W; x++) {
      const u = x - OX, i = floor(u / P), fx = u - i * P;
      const cell = (min(max(j, -1), NJ - 1) + 1) * CW + min(max(i, -1), NI - 1) + 1;
      // The cloth under this LED: the cell's colour in the weave.
      const up = ((x + y) & 1) === 0, m = S.show[cell];
      const c = m ? (up ? pal.lightHi : pal.lightLo) : up ? pal.darkHi : pal.darkLo;
      let r = c[0], g = c[1], b = c[2];
      let stitch = false, glow = 0, onLine = true;
      if (fx === 0 && fy === 0 && i >= 0 && i < NI && j >= 0 && j < NJ) stitch = true;
      else if (fy === 0 && j >= 0 && j < NJ) (stitch = hs(S, i, j)), (glow = rowGlow[j]);
      else if (fx === 0 && i >= 0 && i < NI) (stitch = vs(S, i, j)), (glow = colGlow[i]);
      else onLine = false;
      if (onLine) {
        if (stitch) {
          const n = S.loopOf[y * W + x];
          if (n >= 0 && n === cur) {
            // The running light: a head and a fading tail a third of the loop long.
            let dd = S.head - S.posOf[y * W + x];
            if (dd < 0) dd += Lc;
            const tail = max(0, 1 - dd / max(4, Lc / 3));
            r = GOLD[0] + (HEAD[0] - GOLD[0]) * tail;
            g = GOLD[1] + (HEAD[1] - GOLD[1]) * tail;
            b = GOLD[2] + (HEAD[2] - GOLD[2]) * tail;
          } else if (n >= 0 && n < lit) [r, g, b] = GOLD;
          else if (n >= 0) [r, g, b] = THREAD;
          else (r = THREAD[0] * open), (g = THREAD[1] * open), (b = THREAD[2] * open);
        } else if (glow > 0) {
          // A line that just flipped: its gaps flash with thread for a moment.
          r += (THREAD[0] - r) * glow * 0.8;
          g += (THREAD[1] - g) * glow * 0.8;
          b += (THREAD[2] - b) * glow * 0.8;
        }
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
}
