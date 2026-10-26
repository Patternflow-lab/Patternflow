// ===== Patternflow pattern =====
// Title:   Costas Array
// Family:  rhythm
// Idea:    A Costas array plays as a frequency-hopping rhythm in the top half while a ghost copy of it spirals out through the shifts in time and pitch, flashing where it lands on a dot, and the bottom half fills in one cell per shift with how many dots met: noughts and ones all the way out, and one spike of N at the centre.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Costas arrays (John P. Costas, 1965, published 1984), with the Welch and Lempel-Golomb constructions (Solomon W. Golomb, 1984), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Field=0..8, Rival=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the array's dots are sea green, the ghost copy rose, a single meeting in the map green and a crowd of them rose fading to white.
// Knob 2: Speed. At 2 the playhead strikes 5.5 columns a second at order 10 and 10.5 at order 30. The ghost takes 1.2 (2N - 1) steps a second and stays one step on an empty shift, four on a meeting and up to seven on a crowd, so the order 10 map is full in 15 seconds and the order 30 map in 43. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Field. The finite field the arrays are built over, one of 11, 13, 16, 17, 19, 23, 29, 31 and 32 elements. A prime p gives Welch arrays of order p - 1 and Lempel-Golomb arrays of order p - 2; 16 and 32 give Lempel-Golomb arrays of order 14 and 30. The field of 11 opens on the Welch array of 2^i mod 11.
// Knob 4: Rival. Swaps the array for a permutation that is not a Costas array and keeps the scan where it is. 0 is the Costas array and 1 a shuffle of the same order, whose map picks up a few twos and threes. 2 is the folded chirp i -> a*i mod N, a lattice of tall counts, and 3 the plain diagonal, one ridge that climbs to N - 1 beside the spike.
// Buttons: K1 tap moves on to the next array of the field: the next construction, primitive root and one of the eight symmetries of the square. The pattern also moves on by itself a few seconds after a map is full.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const FIELDS = [11, 13, 16, 17, 19, 23, 29, 31, 32];
// Hue of the array's dots at knob 0, and the ghost's hue past it.
const HUE0 = 0.42, GHOST = 0.5;
// Seconds the full map stays before the next array, and the extra time the
// ghost sits on the original at the start of a scan, both at Speed 2.
const HOLD = 5, REST = 0.9;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// GF(q) for a prime q or q = 16, 32. The elements are 0..q-1; exp and log
// are taken to a generator g0, and the primitive elements are g0^e with e
// prime to q - 1, sorted by value so the field of 11 starts with 2.
function field(q) {
  const two = (q & (q - 1)) === 0, poly = q === 16 ? 0x13 : 0x25;
  const ex = new Int32Array(q - 1), lg = new Int32Array(q);
  let g0 = 2;
  for (;;) {
    let v = 1, ok = true;
    for (let i = 0; i < q - 1; i++) {
      ex[i] = v;
      if (i > 0 && v === 1) { ok = false; break; }
      if (two) { v <<= 1; if (v & q) v ^= poly; } else v = (v * g0) % q;
    }
    if (ok && v === 1) break;
    g0++;
  }
  for (let i = 0; i < q - 1; i++) lg[ex[i]] = i;
  const prim = [];
  for (let e = 1; e < q - 1; e++) if (gcd(e, q - 1) === 1) prim.push(ex[e]);
  prim.sort((a, b) => a - b);
  // 1 - a: a subtraction mod q, or in characteristic 2 an XOR.
  const oneMinus = (a) => (two ? 1 ^ a : (1 - a + q) % q);
  return { q, two, ex, lg, prim, oneMinus };
}

// Welch: column i, row g^(i + c) mod p minus 1, order p - 1.
function welch(F, g, c) {
  const n = F.q - 1, e = F.lg[g], f = new Int32Array(n);
  for (let i = 0; i < n; i++) f[i] = F.ex[(e * (i + c)) % n] - 1;
  return f;
}

