// ===== Patternflow pattern =====
// Title:   Gilbreath Table
// Family:  number
// Idea:    The primes run along the top row and every row below holds the absolute differences of neighbours in the row above, worked out row by row down the panel; the rows where the prime gaps still show stay pinned at the top while the rest slides down the table, and the column of 1s at the left edge never breaks.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gilbreath's conjecture (Norman Gilbreath, 1958; first noted by François Proth, 1878), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=0..1, Zoom=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the 1s are gold, a 2 teal and brighter the longer its run, a 0 indigo shading darker away from the slanted side of its triangle, 4 and 6 pink and coral, 8 and up near white, and the primes white.
// Knob 2: Speed. At 2 the table is worked out 24 rows a second down the panel, so it is full in under 3 seconds, and from then on the lower part goes down the table 3 rows a second; at 0.2 a tenth of both, at 3 one and a half times.
// Knob 3: Depth. Where the lower part opens: straight on from the pinned rows at 0, 156 rows further down at 0.25, 1250 at 0.5, 4219 at 0.75 and 10000 at 1. Among these 17984 primes the last value above 2 sits in row 64; from row 65 on every cell but the first is 0 or 2.
// Knob 4: Zoom. LEDs to a cell. At -1 one LED, 64 cells across and 11 pinned rows; at 0 two LEDs, 32 cells and 10 pinned rows; at 0.5 three LEDs and at 1 four, 16 cells and 5 pinned rows. From three LEDs on a dark line runs between cells.
// Buttons: K1 tap takes the lower part back up to where Depth opens it and works it out again from under the pinned rows.

