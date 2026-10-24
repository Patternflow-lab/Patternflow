// ===== Patternflow pattern =====
// Title:   Kari-Culik Tiles
// Family:  algo
// Idea:    Kari's fourteen Wang tiles cover the panel without ever repeating: each row of tiles multiplies a real number x by 2 or by 2/3, its top edges spelling x as a Beatty sequence of digits and its bottom edges the product, the carries passing sideways from tile to tile, and every tile is drawn as four triangles so the matching edges join into diamonds, blue for digits and warm or green for carries, while the tiling scrolls down through new rows reached by running the multiplication backwards.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Aperiodic Wang tiles from Beatty sequences (Jarkko Kari, 1996; Karel Culik II, 1996), Kari's set of 14, pattern round 35
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Start=0..1, Size=8..16
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the digit diamonds are navy for 0, steel blue for 1 and ice for 2; the carries of the times-2 rows are lime for 0 and sea green for -1, and those of the times-2/3 rows run violet, rose, orange and gold for -1/3, 0, 1/3 and 2/3.
// Knob 2: Speed. How fast the tiling slides: down 1.5 LEDs a second per unit and sideways 0.5, so at 2 a new row of 8-LED tiles comes in at the top every 2.7 s, and at 0.2 every 27 s.
// Knob 3: Start. The number x of the top row when the knob was last turned, anywhere in [2/3, 2): at 0 it is the square root of 2, and every other setting is a different tiling by the same 14 tiles.
// Knob 4: Size. Tile width in LEDs, in even steps: 8 gives 8 columns of 16 rows, 16 gives 4 columns of 8.
// Buttons: K1 tap lifts the tiles apart for three seconds, a gap of a quarter tile, so each one stands alone with its four triangles, then sets them back edge to edge.

// The rule behind the tiles. Write x by its Beatty digits
// a_n = floor((n + 1) x) - floor(n x), n over all the integers. A tile in a
// row that multiplies by q has a_n(x) on top, a_n(qx) underneath, the carry
// s_n = q floor(n x) - floor(n q x) on its left and s_(n+1) on its right, and
// q a_n + s_n = b_n + s_(n+1) holds for each one, so the row is a long
// multiplication done digit by digit. Rows stack with x_(i+1) = T(x_i),
// 2x on [2/3, 1) and 2x/3 on [1, 2); T maps [2/3, 2) onto itself one to one,
// so the rows can run either way. Kari states T on [1/2, 2], but [1/2, 2/3)
// has nothing above it, and a tiling that scrolls up for ever lives in
// [2/3, 2). No product of 2s and 2/3s is 1, so no row ever comes back.
//
// Counted over 5,400 rows from nine starts and 800 columns each, with exact
// arithmetic and the identity checked on every tile, the rows use exactly 14
// tiles, Kari's set: 4 that multiply by 2 and 10 by 2/3. The same count over
// Culik's rows (3x on [1/3, 2/3), x/2 on [2/3, 2)) gives 12, one of them the
// tile with 0 on all four edges, which covers the plane by itself. An
// aperiodic set cannot hold such a tile, so Culik's 13 are not this plain
// count, and the picture uses Kari's.
//
// In the log of x, T is a turn by log 2 round a circle log 3 long, so the
// kinds of row follow a Sturmian word: a times-2 row (37%, log 1.5 / log 3
// of them) is never next to another, and one or two times-2/3 rows lie
// between them.

const W = 64, H = 128;
const { floor, min, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const Z = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), THREE = BigInt(3), FOUR = BigInt(4);
// Start = 0 lands on the square root of 2.
const START = 0.5606601717798213;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Each row keeps x as an exact fraction p/q of BigInts. With floats the
// product drifts off the true 2x/3 in its last bit, and a test run that way
// turned up tiles with a carry of 1, which no row can have. The fractions
// grow by a bit a row: 10,000 rows up, seven hours at Speed 2, they are
// 10,053 bits long and one floor(n x) takes 9 microseconds.
function floorDiv(n, p, q) {
  const v = BigInt(n) * p;
  let d = v / q;
  if (v < Z && d * q !== v) d -= ONE;
  return Number(d);
}

