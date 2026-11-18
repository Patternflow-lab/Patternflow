// ===== Patternflow pattern =====
// Title:   Gijswijt's Sequence
// Family:  rhythm
// Idea:    The first 8192 terms of Gijswijt's sequence are written down the panel one LED each in four colours, nine terms slowly under a lens that brackets the blocks that decide the next one, then the rest in a rush, and afterwards the head comes back to stop on a 3 or a 4 and open the lens on how it was decided.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gijswijt's sequence (Dion Gijswijt, 2004; OEIS A090822), 3 x 5 digits from Collatz Tree, pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Block=10..64, Palette=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a 1 is dark azure, a 2 yellow, a 3 violet and a 4 white; at 0.5 a 1 is dark orange, a 2 blue, a 3 green and a 4 white.
// Knob 2: Speed. How fast the whole run goes, the clock running at Speed over 2. At 2 the ninth term lands at 1 s, the rush down the panel starts at 1.35 s and has filled it by 2.9 s, and a replay lasts 3.7 s for a 3 and 4.15 s for a 4; at 3 all of it is 1.5 times as fast, at 0.5 four times slower.
// Knob 3: Block. How many terms each row starts after the row above, 10 to 64, whole terms only. Row y shows the 64 terms from y times Block on, so each term stands in up to 7 LEDs. At 10 the panel is the first 1334 terms in slanting bands, because the early sequence repeats itself every 9 or 10 terms; at 19 the bands close into cells; at 64 a row starts where the one above ends and the panel is the first 8192 terms, one LED each. The layout turns at 90 steps a second when the knob moves.
// Knob 4: Palette. How far the hue of a 2 lies behind that of a 1 on the wheel, 0.39 at 0 and 0.22 at 1, and a 3 lies twice as far: at 0.06 the 1, 2 and 3 are azure, yellow and violet, at 0.5 azure, yellow-green and pink-red, at 1 azure, green and orange.
// Buttons: K1 tap clears the panel and writes it again from the first term.

const W = 64, H = 128, NP = W * H, NT = 8192;
const { floor, ceil, min, max, abs, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// a(1) = 1, and a(n+1) is the largest k for which the sequence so far ends in
// some block repeated k times in a row, taken over every block length m.
// The panel holds term t, counted from 0, at row t / 64, column t mod 64.
// First terms: 1 1 2 1 1 2 2 2 3 1 1 2 1 1 2 2 2 3 2 1 1 2 ...
// Counted by this code and checked against the definition by brute force: the
// first 3 is term 9, the first 4 is term 220 and the 4s come every 220 to 238
// terms after it, and in the first 8192 terms there are 2368 1s, 4337
// 2s, 1451 3s and 36 4s. The first 5 is far beyond any panel.
const V0 = [0.3, 0.86, 0.45, 1], S0 = [0.9, 0.85, 0.75, 0.1];
// Every other LED in a checker is 34% brighter and the rest 34% dimmer. The mean
// stays, and two neighbours that hold the same term differ by 0.68 of it.
const GRAIN = 0.34, RMAX = 9500, TOP = 1.35, LENS = 20;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // r[m] counts the terms in a row, up to the newest, that equal the term m
  // before them: a block of m repeated k times has run m (k - 1) long.
  const A = new Uint8Array(NT), M = new Uint16Array(NT), r = new Int32Array(NT + 1);
  A[0] = 1;
  M[0] = 1;
  for (let n = 1; n < NT; n++) {
    const L = n - 1, v = A[L];
    let best = 1, bm = 1;
    for (let m = 1; m <= L; m++) {
      if (v === A[L - m]) r[m]++;
      else r[m] = 0;
      const k = 1 + ((r[m] / m) | 0);
      if (k > best) (best = k), (bm = m);
    }
    A[n] = best;
    M[n] = bm;
  }
  // Terms worth stopping at: a 3 or a 4 whose blocks fit in the twelve terms
  // the lens shows.
  const threes = [], fours = [];
  for (let n = 8; n < NT; n++) {
    if (A[n] === 4) fours.push(n);
    else if (A[n] === 3 && 3 * M[n] <= 12) threes.push(n);
  }
  params.s = {
    A, M, threes, fours, R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    pal: new Float32Array(12), lp: new Float32Array(12), u: 0, Wr: 0, F: 0, mode: 0, h: 0, tgt: 0, p: 0, D: 3.5, lo: 0, flip: 0, seed: 20241107,
    w: 10, wT: 10, hue: 0, pl: 0.06, sp: 2, init: false, prev: false, yL: 104, ln: 0, prog: 9, pop: 1, rows: 0,
  };
}

