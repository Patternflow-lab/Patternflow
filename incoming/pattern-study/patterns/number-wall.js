// ===== Patternflow pattern =====
// Title:   Number Wall
// Family:  fractal
// Idea:    Every cell of the number wall of a binary sequence is the determinant, over the field of two elements, of the square Toeplitz matrix of that size cut from the sequence at that place, and the zeros gather into black square windows of every size, ringed in colour, that slide down the panel as the view moves along the sequence.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: number wall (John Conway and Richard Guy, The Book of Numbers, 1996; Fred Lunnon, 2001), built with the Berlekamp-Massey algorithm (Elwyn Berlekamp, 1968; James Massey, 1969) from the Thue-Morse sequence (Axel Thue, 1906; Marston Morse, 1921), the regular paperfolding sequence, the Rudin-Shapiro sequence (Harold Shapiro, 1951; Walter Rudin, 1959), the Fibonacci word, the Motzkin numbers (Theodore Motzkin, 1948) and the primes, pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sequence=0..5, Depth=0..96
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ones, which make the wall between the windows, are a pale blue-grey, and a window takes its colour from its side d: blue-black at 1, indigo at 2, violet at 3 and 6, magenta at 14, pink at 30 and crimson from 62 up. A hue that would leave a window a dim orange or yellow goes to crimson or green, which read as themselves at that brightness.
// Knob 2: Speed. How fast the view slides along the sequence, 1.6 columns a second for every unit, so 3.2 at the opening 2: a window 6 wide takes 1.9 s to pass a fixed column, and the 768 columns the view can travel take 4 minutes before it turns back (0.32 columns a second at 0.2, 4.8 at 3). The rings run in from the sides of every window at 0.3 turns a second for every unit, 3.6 LEDs a second at 2, 6 LEDs apart.
// Knob 3: Sequence. Snaps to one of six: 0 Thue-Morse, 1 regular paperfolding, 2 Rudin-Shapiro, 3 the Fibonacci word, 4 the Motzkin numbers mod 2, 5 the primes. Each wall is drawn in from the top, row by row, behind a white line, in 0.6 s, and each starts at a column picked for the sizes of window in view. The windows' sides, counted over the 224 rows and 1024 columns the pattern computes: Thue-Morse 1, 2 and 2^k - 2 from 6 up; paperfolding 1, 2, 3 and 2^k - 1 from 7; Rudin-Shapiro 1 to 4 and 2^k - 2 from 6; Motzkin 2^k from 2; the Fibonacci word 1, 2, 3, 8, 13, 34, 55 and F - 2 (6, 11, 19, 32, 53, 87); the primes only odd sides, 1 to 37.
// Knob 4: Depth. The row of the wall at the top of the panel, 0 to 96, which the picture follows in about half a second. At 0 the first row is the wall's row 0, all ones, and the second is the sequence itself; at 96 the panel looks at rows 96 to 223, where in Thue-Morse the windows have outgrown the panel and what is left to see is the rings that run in from their sides.

