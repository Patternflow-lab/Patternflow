// ===== Patternflow pattern =====
// Title:   Rivers of White
// Family:  type
// Idea:    The opening paragraph of A Tale of Two Cities is set justified in a 3 by 5 pixel face down the whole panel, and wherever the stretched word spaces of successive lines line up into rivers of white the paragraph lights them, so the typesetter's flaw glows and meanders while the column narrows and widens and the rivers break and re-form.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 64, after the rivers of white that justified type has always made, with total-fit line breaking (Donald Knuth and Michael Plass, 1981), setting Charles Dickens's A Tale of Two Cities (1859)
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fit=0..1, Space=0..1
//
// Knob 1: Hue. The colour of the light in the rivers: ice blue at 0, violet at 0.25, peach at 0.5, green at 0.75 and ice blue again at 1; the type stays warm.
// Knob 2: Speed. How fast the column breathes between 64 and 54 LEDs wide and the light runs down the rivers: at 2 one breath takes 10 s, at 0.2 it takes 100 s.
// Knob 3: Fit. How the lines are broken: at 0 greedily, as many words as fit on each line in turn, the way a word processor does; from 0.02 to 0.15 by Knuth and Plass's total fit, the breaks that make the whole paragraph's spacing least bad; and turned further each column a word space shares with the space on the line above costs more, until at 1 the breaks steer the spaces apart and the rivers mostly dry up.
// Knob 4: Space. The natural word space: 3 LEDs at the opening, 4, 5 and 6 as it turns. Wider spaces line up more easily, and at 6 the rivers braid through the whole page.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The 3 by 5 face, rows top to bottom; punctuation is one LED wide.
const GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "-": "000000111000000",
  ".": "00001", ",": "00011", ";": "01011", ":": "01010", "'": "11000", "!": "11101",
};

// Charles Dickens, A Tale of Two Cities (1859), the first paragraph. The dash
// before IN SHORT is set close, as the book sets it.
const TEXT =
  "IT WAS THE BEST OF TIMES, IT WAS THE WORST OF TIMES, IT WAS THE AGE OF WISDOM, IT WAS THE AGE OF FOOLISHNESS, " +
  "IT WAS THE EPOCH OF BELIEF, IT WAS THE EPOCH OF INCREDULITY, IT WAS THE SEASON OF LIGHT, IT WAS THE SEASON OF DARKNESS, " +
  "IT WAS THE SPRING OF HOPE, IT WAS THE WINTER OF DESPAIR, WE HAD EVERYTHING BEFORE US, WE HAD NOTHING BEFORE US, " +
  "WE WERE ALL GOING DIRECT TO HEAVEN, WE WERE ALL GOING DIRECT THE OTHER WAY-IN SHORT, THE PERIOD WAS SO FAR LIKE " +
  "THE PRESENT PERIOD, THAT SOME OF ITS NOISIEST AUTHORITIES INSISTED ON ITS BEING RECEIVED, FOR GOOD OR FOR EVIL, " +
  "IN THE SUPERLATIVE DEGREE OF COMPARISON ONLY.";

// A line is 5 rows of type and 1 of leading; 21 lines fill rows 1 to 126.
const LH = 6, TOP = 1, LINES = 21;
// The narrowest column still holds FOOLISHNESS, and INCREDULITY, at 45 LEDs.
const MIN_M = 46;

// Each word as a list of column masks, one bit per row, with a blank column
// between letters.
function shapeWords() {
  return TEXT.split(" ").map((w) => {
    const cols = [];
    for (const ch of w) {
      const g = GLYPHS[ch];
      const gw = g.length / 5;
      if (cols.length) cols.push(0);
      for (let i = 0; i < gw; i++) {
        let m = 0;
        for (let j = 0; j < 5; j++) if (g[j * gw + i] === "1") m |= 1 << j;
        cols.push(m);
      }
    }
    return cols;
  });
}

