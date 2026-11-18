// ===== Patternflow pattern =====
// Title:   Scale2x Letters
// Family:  type
// Idea:    A 3 by 5 capital is doubled three times, to 6 by 10, 12 by 20 and 24 by 40, down the panel twice over, once by plain copying into blocks and once by the EPX and Scale2x pixel-art rule, which cuts the corners and fills the notches into 45 degree steps, with every pixel the rule changed shown in a second colour so you see where it cut.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: EPX, Eric's Pixel Expansion (Eric Johnston, LucasArts, 1992, year from memory) and Scale2x (Andrea Mazzoleni, 2001, year from memory), the four-line rule on a pixel's up, right, left and down neighbours; the 3 by 5 capitals and digits of Edit Distance (pattern round 110); pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..3, Word=0..5, Skip=0..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a letter is pale azure, the pixels the rule turned on are pink, the pixels it turned off are a dim pink ghost, and the plain copy on the left is the same azure at half the light.
// Knob 2: Speed. How fast a letter is built. At 2 the letter stands alone for 0.25 s, each of three passes takes 0.85 s (the plain copy sweeps in over 0.3 s, then the rule changes its pixels one after another over 0.4 s), the finished letter holds for 1.7 s and fades for 0.25 s, 4.75 s a letter. 0.4 is five times slower and 3 is half as fast again.
// Knob 3: Word. Which letters come one after another, caught at whole numbers: 0 SCALE2X, where it opens, 1 the alphabet A to Z, 2 PATTERNFLOW, 3 PAIK, 4 the digits 0 to 9, and 5 the seven capitals the rule changes most, B X R S Z K Q. The row of small letters at the bottom shows the list and where it has got to.
// Knob 4: Skip. How many of the last passes are left out, 0 to 2, caught at whole numbers. At 0 all three are shown and the stack runs down to 40 rows; at 1 it stops at 12 by 20; at 2 it stops at 6 by 10 and the lower half of the panel is empty.

const W = 64, H = 128;
const { floor, round, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const f = h - floor(h);
  if (f > 0.02 && f < 0.2) {
    v = min(1, 0.5 + 0.5 * v + 0.15);
    s *= 0.55;
  }
  hsv(h, s, v, out);
}

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both by way of edit-distance.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const BITS = {};
for (const ch of Object.keys(FACE)) BITS[ch] = Uint8Array.from(FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0)));

// The words, in the order of the knob.
const WORDS = ["SCALE2X", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "PATTERNFLOW", "PAIK", "0123456789", "BXRSZKQ"];

// One pass of the rule. P is a pixel, A the one above it, B on its right, C
// on its left and D below it; the pixel becomes four:
//   P1 (top left)  = A if C == A and C != D and A != B, else P
//   P2 (top right) = B if A == B and A != C and B != D, else P
//   P3 (bottom left)  = C if D == C and D != B and C != A, else P
//   P4 (bottom right) = D if B == D and B != A and D != C, else P
// A pixel off the edge of the bitmap is dark.
function epx(src, w, h) {
  const w2 = 2 * w, out = new Uint8Array(w2 * 2 * h);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      const o = 2 * y * w2 + 2 * x;
      out[o] = C === A && C !== D && A !== B ? A : P;
      out[o + 1] = A === B && A !== C && B !== D ? B : P;
      out[o + w2] = D === C && D !== B && C !== A ? C : P;
      out[o + w2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out;
}
// Each pixel copied into a 2 by 2 block.
function double(src, w, h) {
  const w2 = 2 * w, out = new Uint8Array(w2 * 2 * h);
  for (let y = 0; y < 2 * h; y++) for (let x = 0; x < w2; x++) out[y * w2 + x] = src[(y >> 1) * w + (x >> 1)];
  return out;
}

// Everything one letter needs: at each of the three levels the pixels the
// rule made (E), the plain copy of the level before it (N), the plain copy of
// the letter at this size (R) for the left column, and for each pixel whether
// the rule turned it on (1) or off (2) against the plain copy of the level
// before, with the pixels it changed in scan order.
const CACHE = {};
function build(ch) {
  if (CACHE[ch]) return CACHE[ch];
  const L = [];
  let e = BITS[ch], r = BITS[ch], w = 3, h = 5;
  for (let k = 1; k <= 3; k++) {
    const n = double(e, w, h), next = epx(e, w, h), rr = double(r, w, h);
    const m = new Uint8Array(next.length), rank = new Float32Array(next.length);
    let c = 0;
    for (let i = 0; i < next.length; i++) if (next[i] !== n[i]) c++;
    let q = 0;
    for (let i = 0; i < next.length; i++)
      if (next[i] !== n[i]) {
        m[i] = next[i] ? 1 : 2;
        rank[i] = q++ / max(1, c - 1);
      }
    w *= 2;
    h *= 2;
    L.push({ w, h, E: next, N: n, R: rr, M: m, rank, changed: c });
    e = next;
    r = rr;
  }
  return (CACHE[ch] = L);
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, word: -1, skip: -1, i: 0, t: 0, buf: new Float32Array(W * H * 3) };
}