const W = 64, H = 128, LIM = 200000, K0 = 96, RW = 128, LOOK = 16, DMAX = 10000, PRIME = 255;
const { floor, log, min, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// The same, lifted and paled around orange and yellow, which go brown or
// olive on the panel when they are dim.
function hsvL(h, s, v, out, o) {
  const a = h - floor(h), u = cl(1 - Math.abs(a - 0.12) / 0.11, 0, 1);
  hsv(h, s * (1 - 0.25 * u), min(1, v * (1 + 0.45 * u)), out, o);
}

// Row 0: the 17984 primes below 200000, by a sieve.
function primes() {
  const comp = new Uint8Array(LIM + 1), out = [];
  for (let i = 2; i <= LIM; i++) {
    if (comp[i]) continue;
    out.push(i);
    for (let j = i * i; j <= LIM; j += i) comp[j] = 1;
  }
  return Int32Array.from(out);
}

// One row down: each cell becomes |next - this|, and the row loses a cell.
function step(P) {
  const a = P.work, n = --P.len;
  for (let i = 0; i < n; i++) {
    const d = a[i + 1] - a[i];
    a[i] = d < 0 ? -d : d;
  }
  P.k++;
}

// Put the working row at row k >= 1. Down to row K0 by plain steps. By row
// K0 every cell but the first is 0 or 2 (setup checks), so |a - b| is a XOR,
// and by Lucas's theorem 2^s rows down cell n is cell n XOR cell n + 2^s: a
// jump of thousands of rows is one pass a bit. The first cell stays
// |cell 1 - 1| = 1 at each of those rows, which is the conjecture holding.
function seek(P, k) {
  if (k <= K0) {
    const g = P.work, p = P.pr;
    for (let i = 0; i < P.N - 1; i++) g[i] = p[i + 1] - p[i];
    P.len = P.N - 1;
    P.k = 1;
    while (P.k < k) step(P);
    return;
  }
  P.work.set(P.base);
  P.len = P.N - K0;
  const m = k - K0;
  for (let s = 14; s >= 0; s--) {
    const j = 1 << s;
    if (!(m & j)) continue;
    const a = P.work, n = P.len - j;
    for (let i = 1; i < n; i++) a[i] ^= a[i + j];
    P.len = n;
  }
  P.k = k;
}

// Copy a row into a table at slot o, with a number for each cell: for a 0,
// how many cells there are to the end of its run of 0s, which is how many
// more rows it stays 0, since a run of 0s loses its last cell every row
// down; for a 2, the length of its run of 2s. A run of 2s is the lid of a
// triangle of 0s one shorter, so a long run is the top of a big triangle.
function keep(src, ring, run, o) {
  ring.set(src.subarray(0, RW), o);
  for (let i = RW - 1, d = LOOK; i >= 0; i--) {
    d = ring[o + i] === 0 ? min(LOOK, d + 1) : 0;
    run[o + i] = d;
  }
  for (let i = 0; i < RW; ) {
    if (ring[o + i] !== 2) {
      i++;
      continue;
    }
    let j = i;
    while (j < RW && ring[o + j] === 2) j++;
    run.fill(min(LOOK, j - i), o + i, o + j);
    i = j;
  }
}

const keepBody = (P) => keep(P.work, P.ring, P.run, (P.k % H) * RW);

function fill(P, r) {
  r = cl(floor(r), 1, P.N - RW - H - 2);
  P.top = r;
  seek(P, r);
  keepBody(P);
  while (P.k < r + H - 1) {
    step(P);
    keepBody(P);
  }
}

export function setup(params) {
  const pr = primes(), N = pr.length;
  const P = {
    pr, N, work: new Uint8Array(N), base: null, len: 0, k: 0, top: 0, pos: 0, start: 0, pin: 11,
    ring: new Uint8Array(H * RW), run: new Uint8Array(H * RW),
    head: new Uint8Array((K0 + 1) * RW), hrun: new Uint8Array((K0 + 1) * RW),
    hue: NaN, speed: 2, cell: -1, depth: -1, front: -1, rows: H,
    lut: new Float32Array(256 * 3), zlut: new Float32Array((LOOK + 1) * 3), tlut: new Float32Array((LOOK + 1) * 3),
  };
  // The first K0 + 1 rows, kept for the pinned top; row 0 is drawn as primes.
  P.head.fill(PRIME, 0, RW);
  seek(P, 1);
  for (;;) {
    keep(P.work, P.head, P.hrun, P.k * RW);
    if (P.k === K0) break;
    step(P);
  }
  for (let i = 1; i < P.len; i++) if (P.work[i] > 2) throw new Error("row " + K0 + " still holds " + P.work[i]);
  P.base = P.work.slice();
  params.s = P;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.speed = cl(k[1], 0.2, 3);
  const cell = round(2 ** (cl(k[3], -1, 1) + 1)), depth = cl(k[2], 0, 1);
  let refill = false;
  if (cell !== P.cell) {
    // Pin every row down to the last one that still holds a value above 2
    // in the columns on show: 0 to 10 for 64 columns, 0 to 4 for 16.
    P.cell = cell;
    const cols = Math.ceil(W / cell);
    let last = 1;
    for (let r = 1; r <= K0; r++)
      for (let n = 1; n < cols; n++) if (P.head[r * RW + n] > 2) last = r;
    P.pin = last + 1;
    P.rows = P.pin + Math.ceil((H - P.pin * cell - 1) / cell);
    refill = true;
  }
  if (depth !== P.depth) (P.depth = depth), (refill = true);
  if (refill || (input.btnPressed && input.btnPressed[0])) {
    P.start = P.pin + floor(DMAX * P.depth * P.depth * P.depth);
    P.pos = P.start;
    fill(P, P.pos);
    P.front = P.front < 0 ? 0 : min(P.front, P.pin);
  }
  // The front works out 12 rows a second at Speed 1 until it reaches the
  // bottom; from then on the lower part goes down the table 1.5 a second.
  if (P.front < P.rows) P.front += d * P.speed * 12;
  else {
    P.front = P.rows + 1;
    P.pos += d * P.speed * 1.5;
  }
  // At the far end of the computed table the lower part starts over at Depth.
  if (P.pos > P.N - RW - H - 2) (P.pos = P.start), fill(P, P.pos);
  while (P.top < floor(P.pos)) {
    P.top++;
    step(P);
    keepBody(P);
  }
  if (P.hue !== k[0]) {
    P.hue = k[0];
    const h = k[0], lut = P.lut, zl = P.zlut, tl = P.tlut;
    hsv(h + 0.12, 0.8, 1, lut, 3);
    for (let v = 3; v < 256; v++) {
      // 4 pink, 6 coral, then warmer and whiter up to the widest gaps.
      const u = cl((log(v) - log(4)) / (log(40) - log(4)), 0, 1);
      hsv(h + 0.9 + 0.1 * u, 0.7 * (1 - u) + 0.08, 0.84 + 0.16 * u, lut, v * 3);
    }
    hsv(h + 0.1, 0.06, 1, lut, PRIME * 3);
    for (let z = 0; z <= LOOK; z++) {
      // A 0 is brighter near the slanted side of its triangle and deeper
      // inside; a 2 is brighter the longer its run, so big triangles have a
      // bright lid.
      const u = cl((z - 1) / 7, 0, 1), w = cl((z - 1) / 6, 0, 1);
      hsvL(h + 0.62 + 0.08 * u, 0.8, 0.32 - 0.18 * u, zl, z * 3);
      hsvL(h + 0.5 - 0.04 * w, 0.8 - 0.3 * w, 0.54 + 0.4 * w, tl, z * 3);
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || P.depth < 0) return;
  const lut = P.lut, zl = P.zlut, tl = P.tlut, c = P.cell, split = P.pin * c, f = P.front;
  for (let y = 0; y < H; y++) {
    // The pinned rows, one dark LED row with the column of 1s going through
    // it, then the moving part. Rows past the front are not worked out yet;
    // the newest ones glow.
    let r, z, o, j;
    if (y < split) (j = floor(y / c)), (r = P.head), (z = P.hrun), (o = j * RW);
    else if (y === split) {
      for (let x = 0; x < W; x++) {
        const g = x < (c > 2 ? c - 1 : c) && f > P.pin ? 0.8 : 0;
        display.setPixel(x, y, lut[3] * g, lut[4] * g, lut[5] * g);
      }
      continue;
    } else {
      const b = floor((y - split - 1) / c);
      (j = P.pin + b), (r = P.ring), (z = P.run), (o = ((P.top + b) % H) * RW);
    }
    if (j >= f) {
      for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const glow = 0.75 * Math.exp(-(f - j) / 2.5);
    const edgeY = c > 2 && (y < split ? y % c : (y - split - 1) % c) === c - 1;
    for (let x = 0; x < W; x++) {
      const n = floor(x / c), v = r[o + n];
      let R, G, B;
      if (v === 0 || v === 2) {
        const q = z[o + n] * 3, t = v ? tl : zl;
        (R = t[q]), (G = t[q + 1]), (B = t[q + 2]);
      } else {
        const q = v * 3;
        (R = lut[q]), (G = lut[q + 1]), (B = lut[q + 2]);
      }
      if (glow > 0.01) (R += (255 - R) * glow), (G += (255 - G) * glow), (B += (255 - B) * glow);
      if (edgeY || (c > 2 && x % c === c - 1)) (R *= 0.45), (G *= 0.45), (B *= 0.45);
      display.setPixel(x, y, R, G, B);
    }
  }
}