function reduce(r) {
  while ((r.p & ONE) === Z && (r.q & ONE) === Z) (r.p >>= ONE), (r.q >>= ONE);
  while (r.p % THREE === Z && r.q % THREE === Z) (r.p /= THREE), (r.q /= THREE);
  // kind 0 multiplies by 2 (x < 1), kind 1 by 2/3.
  r.kind = r.p < r.q ? 0 : 1;
  r.F = new Map();
  return r;
}
const forward = (r) => reduce({ p: TWO * r.p, q: r.kind === 0 ? r.q : THREE * r.q });
// The row above: y/2 when y is 4/3 or more (it came from a times-2 row),
// 3y/2 below that (from a times-2/3 row).
const backward = (r) => reduce({ p: THREE * r.p >= FOUR * r.q ? r.p : THREE * r.p, q: TWO * r.q });

// floor(n x) for a row, kept per column while the row is on the panel.
function fx(r, n) {
  let v = r.F.get(n);
  if (v === undefined) r.F.set(n, (v = floorDiv(n, r.p, r.q)));
  return v;
}

// A new tiling with x at row index `at`. x is a fraction over 2^52, so the
// top row's digits repeat only after 2^52 columns.
function build(P, u, at) {
  const x = 2 / 3 + (4 / 3) * ((((u + START) % 1) + 1) % 1);
  const K = 2 ** 52;
  P.rows = new Map([[at, reduce({ p: BigInt(round(x * K)), q: BigInt(K) })]]);
  P.lo = P.hi = at;
  P.start = u;
}

function row(P, i) {
  while (i < P.lo) {
    const r = backward(P.rows.get(P.lo));
    P.rows.set(--P.lo, r);
  }
  while (i > P.hi) {
    const r = forward(P.rows.get(P.hi));
    P.rows.set(++P.hi, r);
  }
  return P.rows.get(i);
}