export function setup(params) {
  const P = params;
  P.words = shapeWords();
  P.wl = P.words.map((c) => c.length);
  P.n = P.words.length;
  P.cache = new Map();
  P.phase = 0;
  P.flow = 0;
  P.key = "";
  P.ink = new Uint8Array(N); // type
  P.target = new Float32Array(N); // river light wanted now
  P.light = new Float32Array(N); // river light shown, easing toward it
  P.halo = new Float32Array(N);
  P.tmp = new Float32Array(N);
  P.started = false;
}

// ---- Line breaking -------------------------------------------------------

// A line of words a..b-1 at measure M with natural space S: its words' width,
// gap count and slack against natural spacing; null if it cannot fit even at
// the tightest space S - 1 (a single word always fits, overhanging if it must).
function lineOf(P, a, b, M, S) {
  let w = 0;
  for (let i = a; i < b; i++) w += P.wl[i];
  const g = b - a - 1;
  if (g > 0 && w + (S - 1) * g > M) return null;
  return { w, g, slack: M - w - S * g };
}

// How bad a line is: the square of how far each space is stretched or shrunk
// from natural, in LEDs; shrinking counts eight times; a lone word on a
// justified line pays a great deal; the last line is set ragged and is free.
function badness(L, last) {
  if (last) return L.slack >= 0 ? 0 : 1e6;
  if (L.g === 0) return 60 + L.slack * L.slack;
  const r = L.slack / L.g;
  return r >= 0 ? r * r : 8 * r * r;
}

// The word spaces of a justified line as inclusive column ranges, the stretch
// spread from left to right as evenly as whole LEDs allow.
function gapsOf(P, a, b, M, S, x0, last) {
  const L = lineOf(P, a, b, M, S) || { w: 0, g: b - a - 1, slack: 0 };
  const out = [];
  const extra = last || L.g === 0 ? 0 : L.slack;
  let x = x0;
  for (let i = a, k = 0; i < b - 1; i++, k++) {
    x += P.wl[i];
    const s = S + floor((extra * (k + 1)) / L.g) - floor((extra * k) / L.g);
    out.push(x, x + s - 1);
    x += s;
  }
  return out;
}

// Columns shared between the spaces of two lines.
function overlap(A, B) {
  let s = 0;
  for (let i = 0; i < A.length; i += 2)
    for (let j = 0; j < B.length; j += 2) {
      const o = min(A[i + 1], B[j + 1]) - max(A[i], B[j]) + 1;
      if (o > 0) s += o;
    }
  return s;
}

// Greedy: as many words as fit at natural spacing, line after line.
function greedy(P, M, S) {
  const br = [0];
  for (let a = 0; a < P.n; ) {
    let b = a + 1;
    while (b < P.n) {
      const L = lineOf(P, a, b + 1, M, S);
      if (!L || L.slack < 0) break;
      b++;
    }
    br.push(b);
    a = b;
  }
  return br;
}

// Total fit with a river toll: the breaks of least total badness, plus mu for
// every column a line's spaces share with the spaces of the line above. The
// toll needs the line above, so a state is the pair (start of the line above,
// start of this line); with mu = 0 it is Knuth and Plass's total fit.
function totalFit(P, M, S, mu, x0) {
  const n = P.n;
  const ends = [];
  for (let a = 0; a < n; a++) {
    const l = [];
    for (let b = a + 1; b <= n; b++) {
      if (!lineOf(P, a, b, M, S)) break;
      l.push(b);
    }
    ends.push(l);
  }
  const gaps = new Map();
  const gp = (a, b) => {
    const k = a * 512 + b;
    let v = gaps.get(k);
    if (!v) gaps.set(k, (v = gapsOf(P, a, b, M, S, x0, b === n)));
    return v;
  };
  // cost[a] maps the start of the line above to the best cost of setting
  // words 0..a-1 with that line last.
  const cost = [], back = [];
  for (let a = 0; a <= n; a++) {
    cost.push(new Map());
    back.push(new Map());
  }
  cost[0].set(-1, 0);
  for (let a = 0; a < n; a++) {
    for (const [p, c0] of cost[a]) {
      const above = p >= 0 ? gp(p, a) : null;
      for (const b of ends[a]) {
        const L = lineOf(P, a, b, M, S);
        let c = c0 + badness(L, b === n);
        if (above && mu > 0) c += mu * overlap(above, gp(a, b));
        const was = cost[b].get(a);
        if (was === undefined || c < was) {
          cost[b].set(a, c);
          back[b].set(a, p);
        }
      }
    }
  }
  let best = Infinity, last = -1;
  for (const [p, c] of cost[n]) if (c < best) (best = c), (last = p);
  const br = [n];
  for (let b = n, a = last; a >= 0; ) {
    br.push(a);
    const p = back[b].get(a);
    b = a;
    a = p;
  }
  return br.reverse();
}