// The clock of one letter, in seconds at speed 1.
const T0 = 0.5, WIPE = 0.6, FLIP = 0.8, PASS = 1.7, HOLD = 3.4, OUT = 0.5;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.4, 3);
  const word = cl(round(k[2]), 0, WORDS.length - 1), skip = cl(round(k[3]), 0, 2);
  if (word !== S.word || skip !== S.skip) {
    S.word = word;
    S.skip = skip;
    S.i = 0;
    S.t = 0;
  }
  S.passes = 3 - skip;
  S.total = T0 + S.passes * PASS + HOLD + OUT;
  S.t += d * S.speed;
  if (S.t >= S.total) {
    S.t -= S.total;
    S.i = (S.i + 1) % WORDS[word].length;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.word < 0) return;
  const buf = S.buf, word = WORDS[S.word], ch = word[S.i], G = build(ch), t = S.t;
  buf.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

  const hb = 0.55 + S.hue;
  const c1 = [0, 0, 0], c2 = [0, 0, 0], cg = [0, 0, 0], cw = [1, 1, 1];
  tint(hb, 0.35, 1, c1);
  tint(hb + 0.38, 0.8, 1, c2);
  tint(hb + 0.38, 0.8, 0.5, cg);

  // The whole letter fades in at the start and out at the end.
  const life = sm(t / 0.15) * (1 - sm((t - (S.total - OUT)) / OUT));

  // Where things stand: two columns, the plain copy and the rule, and the
  // levels down the panel, each under the one before.
  const CX = [17, 47], LY = [12, 24, 41, 68];

  // The source, 3 by 5, between the columns.
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (BITS[ch][y * 3 + x]) put(31 + x, LY[0] + y, c1, life);

  const chevron = (cx, y, col, a) => {
    for (let q = 0; q < 3; q++) {
      put(cx - 2 + q, y + q, col, a);
      put(cx + 2 - q, y + q, col, a);
    }
  };

  for (let k = 1; k <= S.passes; k++) {
    const lv = G[k - 1], w = lv.w, h = lv.h, ts = T0 + (k - 1) * PASS;
    const tp = t - ts;
    if (tp < 0) continue;
    const u = cl(tp / WIPE, 0, 1), tq = tp - WIPE - 0.1;
    const y0 = LY[k];
    // The arrows into this level light with the pass.
    const aw = life * (0.35 + 0.65 * (1 - sm((tp - 0.3) / 0.8)));
    chevron(CX[0], y0 - 6, c1, 0.4 * aw);
    chevron(CX[1], y0 - 6, c2, aw);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x, pos = (x / w + y / h) / 2;
        const a = cl((u * 1.15 - pos) / 0.15, 0, 1);
        if (a <= 0) continue;
        const front = 1 - a * 0.7;
        // The plain copy, on the left.
        if (lv.R[i]) put(CX[0] - w / 2 + x, y0 + y, mix(c1, cw, front * 0.5), 0.65 * a * life);
        // The rule, on the right: the copy of the last level comes in, then the changed pixels turn.
        const m = lv.M[i], loc = m ? cl((tq - lv.rank[i] * (FLIP - 0.35)) / 0.35, 0, 1) : 0;
        if (m === 0) {
          if (lv.E[i]) put(CX[1] - w / 2 + x, y0 + y, mix(c1, cw, front * 0.5), a * life);
        } else if (m === 1) {
          if (loc > 0) put(CX[1] - w / 2 + x, y0 + y, mix(cw, c2, sm(loc * 1.3)), loc * life);
        } else {
          // the rule took this pixel away: azure at first, then a ghost
          put(CX[1] - w / 2 + x, y0 + y, mix(mix(c1, cw, front * 0.5), cg, sm(loc * 1.3)), a * life);
        }
      }
  }

  // The headers.
  const text = (str, cx, y, col, a) => {
    const w = str.length * 4 - 1;
    for (let q = 0; q < str.length; q++) {
      const b = BITS[str[q]];
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (b[yy * 3 + xx]) put(floor(cx - w / 2) + q * 4 + xx, y + yy, col, a);
    }
  };
  text("NN", CX[0], 3, c1, 0.5);
  text("EPX", CX[1], 3, c2, 0.9);

  // The list, small, at the bottom: the one on show is lit.
  {
    const n = word.length, per = n > 15 ? 13 : n;
    for (let q = 0; q < n; q++) {
      const row = floor(q / per), col = q % per, rowN = min(per, n - row * per);
      const x = floor((W - (rowN * 4 - 1)) / 2) + col * 4, y = 114 + 7 * row, on = q === S.i;
      const b = BITS[word[q]];
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (b[yy * 3 + xx]) put(x + xx, y + yy, on ? c2 : c1, on ? 1 : 0.28);
      if (on) for (let xx = 0; xx < 3; xx++) put(x + xx, y + 6, c2, 0.7);
    }
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