// 3 x 5 digits, from Collatz Tree.
const DIGITS = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((s) => {
  const rows = s.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === "#") m.push(x, y);
  return m;
});

const rnd = (S) => ((S.seed = (S.seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// The next term to stop at, after term h: a 4 after a 3, and a 3 about 110
// terms on after a 4. Which 4 is a draw among the next three, so the head
// sometimes runs on for 600 terms. A target past the last visible term sends
// the head back to the first.
function pick(S) {
  const cap = (H - 1) * S.w + W - 1, f = S.fours, t3 = S.threes;
  let t = -1;
  if (S.flip === 0) {
    let i = 0;
    while (i < f.length && f[i] <= S.h + 20) i++;
    i += S.first ? 0 : floor(rnd(S) * 3);
    t = i < f.length ? f[i] : -1;
    S.flip = 1;
  } else {
    let i = 0;
    while (i < t3.length && t3[i] < S.h + 110) i++;
    t = i < t3.length ? t3[i] : -1;
    S.flip = 0;
  }
  if (t < 0 || t > cap) {
    t = S.fours[0];
    S.h = 0;
    S.flip = 1;
  }
  S.tgt = t;
  S.first = false;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const bp = !!(input.btnPressed && input.btnPressed[0]);
  if (bp && !S.prev) {
    S.u = 0; S.Wr = 0; S.F = 0; S.mode = 0; S.h = 0; S.lo = 0; S.flip = 0; S.first = true;
  }
  S.prev = bp;
  const e = S.init ? 1 - exp(-d / 0.12) : 1;
  S.hue += (cl(k[0], 0, 1) - S.hue) * e;
  S.pl += (cl(k[3], 0, 1) - S.pl) * e;
  S.sp = cl(k[1], 0.5, 3);
  S.wT = round(cl(k[2], 10, 64));
  if (!S.init) S.w = S.wT;
  else if (S.w !== S.wT) {
    const st = max(1, round(d * 90));
    S.w += S.wT > S.w ? min(st, S.wT - S.w) : -min(st, S.w - S.wT);
  }
  // A target the rows no longer reach sends the head back to the first 4.
  if (S.mode > 0 && S.tgt > (H - 1) * S.w + W - 1) {
    S.mode = 1; S.h = 0; S.lo = 0; S.flip = 0; S.first = true;
    pick(S);
  }
  const du = d * (S.sp / 2);
  S.u += du;
  const u = S.u;

  if (S.mode === 0) {
    // Nine terms one by one, the ninth being the first 3, then a growth by e
    // every 0.125 s that the rate cap bends into a straight run down the panel.
    // The run is a share F of the visible terms, so it takes as long at any
    // Block.
    const cap = min(NT, (H - 1) * S.w + W);
    if (u < TOP) {
      S.Wr = cl(floor((u - 0.12) / 0.105) + 1, 0, 9);
      S.rows = 0;
    } else {
      const rate = min(RMAX, 10.75 * exp(8 * (u - TOP)));
      S.F = min(1, S.F + (rate * du) / (NT - 9));
      S.Wr = 9 + S.F * (cap - 9);
      S.rows = (rate * (S.sp / 2) * (cap - 9)) / (NT - 9) / S.w;
    }
    S.h = max(0, S.Wr - 1);
    // The lens that shows the first terms comes up and goes before the rush.
    S.lo = ease(u / 0.3) * (1 - ease((u - 1.45) / 0.4));
    S.ln = max(0, floor(S.Wr) - 1);
    S.prog = 9;
    S.pop = 1;
    S.yL = 104;
    if (S.F >= 1) {
      S.Wr = NT;
      S.mode = 1;
      S.h = 0;
      S.flip = 0;
      S.first = true;
      S.lo = 0;
      pick(S);
    }
  } else if (S.mode === 1) {
    const dist = (S.tgt - S.h) / S.w, v = cl(dist * 3.2, 1.4, 22);
    S.rows = v;
    S.h = min(S.tgt, S.h + v * S.w * du);
    S.lo = max(0, S.lo - du * 3);
    if (S.h >= S.tgt) {
      S.mode = 2;
      S.p = 0;
      S.ln = S.tgt;
      S.D = 2.35 + 0.45 * S.A[S.tgt];
      const ty = floor(S.tgt / S.w);
      S.yL = ty < 64 ? 100 : 8;
      S.rows = 0;
    }
  } else {
    S.p += du;
    const D = S.D, p = S.p, kk = S.A[S.ln];
    S.lo = ease(p / 0.5) * (1 - ease((p - (D - 0.5)) / 0.5));
    S.prog = (p - 0.7) / 0.45 + 1;
    S.pop = ease((p - (0.7 + 0.45 * kk)) / 0.25);
    if (p >= D) {
      S.mode = 1;
      S.lo = 0;
      pick(S);
    }
  }
  S.init = true;
}

const put = (S, x, y, r, g, b, a) => {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = y * W + x, q = a > 1 ? 1 : a;
  S.R[o] += (r - S.R[o]) * q; S.G[o] += (g - S.G[o]) * q; S.B[o] += (b - S.B[o]) * q;
};

function line(S, x0, y0, x1, y1, a, ymin, ymax) {
  const n = max(abs(x1 - x0), abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = round(x0 + ((x1 - x0) * i) / n), y = round(y0 + ((y1 - y0) * i) / n);
    if (y >= ymin && y < ymax) continue;
    put(S, x, y, 1, 1, 1, a);
  }
}

function digits(S, num, x, y, r, g, b, a) {
  const s = String(num);
  for (let c = 0; c < s.length; c++) {
    const m = DIGITS[s.charCodeAt(c) - 48];
    for (let i = 0; i < m.length; i += 2) put(S, x + 4 * c + m[i], y + m[i + 1], r, g, b, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, A, M, pal, lp } = S, w = S.w, Wf = floor(S.Wr);
  // Colours: a 1 is a dark azure, a 2 yellow, a 3 a violet between them, a 4
  // white. The 2s are over half of the terms, so a 1 or a 3 beside one is a
  // step of 0.4 to 0.56. The lens shows the same colours lifted to 0.42 so
  // that the dark 1 reads there.
  const h1 = S.hue + 0.55, step = -0.39 + 0.17 * S.pl;
  // A 3 that lands in orange or yellow would go brown or olive, so it is lifted
  // to 0.75.
  for (let v = 0; v < 4; v++) {
    const h = v < 3 ? h1 + step * v : h1 + 0.02, hw = h - round(h);
    const warm = cl((0.22 - hw) / 0.06, 0, 1) * cl((hw + 0.05) / 0.05, 0, 1);
    hsv(h, S0[v], V0[v] + (v === 2 ? max(V0[v], 0.75) - V0[v] : 0) * warm, pal, 3 * v);
    const q = max(1, 0.42 / max(pal[3 * v], pal[3 * v + 1], pal[3 * v + 2]));
    for (let c = 0; c < 3; c++) lp[3 * v + c] = min(1, pal[3 * v + c] * q);
  }

  const mode = S.mode, lo = S.lo;
  const tgt = mode === 2 ? S.tgt : -1, km = mode === 2 ? A[tgt] * M[tgt] : 0, mm = mode === 2 ? M[tgt] : 1;
  const dim = 1 - 0.1 * lo;
  const hh = S.h, tail = 2 + S.rows * w * 0.018;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * w + x, o = y * W + x;
      if (idx >= Wf) { R[o] = G[o] = B[o] = 0; continue; }
      const c = 3 * (A[idx] - 1);
      const f = dim * (1 + GRAIN * ((x + y) & 1 ? 1 : -1));
      let g = 0;
      // The cells of the blocks that decide the term glow white, the nearest block most.
      if (tgt >= 0) {
        const rel = tgt - idx;
        if (rel > 0 && rel <= km) {
          const j = ceil(rel / mm);
          g = (j & 1 ? 0.34 : 0.2) * cl(S.prog - (j - 1), 0, 1) * lo;
        }
      }
      if (idx <= hh && mode !== 2) g = exp(-(hh - idx) / tail);
      else if (idx === tgt) g = 0.8 * lo;
      R[o] = min(1, pal[c] * f + g); G[o] = min(1, pal[c + 1] * f + g); B[o] = min(1, pal[c + 2] * f + g);
    }
  }

  if (lo > 0.01 && S.ln >= 0 && (mode === 2 || Wf > 0)) {
    const n = S.ln, kk = A[n], m = M[n], yL = S.yL, fy0 = yL - 1, fy1 = yL + LENS;
    // The target: a ring round its LED and a line to the lens.
    if (mode === 2) {
      const ty = floor(n / w), tx = n - ty * w, pulse = 0.65 + 0.35 * Math.sin(S.p * 9);
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) if (i || j) put(S, tx + i, ty + j, 1, 1, 1, lo * pulse);
      line(S, tx, ty < 64 ? ty + 2 : ty - 2, 55, ty < 64 ? yL : yL + LENS - 1, 0.5 * lo, fy0, fy1 + 1);
    }
    // The glass: what lies under it is dimmed, and its two edges drawn.
    const fr = 1 - 0.85 * lo;
    for (let y = yL; y < yL + LENS; y++)
      for (let x = 0; x < W; x++) { const o = y * W + x; R[o] *= fr; G[o] *= fr; B[o] *= fr; }
    for (let x = 0; x < W; x++) { put(S, x, yL, 1, 1, 1, 0.5 * lo); put(S, x, yL + LENS - 1, 1, 1, 1, 0.5 * lo); }
    // The last twelve terms, 3 LEDs wide and 7 tall, with the blocks bracketed.
    const inBlock = (i) => {
      const rel = 12 - i;
      return kk > 1 && kk * m <= 12 && rel <= kk * m ? ceil(rel / m) : 0;
    };
    for (let i = 0; i < 12; i++) {
      const idx = n - 12 + i;
      if (idx < 0) continue;
      const c = 3 * (A[idx] - 1), j = inBlock(i), on = j && S.prog >= j - 0.3 ? 1 : 0.72;
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 3; x++) put(S, 2 + 4 * i + x, yL + 6 + y, lp[c], lp[c + 1], lp[c + 2], lo * on);
    }
    if (kk > 1 && kk * m <= 12) {
      for (let j = 1; j <= kk; j++) {
        const vis = cl(S.prog - (j - 1) + 0.3, 0, 1) * lo;
        if (vis <= 0) continue;
        const i0 = 12 - j * m, i1 = 12 - (j - 1) * m - 1, x0 = 2 + 4 * i0, x1 = 2 + 4 * i1 + 2, br = j & 1 ? 1 : 0.7;
        for (let x = x0; x <= x1; x++) put(S, x, yL + 3, br, br, br, vis);
        put(S, x0, yL + 4, br, br, br, vis);
        put(S, x1, yL + 4, br, br, br, vis);
        if (j === kk) digits(S, m, floor((x0 + 2 + 4 * i1 + 2) / 2 - (String(m).length * 4 - 1) / 2), yL + 14, 1, 1, 1, vis * 0.9);
      }
    }
    // The decision: an arrow, the new term as a tall block, and its value.
    const pop = S.pop * lo, c = 3 * (kk - 1), wh = kk === 4 ? 0 : 1;
    if (pop > 0.01) {
      for (let x = 49; x <= 52; x++) put(S, x, yL + 9, 1, 1, 1, pop * 0.8);
      for (let q = 1; q <= 2; q++) {
        put(S, 52 - q, yL + 9 - q, 1, 1, 1, pop * 0.8);
        put(S, 52 - q, yL + 9 + q, 1, 1, 1, pop * 0.8);
      }
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 4; x++) put(S, 53 + x, yL + 5 + y, lp[c], lp[c + 1], lp[c + 2], pop);
      digits(S, kk, 59, yL + 7, wh, wh, wh, pop);
    }
  }
  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, R[q] * 255, G[q] * 255, B[q] * 255);
}