// The page for a measure: every visible line's words as [x, word] pairs and
// its spaces, cached because the column passes the same widths again.
function layout(P, M) {
  const key = M + "/" + P.S + "/" + P.mu.toFixed(3);
  let L = P.cache.get(key);
  if (L) return L;
  const x0 = floor((W - M) / 2);
  const br = P.mu < 0 ? greedy(P, M, P.S) : totalFit(P, M, P.S, P.mu, x0);
  const lines = [];
  for (let i = 0; i + 1 < br.length && i < LINES; i++) {
    const a = br[i], b = br[i + 1], last = b === P.n;
    const gaps = gapsOf(P, a, b, M, P.S, x0, last);
    const xs = [x0];
    for (let k = 0; k < gaps.length; k += 2) xs.push(gaps[k + 1] + 1);
    lines.push({ a, b, xs, gaps });
  }
  // Rivers: a space joins a space on the next line when they share a column;
  // each space carries the most lines any chain through it spans.
  const down = lines.map((l) => new Array(l.gaps.length / 2).fill(1));
  const up = lines.map((l) => new Array(l.gaps.length / 2).fill(1));
  const touch = (A, i, B, j) => max(A[i], B[j]) <= min(A[i + 1], B[j + 1]);
  for (let i = lines.length - 2; i >= 0; i--)
    for (let k = 0; k < down[i].length; k++)
      for (let m = 0; m < down[i + 1].length; m++)
        if (touch(lines[i].gaps, 2 * k, lines[i + 1].gaps, 2 * m)) down[i][k] = max(down[i][k], 1 + down[i + 1][m]);
  for (let i = 1; i < lines.length; i++)
    for (let k = 0; k < up[i].length; k++)
      for (let m = 0; m < up[i - 1].length; m++)
        if (touch(lines[i].gaps, 2 * k, lines[i - 1].gaps, 2 * m)) up[i][k] = max(up[i][k], 1 + up[i - 1][m]);
  for (let i = 0; i < lines.length; i++) lines[i].run = down[i].map((d, k) => d + up[i][k] - 1);
  L = { lines, x0, M };
  if (P.cache.size > 400) P.cache.clear();
  P.cache.set(key, L);
  return L;
}

// How brightly a space glows for the lines its river spans: two lines are a
// coincidence, three a river, six a flood.
const glowOf = (run) => (run < 2 ? 0 : run === 2 ? 0.16 : min(1, 0.4 + 0.15 * (run - 3)));

function paint(P, L) {
  const { ink, target } = P;
  ink.fill(0);
  target.fill(0);
  L.lines.forEach((ln, i) => {
    const y0 = TOP + i * LH;
    // Type.
    for (let k = ln.a; k < ln.b; k++) {
      const cols = P.words[k], x = ln.xs[k - ln.a];
      for (let c = 0; c < cols.length; c++) {
        const X = x + c;
        if (X < 0 || X >= W || !cols[c]) continue;
        for (let j = 0; j < 5; j++) if (cols[c] & (1 << j)) ink[(y0 + j) * W + X] = 1;
      }
    }
    // The spaces of rivers: a space is lit dimly across its width and fully in
    // the columns it shares with the spaces above and below, the channel the
    // river runs down; the leading is lit where it steps to the next line.
    const prev = L.lines[i - 1], next = L.lines[i + 1];
    for (let k = 0; k < ln.run.length; k++) {
      const v = glowOf(ln.run[k]);
      if (!v) continue;
      const g0 = ln.gaps[2 * k], g1 = ln.gaps[2 * k + 1];
      for (let y = y0; y < y0 + 5; y++) for (let x = g0; x <= g1; x++) target[y * W + x] = max(target[y * W + x], 0.28 * v);
      for (const [nb, dy] of [[prev, -1], [next, 5]]) {
        if (!nb) continue;
        for (let m = 0; m < nb.run.length; m++) {
          const a = max(g0, nb.gaps[2 * m]), b = min(g1, nb.gaps[2 * m + 1]);
          if (a > b) continue;
          const w = min(v, glowOf(nb.run[m]));
          for (let x = a; x <= b; x++) {
            for (let y = y0; y < y0 + 5; y++) target[y * W + x] = max(target[y * W + x], w);
            if (dy > 0) target[(y0 + dy) * W + x] = max(target[(y0 + dy) * W + x], w);
          }
        }
      }
    }
  });
}