// Which part of a D x D tile each pixel shows: 0 top, 1 right, 2 bottom,
// 3 left, or 4 for a pixel on a diagonal, left dark so the triangles stay
// apart. Two triangles that meet across a tile edge always carry the same
// label, so the dark diagonals are all that is seen of the tile grid. A
// lifted tile stands alone in its gap and needs no seams: its diagonal
// pixels go to the top and bottom triangles.
function triangles(D, seams) {
  const t = new Uint8Array(D * D);
  for (let v = 0; v < D; v++)
    for (let u = 0; u < D; u++) {
      const dT = v, dB = D - 1 - v, dL = u, dR = D - 1 - u, m = min(dT, dB, dL, dR);
      const ties = (dT === m) + (dB === m) + (dL === m) + (dR === m);
      t[v * D + u] = seams && ties > 1 ? 4 : dT === m ? 0 : dB === m ? 2 : dR === m ? 1 : 3;
    }
  return t;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, size: 8, scroll: 0, pan: 0, lift: 0, liftT: -1,
    pal: new Float32Array(9 * 3), palHue: NaN, tri: new Map(), lab: new Int8Array(4),
  };
  build(params.s, 0, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 8], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.size = 2 * round(cl(k[3], 8, 16) / 2);
  // A turn of Start puts its x on the top row showing now, and the rest of
  // the tiling grows from there.
  const u = cl(k[2], 0, 1);
  if (u !== P.start) build(P, u, floor(-floor(P.scroll) / P.size));
  P.scroll += d * P.speed * 1.5;
  P.pan += d * P.speed * 0.5;
  if (input.btnPressed && input.btnPressed[0]) P.liftT = 0;
  if (P.liftT >= 0) {
    P.liftT += d;
    const t = P.liftT;
    P.lift = t < 0.5 ? sm(t / 0.5) : t < 3.5 ? 1 : sm((4 - t) / 0.5);
    if (t >= 4) (P.liftT = -1), (P.lift = 0);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const S = P.size, pal = P.pal, lab = P.lab;
  if (P.palHue !== P.hue) {
    // Labels 0-2 are the digits, a ramp in one blue; 3-4 the carries 0 and
    // -1 of the times-2 rows; 5-8 the carries -1/3, 0, 1/3, 2/3 of the
    // times-2/3 rows. Where the hue knob turns the blues to red, orange or
    // yellow the dark digits are laid lighter, as a dim orange reads brown.
    const c = [
      [0.62, 0.85, 0.45], [0.58, 0.62, 0.78], [0.53, 0.22, 1],
      [0.25, 0.8, 1], [0.45, 0.7, 0.9],
      [0.78, 0.7, 1], [0.92, 0.62, 1], [0.04, 0.72, 1], [0.12, 0.6, 1],
    ];
    for (let j = 0; j < 9; j++) {
      let [h, s, v] = c[j];
      h += P.hue;
      const hh = h - floor(h) > 0.9 ? h - floor(h) - 1 : h - floor(h), warm = sm((hh + 0.04) / 0.08) * sm((0.24 - hh) / 0.06);
      if (j < 2) (v += (0.85 - v) * warm), (s *= 1 - 0.25 * warm);
      hsv(h, s, v, pal, j * 3);
    }
    P.palHue = P.hue;
  }
  // The lift opens a gap of up to a quarter tile, in whole LEDs, and draws
  // each tile that much smaller in the middle of its cell.
  const gap = round(P.lift * (S / 4)), D = S - gap, off = gap >> 1;
  const key = 2 * D + (gap === 0 ? 1 : 0);
  let tri = P.tri.get(key);
  if (!tri) P.tri.set(key, (tri = triangles(D, gap === 0)));
  const sy = floor(P.scroll), sx = floor(P.pan);
  const i0 = floor(-sy / S), i1 = floor((H - 1 - sy) / S);
  const n0 = floor(sx / S), n1 = floor((W - 1 + sx) / S);
  for (let i = i0; i <= i1; i++) {
    const r = row(P, i), r2 = row(P, i + 1);
    for (let n = n0; n <= n1; n++) {
      const f0 = fx(r, n), f1 = fx(r, n + 1), g0 = fx(r2, n), g1 = fx(r2, n + 1);
      lab[0] = f1 - f0;
      lab[2] = g1 - g0;
      // Left and right carries: s = 2 floor(nx) - floor(2nx) is 0 or -1;
      // 3s = 2 floor(nx) - 3 floor(2nx/3) is -1, 0, 1 or 2.
      if (r.kind === 0) (lab[3] = 3 + g0 - 2 * f0), (lab[1] = 3 + g1 - 2 * f1);
      else (lab[3] = 6 + 2 * f0 - 3 * g0), (lab[1] = 6 + 2 * f1 - 3 * g1);
      const X0 = n * S - sx, Y0 = i * S + sy;
      for (let v = 0; v < S; v++) {
        const Y = Y0 + v;
        if (Y < 0 || Y >= H) continue;
        const tv = v - off;
        for (let u = 0; u < S; u++) {
          const X = X0 + u;
          if (X < 0 || X >= W) continue;
          const tu = u - off;
          const t = tv < 0 || tu < 0 || tv >= D || tu >= D ? 4 : tri[tv * D + tu];
          if (t === 4) {
            display.setPixel(X, Y, 0, 0, 0);
            continue;
          }
          const o = lab[t] * 3;
          display.setPixel(X, Y, pal[o] * 255, pal[o + 1] * 255, pal[o + 2] * 255);
        }
      }
    }
  }
  // Rows that have slid off the bottom are let go; the panel only ever
  // needs the rows from i0 down to i1 + 1.
  while (P.hi > i1 + 2) P.rows.delete(P.hi--);
}
