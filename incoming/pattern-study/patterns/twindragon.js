// ===== Patternflow pattern =====
// Title:   Twindragon
// Family:  fractal
// Idea:    Every other LED is a Gaussian integer written in base -1+i, the panel is tiled with twindragons of 512 numbers each in its own dim hue, and a bright window counts through all of them at once, so its shape is always a few smaller twindragons that turn 135 degrees with every digit the count carries.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: base -1+i numeration (Walter Penney, 1965), twindragon (Chandler Davis and Donald Knuth, 1970), pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Digits=9..12, Split=1..8
//
// Knob 1: Hue. Turns every tile round the wheel together: at 0 the tiles are teal, blue and magenta, a little warmer towards the bottom, and the windows run from white at the newest number to the tile's own hue.
// Knob 2: Speed. How fast the count runs: at 2 one pass through the 512 numbers of a tile takes 8 s, 64 numbers a second; at 0.2 ten times slower, at 3 one and a half times faster. A tile of more digits counts faster, so a pass only grows by the square root of 2 a digit, as the tile's width does: 22.6 s at 12.
// Knob 3: Digits. K, the digits each number in a tile has, 9 to 12. A tile holds 2^K numbers and the panel's 4096 lattice LEDs hold exactly 4096 / 2^K tiles' worth, so every number shows 8 times at 9 (15 tiles touch the panel), 4 at 10, 2 at 11 and once at 12, where the pieces of six tiles add up to one. A digit more turns the tiles 135 degrees and makes them 1.41 times wider.
// Knob 4: Split. How many windows share the bright 18.5%, spread evenly through the count. At 1, 2, 4 and 8 each window runs through its own half, quarter or eighth of the tile, all the same shape: the twindragon is two, four or eight smaller ones. At 3, 5, 6 and 7 the gap between windows is not a power of two, so they start at different places in the count and come out in different shapes.

const W = 64, H = 128;
const { floor, round, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Base -1+i (Penney, 1965). Every Gaussian integer a+bi has one finite
// expansion sum d_k (-1+i)^k with digits 0 and 1. The low digit is (a+b) mod 2;
// take it off and divide by -1+i: (a+bi)/(-1+i) = ((b-a) + (-a-b)i)/2.
// Checked in Node: all 160,801 points with |a|, |b| <= 200 end in at most 22
// digits and read back to themselves; the 2^22 strings of up to 22 digits give
// 2^22 different numbers, so none of those points has a second expansion; and
// for K = 2..12 the 2^K numbers of K digits are pairwise incongruent mod
// (-1+i)^K, so their copies moved by multiples of (-1+i)^K tile the lattice
// with no point twice.
//
// z = q (-1+i)^K + r, with r the K low digits. r read as a binary number is
// where z comes in the count; q names the tile.
//
// ---- On the panel z = a+bi sits at origin + (a-b, a+b), which is (1+i) z: the
// lattice is exactly the LEDs with x+y even, the others stay off.
const OX = 32, OY = 64;

// ---- Levels. Each lit LED has four dark neighbours, so the map's detail is
// the mean lit level / 255 and its edges are the share of lit LEDs over 40.
// The windows hold the first numbers at or above 18.5% of the count: 95 of
// 512 at K = 9. The panel is a whole number of tiles' worth for every K from 9
// to 12 (each number shows 2^(12-K) times), so 760 of the 4096 lattice LEDs
// are bright on every frame. Those sit at 255 and the other 81.45% dim at 40:
// detail = (0.8145 * 40 + 0.1855 * 255) / 255 = 0.313, edges = 0.186, inside
// the map's cell of edges under 0.21 and detail 0.297..0.375. Dim at 40 is
// still lit (over 24) and still a soft step (not over 40). Split and Digits
// move the bright share only between 18.5% and 18.8%.
const DIM = 40, SHARE = 0.185;

function layout(K) {
  const P = 1 << K, idx = new Int32Array(W * H).fill(-1), tile = new Int32Array(W * H);
  const keys = new Map();
  const ty = [], tc = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - OX, dy = y - OY;
      if ((dx + dy) & 1) continue;
      let a = (dx + dy) / 2, b = (dy - dx) / 2, r = 0;
      for (let k = 0; k < K; k++) {
        const d = (a + b) & 1;
        if (d) r |= 1 << k;
        a -= d;
        const na = (b - a) / 2;
        b = (-a - b) / 2;
        a = na;
      }
      const key = a * 4096 + b;
      let t = keys.get(key);
      if (t === undefined) {
        t = keys.size;
        keys.set(key, t);
        ty.push([0, 0]);
        tc.push((((a + b) % 3) + 3) % 3);
      }
      ty[t][0] += y;
      ty[t][1]++;
      idx[y * W + x] = r;
      tile[y * W + x] = t;
    }
  // A tile's hue follows its middle row down the panel, plus a step of 0.16
  // by (qa + qb) mod 3. A tile's six neighbours sit at q +-1, +-i and
  // +-(1+i), and none of those changes qa + qb by a multiple of 3, so two tiles
  // that touch never share a hue.
  const hue = ty.map(([s, n], t) => 0.12 * (s / n / H) + 0.16 * tc[t]);
  return { K, P, idx, tile, hue };
}

export function setup(params) {
  params.s = { t: 0, n: 0, L: null, hue: 0, split: 1 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 9, 1], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), K = cl(round(k[2]), 9, 12);
  S.split = cl(round(k[3]), 1, 8);
  if (!S.L || S.L.K !== K) {
    // Keep the place in the pass when the tile size changes.
    const u = S.L ? S.n / S.L.P : 0.25;
    S.L = layout(K);
    S.n = u * S.L.P;
  }
  // 64 numbers a second at Speed 2 for K = 9, times sqrt 2 a digit more.
  const rate = 32 * speed * Math.pow(sqrt(2), K - 9);
  S.n = (S.n + d * rate) % S.L.P;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.L) return;
  const { P, idx, tile, hue } = S.L, m = S.split, n = floor(S.n);
  const cols = hue.map((h) => {
    const c = hsv(0.48 + S.hue + h, 0.8, 1);
    return [round(c[0] * DIM), round(c[1] * DIM), round(c[2] * DIM), 0.48 + S.hue + h];
  });
  for (let p = 0; p < W * H; p++) {
    const r = idx[p];
    if (r < 0) continue;
    const c = cols[tile[p]];
    // How far back in the count this number is, as a share of the pass.
    const ph = (((n - r) % P) + P) % P / P, f = ph * m - floor(ph * m);
    const x = p % W, y = (p - x) / W;
    if (f < SHARE) {
      // Bright: white at the newest number, the tile's own hue at the oldest,
      // the brightest channel 255 all along.
      const s = f / SHARE, b = hsv(c[3], 0.1 + 0.8 * s, 1);
      display.setPixel(x, y, round(b[0] * 255), round(b[1] * 255), round(b[2] * 255));
    } else display.setPixel(x, y, c[0], c[1], c[2]);
  }
}