export function update(dt, input, params) {
  const P = params;
  if (!P.words) setup(P);
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.hue = k[0] || 0;
  P.speed = cl(k[1], 0.2, 3);
  const fit = cl(k[2], 0, 1);
  // Greedy at the very bottom, plain total fit up to 0.15, then the river toll
  // rises to 100 per shared column at 1.
  P.mu = fit < 0.02 ? -1 : fit <= 0.15 ? 0 : 100 * ((fit - 0.15) / 0.85) ** 2;
  P.S = cl(round(3 + 3 * cl(k[3], 0, 1)), 3, 6);
  // The column breathes from full width down to 54 LEDs and back; the
  // opening frame is 1.4 radians into a breath (2.2 s at Speed 2), already
  // drawing in.
  P.phase += (dt * 2 * PI * P.speed) / 20;
  const breath = (1 - cos(P.phase + 1.4)) / 2;
  const M = max(MIN_M, round(64 - 10 * breath));
  P.flow += dt * P.speed * 0.3;
  const L = layout(P, M);
  const key = L.M + "/" + P.S + "/" + P.mu;
  if (key !== P.key) {
    P.key = key;
    P.page = L;
    paint(P, L);
  }
  // River light eases in and out over a fifth of a second as rivers form and break.
  const e = P.started ? 1 - exp(-dt / 0.2) : 1;
  P.started = true;
  const { light, target, halo, tmp } = P;
  for (let p = 0; p < N; p++) light[p] += (target[p] - light[p]) * e;
  // The halo: the light spread two LEDs each way, across then down.
  for (let y = 0; y < H; y++) {
    let s = 0;
    const r = y * W;
    for (let x = -2; x < W; x++) {
      if (x + 2 < W) s += light[r + x + 2];
      if (x - 3 >= 0) s -= light[r + x - 3];
      if (x >= 0) tmp[r + x] = s / 5;
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -2; y < H; y++) {
      if (y + 2 < H) s += tmp[(y + 2) * W + x];
      if (y - 3 >= 0) s -= tmp[(y - 3) * W + x];
      if (y >= 0) halo[y * W + x] = s / 5;
    }
  }
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function draw(display, params) {
  const P = params;
  if (!P.page) return;
  const c = [0, 0, 0];
  // Ice blue at Hue 0, pale enough to read as white light.
  hsv(P.hue + 0.56, 0.56, 1, c);
  const [rr, rg, rb] = c;
  const { ink, light, halo } = P;
  const ft = P.flow;
  for (let y = 0, p = 0; y < H; y++) {
    // Light runs down the rivers in slow swells.
    const wave = 0.74 + 0.26 * sin(2 * PI * (y / 30 - ft));
    for (let x = 0; x < W; x++, p++) {
      const h = halo[p];
      if (ink[p]) {
        // The type, warm parchment, catching a little of the river light.
        const g = 0.7 * h;
        display.setPixel(x, y, round(min(255, 178 + 80 * g * rr)), round(min(255, 136 + 80 * g * rg)), round(min(255, 84 + 80 * g * rb)));
      } else {
        const v = light[p] * wave * 0.92 + h * 0.24;
        display.setPixel(x, y, round(min(255, 255 * v * rr)), round(min(255, 255 * v * rg)), round(min(255, 255 * v * rb)));
      }
    }
  }
}