// Lempel-Golomb: a dot at (i, j), 1 <= i, j <= q - 2, where a^i + b^j = 1.
// a = b is Lempel's symmetric array.
function lempelGolomb(F, a, b) {
  const n = F.q - 2, m = F.q - 1, ea = F.lg[a], eb = F.lg[b], f = new Int32Array(n);
  let inv = 1;
  while ((eb * inv) % m !== 1) inv++;
  for (let i = 1; i <= n; i++) {
    const v = F.oneMinus(F.ex[(ea * i) % m]);
    f[i - 1] = ((F.lg[v] * inv) % m) - 1;
  }
  return f;
}

// The eight symmetries of the square: bit 0 transposes (the inverse
// permutation), bit 1 mirrors the columns, bit 2 the rows.
function symmetry(f, k) {
  const n = f.length;
  let g = Int32Array.from(f);
  if (k & 1) for (let i = 0; i < n; i++) g[f[i]] = i;
  if (k & 2) g = g.map((_, i, a) => a[n - 1 - i]);
  if (k & 4) g = g.map((v) => n - 1 - v);
  return g;
}

// Array number k of a field: Welch and Lempel-Golomb in turn for a prime,
// Lempel-Golomb alone for 16 and 32, the roots and symmetry moving on.
function costas(F, k) {
  const P = F.prim, R = P.length, h = floor(k / 2), sym = (3 * k) % 8;
  let f;
  if (F.two) f = lempelGolomb(F, P[k % R], P[(2 * k) % R]);
  else if (k % 2 === 0) f = welch(F, P[h % R], (3 * h) % (F.q - 1));
  else f = lempelGolomb(F, P[h % R], P[(2 * h) % R]);
  return symmetry(f, sym);
}

// The coincidence count of every shift: C[dx, dy] is how many dots of the
// copy shifted by (dx, dy) land on a dot. Index (N-1-dy)*M + dx+N-1.
function counts(f) {
  const n = f.length, M = 2 * n - 1, C = new Int16Array(M * M);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) C[(n - 1 - (f[j] - f[i])) * M + j - i + n - 1]++;
  return C;
}

// A small seeded generator, so a shuffled rival is the same each time.
function shuffle(n, seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (;;) {
    const f = Int32Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = floor(rnd() * (i + 1)), t = f[i];
      f[i] = f[j];
      f[j] = t;
    }
    // A shuffle that came out a Costas array by chance is drawn again.
    const C = counts(f), M = 2 * n - 1, mid = (n - 1) * M + n - 1;
    let worst = 0;
    for (let d = 0; d < C.length; d++) if (d !== mid) worst = max(worst, C[d]);
    if (worst > 1) return f;
  }
}

function rival(f, kind, seed) {
  const n = f.length;
  if (kind === 1) return shuffle(n, seed);
  if (kind === 2) {
    let a = max(2, round(n * 0.3));
    while (gcd(a, n) !== 1) a++;
    return Int32Array.from({ length: n }, (_, i) => (a * i) % n);
  }
  if (kind === 3) return Int32Array.from({ length: n }, (_, i) => i);
  return f;
}

// The scan. A shift and its opposite meet the same dots, the copy's dot
// and the array's dot trading places, so the ghost visits half of each
// square ring round (0, 0), the right side and the top, and the opposite
// cell of the map fills in with it. Odd rings go up the right side and left
// along the top, even rings back the other way, so each step is to a
// neighbouring shift.
function spiral(n) {
  const M = 2 * n - 1, L = (M * M + 1) / 2, sx = new Int8Array(L), sy = new Int8Array(L);
  let m = 1;
  const put = (x, y) => ((sx[m] = x), (sy[m++] = y));
  for (let k = 1; k < n; k++) {
    if (k & 1) {
      for (let y = -k + 1; y <= k; y++) put(k, y);
      for (let x = k - 1; x >= -k; x--) put(x, k);
    } else {
      for (let x = -k; x < k; x++) put(x, k);
      for (let y = k; y > -k; y--) put(k, y);
    }
  }
  const ord = new Int32Array(M * M);
  for (let i = 0; i < L; i++) {
    ord[(n - 1 - sy[i]) * M + sx[i] + n - 1] = i;
    ord[(n - 1 + sy[i]) * M - sx[i] + n - 1] = i;
  }
  return { sx, sy, ord, L };
}