const W = 64, H = 128;
const { floor, round, min, cos, log2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The wall. W(m, n) is the determinant of the m by m matrix with S(n + j - i) in row i, column j.
// Row 0 is all ones and row 1 is the sequence. Over GF(2) a cell is 1 or 0, and the
// determinant of the m by m Toeplitz matrix at n is the Hankel determinant of the m by m
// block that starts at a = n - m + 1, which is nonzero exactly when the linear complexity
// of S(a), S(a + 1), ... is m after 2m terms. One Berlekamp-Massey pass per start a
// therefore gives that cell in every row at once.
const M = 224; // rows computed: 128 on the panel and up to 96 of depth
const NC = 1024; // columns computed
const N0 = M; // first column's n, so that every row's first matrix starts at a sequence index of at least 2
const MARG = 96; // columns kept out of view at each end, where a window may be cut by the edge
const RANGE = NC - 2 * MARG - W;
const SLEN = N0 + NC + 2 * M + 8;
const NSEQ = 6;

const popc = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
function sequence(k) {
  const s = new Uint8Array(SLEN);
  if (k === 3) {
    // Fibonacci word, the limit of 0 -> 01, 1 -> 0
    let a = [0], b = [0, 1];
    while (b.length < SLEN) { const c = b.concat(a); a = b; b = c; }
    for (let n = 0; n < SLEN; n++) s[n] = b[n];
    return s;
  }
  if (k === 5) {
    // the primes: 1 at a prime, 0 elsewhere
    s.fill(1);
    s[0] = s[1] = 0;
    for (let i = 2; i * i < SLEN; i++) if (s[i]) for (let j = i * i; j < SLEN; j += i) s[j] = 0;
    return s;
  }
  for (let n = 0; n < SLEN; n++) {
    if (k === 0) s[n] = popc(n) & 1; // Thue-Morse
    else if (k === 1) {
      // regular paperfolding 1 1 0 1 1 0 0 1 ...: with n + 1 = 2^j * (2i + 1), the digit is 1 for an even i
      let q = n + 1;
      while (!(q & 1)) q >>>= 1;
      s[n] = 1 - ((q >>> 1) & 1);
    } else if (k === 2) s[n] = popc(n & (n >>> 1)) & 1; // Rudin-Shapiro: parity of the 11 pairs in n
    else {
      // Motzkin numbers mod 2: odd when the ones in n >> 1, counted up from its lowest bit, run an even length
      let r = 0, q = n >>> 1;
      while (q & 1) { r++; q >>>= 1; }
      s[n] = (1 + r) & 1;
    }
  }
  return s;
}

// Berlekamp-Massey over GF(2), 32 terms to a word. The wall comes out as one byte a cell.
function wallOf(s) {
  const out = new Uint8Array(M * NC);
  out.fill(1, 0, NC);
  const len = 2 * (M - 1), NW = (len >> 5) + 3;
  const C = new Uint32Array(NW), Bs = new Uint32Array(NW), R = new Uint32Array(NW), T = new Uint32Array(NW);
  for (let a = N0 - M + 2; a <= N0 + NC - 1; a++) {
    C.fill(0);
    Bs.fill(0);
    R.fill(0);
    C[0] = 1;
    Bs[0] = 2;
    let L = 0;
    for (let N = 0; N < len; N++) {
      const nw = ((N + 1) >> 5) + 1;
      let carry = s[a + N], w;
      for (w = 0; w < nw; w++) { const v = R[w]; R[w] = (v << 1) | carry; carry = v >>> 31; }
      const nl = (L >> 5) + 1;
      let x = 0;
      for (w = 0; w < nl; w++) x ^= C[w] & R[w];
      x ^= x >>> 16; x ^= x >>> 8; x ^= x >>> 4; x ^= x >>> 2; x ^= x >>> 1;
      if (x & 1) {
        if (2 * L <= N) {
          for (w = 0; w < nw; w++) { T[w] = C[w]; C[w] ^= Bs[w]; }
          L = N + 1 - L;
          let c2 = 0;
          for (w = 0; w < nw; w++) { const v = T[w]; Bs[w] = (v << 1) | c2; c2 = v >>> 31; }
        } else {
          for (w = 0; w < nw; w++) C[w] ^= Bs[w];
          let c2 = 0;
          for (w = 0; w < nw; w++) { const v = Bs[w]; Bs[w] = (v << 1) | c2; c2 = v >>> 31; }
        }
      } else {
        let c2 = 0;
        for (w = 0; w < nw; w++) { const v = Bs[w]; Bs[w] = (v << 1) | c2; c2 = v >>> 31; }
      }
      if ((N & 1) && L === (N + 1) >> 1) {
        const m = (N + 1) >> 1, n = a + m - 1 - N0;
        if (n >= 0 && n < NC) out[m * NC + n] = 1;
      }
    }
  }
  return out;
}

// Each zero lies in a square window with a frame of nonzeros round it (Lunnon's frame theorem). For
// every cell of a window keep its side d and its distance e to the nearest side, in cells.
function windowsOf(wall) {
  const SZ = new Uint8Array(M * NC), ED = new Uint8Array(M * NC);
  for (let m = 1; m < M; m++) {
    for (let c = 0; c < NC; c++) {
      const i = m * NC + c;
      if (wall[i] || !wall[i - NC] || (c > 0 && !wall[i - 1])) continue;
      let d = 1;
      while (c + d < NC && !wall[i + d]) d++;
      for (let dy = 0; dy < d && m + dy < M; dy++) {
        for (let dx = 0; dx < d; dx++) {
          const j = i + dy * NC + dx;
          SZ[j] = min(d, 255);
          ED[j] = min(dx, dy, d - 1 - dx, d - 1 - dy, 255);
        }
      }
    }
  }
  return { SZ, ED };
}

const CACHE = [];
function wallFor(k) {
  if (!CACHE[k]) CACHE[k] = windowsOf(wallOf(sequence(k)));
  return CACHE[k];
}

// A dim orange or yellow reads as brown on the panel, so those hues go to crimson or green.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.28 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

const START = [100, 480, 224, 88, 96, 292];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, seq: 0, prev: -1, wipe: 999, depth: 0, df: 0,
    p: START[0], dir: 1, tgt: 1, t: 0,
    FR: new Uint8Array(M * 3), TN: new Uint8Array(256 * 3), RG: new Float32Array(256),
  };
  wallFor(0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const sq = cl(round(k[2]), 0, NSEQ - 1);
  if (sq !== S.seq) {
    S.prev = S.seq;
    S.seq = sq;
    S.wipe = 0;
    S.p = START[sq];
    wallFor(sq);
  }
  S.depth = cl(k[3], 0, M - H);
  S.df += (S.depth - S.df) * min(1, d * 6);
  S.t += d;
  S.wipe += d * 220;
  S.p += S.dir * S.speed * 1.6 * d;
  if (S.p > RANGE - 3) S.tgt = -1;
  else if (S.p < 3) S.tgt = 1;
  S.dir += (S.tgt - S.dir) * min(1, d * 3);
  S.p = cl(S.p, 0, RANGE);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const h = S.hue, FR = S.FR, TN = S.TN, RG = S.RG, t = S.t;
  const tmp = [0, 0, 0];
  for (let m = 0; m < M; m++) {
    hsv(dim(h + 0.5 + 0.08 * (m / M)), 0.24, 0.56, tmp);
    FR[m * 3] = tmp[0];
    FR[m * 3 + 1] = tmp[1];
    FR[m * 3 + 2] = tmp[2];
  }
  for (let d = 1; d < 256; d++) {
    hsv(dim(h + 0.6 + 0.06 * min(log2(d), 6)), 0.85, 1, tmp);
    TN[d * 3] = tmp[0];
    TN[d * 3 + 1] = tmp[1];
    TN[d * 3 + 2] = tmp[2];
  }
  // rings that run in from the sides of every window together
  const ph = t * 0.3 * S.speed;
  for (let e = 0; e < 256; e++) {
    const pulse = 0.5 + 0.5 * cos(2 * PI * (e / 6 - ph));
    RG[e] = min(1, 0.08 + 0.5 * pulse * pulse * pulse + 0.5 * exp(-e / 1.1));
  }
  const m0 = round(S.df), cb = MARG + floor(S.p);
  const cur = wallFor(S.seq), old = S.prev >= 0 ? wallFor(S.prev) : cur;
  for (let y = 0; y < H; y++) {
    const m = m0 + y, row = m * NC + cb;
    const nw = S.wipe > y + 1 ? cur : old;
    const lineY = round(S.wipe) === y && S.wipe < H + 2;
    for (let x = 0; x < W; x++) {
      const i = row + x, sz = nw.SZ[i];
      let r, g, b;
      if (sz === 0) {
        r = FR[m * 3];
        g = FR[m * 3 + 1];
        b = FR[m * 3 + 2];
      } else {
        const v = RG[nw.ED[i]] * (sz > 3 ? 1 : sz === 3 ? 0.7 : sz === 2 ? 0.45 : 0.05), o = sz * 3;
        r = TN[o] * v;
        g = TN[o + 1] * v;
        b = TN[o + 2] * v;
      }
      if (lineY) { r = 255; g = 255; b = 255; }
      display.setPixel(x, y, r, g, b);
    }
  }
}