export function setup(params) {
  params.s = {
    hue: 0, sp: 2, fi: -1, kind: -1, k: 0, F: null,
    base: null, f: null, n: 0, C: null, scan: null,
    m: 0, w: 0, dur: 1, step: 1, clk: 0, rev: null, ph: 0, col: -1,
    hit: null, str: null,
    buf: new Float32Array(W * H * 3), pal: new Float32Array(30), palHue: -1,
  };
}

function build(s, fresh) {
  const n = s.base.length;
  s.f = rival(s.base, s.kind, s.F.q * 977 + s.k * 131 + 7);
  s.C = counts(s.f);
  if (!fresh && s.n === n) return;
  s.n = n;
  s.scan = spiral(n);
  s.step = 1 / (1.2 * (2 * n - 1));
  s.rev = new Float32Array((2 * n - 1) ** 2);
  s.m = 0;
  s.w = 0;
  s.ph = 0;
  s.col = -1;
  s.hit = new Float32Array(n).fill(9);
  s.str = new Float32Array(n).fill(9);
  arrive(s, 0);
}

function next(s, k) {
  s.k = k;
  s.base = costas(s.F, k);
  build(s, true);
}

// The ghost has landed on shift number m: every dot it covers flashes,
// and it stays one step for nothing and four for a meeting, up to seven for
// three or more, so the meetings are the scan's own rhythm.
function arrive(s, m) {
  const { f, n } = s, dx = s.scan.sx[m], dy = s.scan.sy[m];
  let met = 0;
  for (let i = 0; i < n; i++) {
    const j = i + dx;
    if (j >= 0 && j < n && f[j] === f[i] + dy) (s.hit[j] = 0), met++;
  }
  s.rev[(n - 1 - dy) * (2 * n - 1) + dx + n - 1] = s.rev[(n - 1 + dy) * (2 * n - 1) - dx + n - 1] = s.clk;
  s.dur = m ? s.step * (1 + 3 * min(met, 1) + max(0, min(met, 3) - 1) * 1.5) : REST + 4 * s.step;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.sp = cl(kv[1], 0.2, 3);
  const fi = round(cl(kv[2], 0, 8)), kind = round(cl(kv[3], 0, 3));
  if (fi !== s.fi) {
    s.fi = fi;
    s.F = field(FIELDS[fi]);
    s.kind = kind;
    next(s, 0);
  } else if (kind !== s.kind) {
    s.kind = kind;
    build(s, false);
  }
  if (input.btnPressed && input.btnPressed[0]) next(s, s.k + 1);
  const r = d * (s.sp / 2), n = s.n, total = s.scan.L;
  for (let i = 0; i < n; i++) (s.hit[i] += r), (s.str[i] += r);
  s.clk += r;
  s.w += r;
  while (s.m < total - 1 && s.w >= s.dur) (s.w -= s.dur), arrive(s, ++s.m);
  if (s.m === total - 1 && s.w >= HOLD) return next(s, s.k + 1);
  // The playhead: 5.5 columns a second at order 10, faster for the big
  // orders so a bar stays under three seconds.
  s.ph += r * (3 + n / 4);
  const c = floor(s.ph) % n;
  if (c !== s.col) (s.col = c), (s.str[c] = 0);
}

function palette(s) {
  const P = s.pal, h = HUE0 + s.hue;
  hsv(h, 0.85, 0.85, P, 0); // dot
  hsv(h, 0.35, 1, P, 3); // struck dot
  hsv(h, 0.7, 0.55, P, 6); // ring
  hsv(h + GHOST, 0.75, 0.6, P, 9); // ghost
  hsv(h, 0.8, 0.15, P, 12); // playhead band
  hsv(h + 0.12, 0.9, 0.22, P, 15); // a nought in the map
  hsv(h - 0.05, 0.7, 0.8, P, 18); // a one
  hsv(h + GHOST, 0.8, 0.85, P, 21); // two or more
  hsv(h + 0.1, 0.8, 0.1, P, 24); // lattice
  hsv(h + GHOST, 0.4, 0.75, P, 27); // flash halo
  s.palHue = s.hue;
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.f) return;
  if (s.palHue !== s.hue) palette(s);
  const { buf: B, pal: P, f, n, C } = s;
  B.fill(0);
  const add = (x, y, o, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 3;
    B[p] += P[o] * a;
    B[p + 1] += P[o + 1] * a;
    B[p + 2] += P[o + 2] * a;
  };
  const white = (x, y, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = (y * W + x) * 3;
    B[p] += a;
    B[p + 1] += a;
    B[p + 2] += a;
  };

  // Top: the array, column i is time step i, row f(i) the frequency, low
  // frequencies at the bottom.
  const c = floor(64 / n), d = c >= 5 ? c - 2 : c >= 3 ? c - 1 : c, e = (c - d) >> 1;
  const ox = (W - c * n) >> 1, oy = (64 - c * n) >> 1, side = c * n;
  const X = (i) => ox + i * c + e, Y = (r) => oy + (n - 1 - r) * c + e;
  const block = (x0, y0, sz, fn) => {
    for (let y = y0; y < y0 + sz; y++) for (let x = x0; x < x0 + sz; x++) fn(x, y);
  };
  if (c >= 4) for (let i = 0; i < n; i++) for (let r = 0; r < n; r++) add(X(i) + (d >> 1), Y(r) + (d >> 1), 24, 1);
  // The playhead's column and the row of the note it is playing.
  if (s.col >= 0) {
    const yr = Y(f[s.col]) - e;
    for (let y = oy; y < oy + side; y++) for (let x = ox + s.col * c; x < ox + s.col * c + c; x++) add(x, y, 12, 1);
    for (let y = yr; y < yr + c; y++) for (let x = ox; x < ox + side; x++) add(x, y, 12, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = s.str[i], x0 = X(i), y0 = Y(f[i]);
    const k = a < 0.6 ? exp(-a * 5) : 0;
    block(x0, y0, d, (x, y) => (add(x, y, 0, 1 - k), add(x, y, 3, k)));
    // A struck note rings out as a widening square.
    if (a < 0.45) {
      const rr = (d >> 1) + 1 + floor(a * 14), cx = x0 + (d >> 1), cy = y0 + (d >> 1), al = (1 - a / 0.45) ** 2;
      for (let t = -rr; t <= rr; t++) {
        for (const [x, y] of [[cx + t, cy - rr], [cx + t, cy + rr], [cx - rr, cy + t], [cx + rr, cy + t]])
          if (x >= ox && x < ox + side && y >= oy && y < oy + side) add(x, y, 6, al);
      }
    }
  }
  // The ghost copy glides from shift m to shift m + 1.
  const { sx, sy, ord, L: total } = s.scan, m = s.m;
  // It rests, then glides in the last 0.8 of a plain step.
  const g = m < total - 1 ? cl((s.w - s.dur) / (0.8 * s.step) + 1, 0, 1) : 0, gg = g * g * (3 - 2 * g);
  const mn = min(m + 1, total - 1), gdx = sx[m] + (sx[mn] - sx[m]) * gg, gdy = sy[m] + (sy[mn] - sy[m]) * gg;
  const hollow = d >= 3;
  // The sheet the ghost is printed on: faint where it overlaps the array,
  // brighter along its edge.
  const gx0 = ox + round(gdx * c), gy0 = oy - round(gdy * c);
  for (let y = max(oy, gy0); y < min(oy + side, gy0 + side); y++)
    for (let x = max(ox, gx0); x < min(ox + side, gx0 + side); x++) {
      const edge = x === gx0 || x === gx0 + side - 1 || y === gy0 || y === gy0 + side - 1;
      add(x, y, 9, edge ? 0.45 : 0.1);
    }
  for (let i = 0; i < n; i++) {
    const x0 = round(X(i) + gdx * c), y0 = round(Y(f[i]) - gdy * c);
    block(x0, y0, d, (x, y) => {
      if (x < ox || x >= ox + side || y < oy || y >= oy + side) return;
      if (hollow && x > x0 && x < x0 + d - 1 && y > y0 && y < y0 + d - 1) return;
      add(x, y, 9, hollow ? 1 : 0.7);
    });
  }
  // Where the ghost met a dot.
  for (let j = 0; j < n; j++) {
    const a = s.hit[j];
    if (a > 0.5) continue;
    const k = 1 - a / 0.5, x0 = X(j), y0 = Y(f[j]);
    block(x0 - 1, y0 - 1, d + 2, (x, y) => {
      const edge = x < x0 || y < y0 || x >= x0 + d || y >= y0 + d;
      if (edge) add(x, y, 27, k);
      else white(x, y, k * 0.8), add(x, y, 27, k * 0.6);
    });
  }

  // Bottom: one cell per shift, dx across and dy up, filled as the scan
  // reaches it.
  const M = 2 * n - 1, sc = floor(64 / M), sd = sc >= 3 ? sc - 1 : 1;
  const mx = (W - sc * M) >> 1, my = 64 + ((64 - sc * M) >> 1), mid = (n - 1) * M + n - 1;
  const cur = (n - 1 - sy[m]) * M + sx[m] + n - 1;
  for (let gy = 0; gy < M; gy++)
    for (let gx = 0; gx < M; gx++) {
      const q = gy * M + gx, o = ord[q], x0 = mx + gx * sc, y0 = my + gy * sc;
      if (o > m) {
        if (sc >= 2) add(x0, y0, 24, sc >= 3 ? 1.6 : 0.9);
        continue;
      }
      const v = C[q], age = s.clk - s.rev[q];
      const flash = age < 0.35 ? (1 - age / 0.35) * 0.7 : 0;
      block(x0, y0, sd, (x, y) => {
        if (q === mid) return white(x, y, 1);
        if (v === 0) add(x, y, 15, 1);
        else if (v === 1) add(x, y, 18, 1);
        else {
          // Two or more: the ghost hue, whitening toward N - 1.
          const t = (v - 2) / max(1, n - 3);
          add(x, y, 21, 1 - 0.6 * t);
          white(x, y, 0.6 * t);
        }
        if (flash) white(x, y, flash);
      });
    }
  // The spike of N fills the gaps round its cell, and the scan has a cursor.
  if (sc >= 3) {
    const x0 = mx + (n - 1) * sc, y0 = my + (n - 1) * sc;
    for (let t = -1; t <= sd; t++) white(x0 + t, y0 - 1, 0.8), white(x0 + t, y0 + sd, 0.8), white(x0 - 1, y0 + t, 0.8), white(x0 + sd, y0 + t, 0.8);
  }
  // The opposite shift gets a fainter cursor of its own.
  if (m < total - 1)
    for (const [q, a] of [[cur, 1], [M * M - 1 - cur, 0.45]]) {
      const x0 = mx + (q % M) * sc, y0 = my + floor(q / M) * sc;
      if (sd >= 2) for (let t = -1; t <= sd; t++) white(x0 + t, y0 - 1, 0.55 * a), white(x0 + t, y0 + sd, 0.55 * a), white(x0 - 1, y0 + t, 0.55 * a), white(x0 + sd, y0 + t, 0.55 * a);
      else white(x0, y0, 0.8 * a), white(x0 - 1, y0, 0.35 * a), white(x0 + 1, y0, 0.35 * a), white(x0, y0 - 1, 0.35 * a), white(x0, y0 + 1, 0.35 * a);
    }

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, min(255, round(B[p] * 255)), min(255, round(B[p + 1] * 255)), min(255, round(B[p + 2] * 255)));
}
