// ===== Patternflow pattern =====
// Title:   Walsh Functions
// Family:  wave
// Idea:    The top half is the chart of all 64 two-dimensional Walsh functions on 8 by 8 LEDs, laid out in Walsh's sequency order, Paley's dyadic order or Sylvester's natural order, and the bottom half rebuilds a moving abstract picture from its Walsh-Hadamard coefficients, adding them one at a time in zigzag order over the chart, so the picture sharpens out of 8 by 8 blocks while the tile being added lights up above.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Walsh functions (Joseph L. Walsh, "A closed set of normal orthogonal functions", 1923), Sylvester's construction of Hadamard matrices (James Joseph Sylvester, 1867), Paley's dyadic ordering (Raymond Paley, 1932), pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Order=0..2, Drop=0..63
//
// Knob 1: Hue. Turns both halves round the wheel: at 0 the chart is a checkerboard of blue and pink tiles and the picture runs from navy through teal to pale cyan.
// Knob 2: Speed. How fast coefficients come: 6 a second at 2, so all 64 are in after 10.5 seconds; they leave three times faster and the count starts again. The picture drifts with it.
// Knob 3: Order. How the 64 functions are laid out, and so the order they are added in: 0 sequency (Walsh, 1923), where the number of sign changes grows to the right and down; 1 dyadic (Paley, 1932); 2 natural, the rows of Sylvester's Hadamard matrix. Turning it slides every tile to its new place and starts the count again.
// Knob 4: Drop. How many coefficients at the end of the zigzag are never added: 0 keeps all 64 and the picture comes back exactly; 48 keeps 16; 63 keeps only the mean of each 8 by 8 block. Dropped tiles go dark in the chart.

const S8 = 8;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The functions. Sylvester's matrix of order 8: row h, column x is
// +1 or -1 by the parity of the bits h and x share. That is the natural
// order. Paley's dyadic order takes row bitreverse(k), which multiplies
// the Rademacher square waves named by the bits of k; Walsh's sequency
// order takes row bitreverse(gray(k)), and its row k changes sign exactly
// k times. setup() counts the sign changes and throws if any is wrong.
const bits = (v) => { let n = 0; for (; v; v &= v - 1) n++; return n; };
const HAD = (h, x) => (bits(h & x) & 1 ? -1 : 1);
const rev3 = (k) => ((k & 1) << 2) | (k & 2) | ((k >> 2) & 1);
const gray = (k) => k ^ (k >> 1);
const ORDERS = [
  Array.from({ length: S8 }, (_, k) => rev3(gray(k))), // sequency
  Array.from({ length: S8 }, (_, k) => rev3(k)), // dyadic
  Array.from({ length: S8 }, (_, k) => k), // natural
];
const changes = (h) => { let n = 0; for (let x = 1; x < S8; x++) if (HAD(h, x) !== HAD(h, x - 1)) n++; return n; };
// Sequency of each natural row: 0 7 3 4 1 6 2 5.
const SEQ = Array.from({ length: S8 }, (_, h) => changes(h));

// JPEG's zigzag over the 8 by 8 chart: [column, row] in the order added.
const ZIG = [];
for (let s = 0; s < 2 * S8 - 1; s++)
  for (let i = 0; i <= s; i++) {
    const a = s & 1 ? i : s - i, b = s - a;
    if (a < S8 && b < S8) ZIG.push([b, a]);
  }

// In-place fast Walsh-Hadamard transform of an 8 by 8 block, rows then
// columns, natural order, whole numbers only: three rounds of sums and
// differences each way. Applied twice it gives the block back times 64.
function fwht(B) {
  for (let r = 0; r < 64; r += 8)
    for (let len = 1; len < 8; len <<= 1)
      for (let i = 0; i < 8; i += len << 1)
        for (let j = i; j < i + len; j++) {
          const a = B[r + j], b = B[r + j + len];
          B[r + j] = a + b;
          B[r + j + len] = a - b;
        }
  for (let c = 0; c < 8; c++)
    for (let len = 1; len < 8; len <<= 1)
      for (let i = 0; i < 8; i += len << 1)
        for (let j = i; j < i + len; j++) {
          const a = B[c + j * 8], b = B[c + (j + len) * 8];
          B[c + j * 8] = a + b;
          B[c + (j + len) * 8] = a - b;
        }
}

export function setup(params) {
  // The check the knob names promise: sequency rows change sign 0..7
  // times in order; a dyadic row's count is the Gray decoding of its index;
  // the rows are orthogonal.
  ORDERS[0].forEach((h, k) => { if (SEQ[h] !== k) throw new Error("sequency order is wrong at " + k); });
  ORDERS[1].forEach((h, k) => { let g = k; for (let m = k >> 1; m; m >>= 1) g ^= m; if (SEQ[h] !== g) throw new Error("dyadic order is wrong at " + k); });
  for (let a = 0; a < S8; a++)
    for (let b = 0; b < S8; b++) {
      let dot = 0;
      for (let x = 0; x < S8; x++) dot += HAD(a, x) * HAD(b, x);
      if (dot !== (a === b ? S8 : 0)) throw new Error("rows " + a + " and " + b + " are not orthogonal");
    }
  params.s = {
    T: 1, dir: 1, wait: 0, clock: 0, order: 0, knob: -1, slide: 1,
    from: null, img: new Int32Array(4096), rec: new Float64Array(4096), add: new Float64Array(4096), bump: 0,
    blk: new Int32Array(64), R: new Float64Array(64), keepW: new Float64Array(64), hue: 0, keep: 64,
  };
}

// Where each natural pair (hu, hv) sits on the chart in an order:
// [column, row, zigzag index].
function places(o) {
  const inv = new Int8Array(S8);
  ORDERS[o].forEach((h, k) => (inv[h] = k));
  const at = new Int8Array(S8 * S8);
  ZIG.forEach(([c, r], i) => (at[r * S8 + c] = i));
  const P = [];
  for (let hv = 0; hv < S8; hv++)
    for (let hu = 0; hu < S8; hu++) {
      const c = inv[hu], r = inv[hv];
      P.push([c, r, at[r * S8 + c]]);
    }
  return P;
}
const PLACES = [0, 1, 2].map(places);

// The picture, whole numbers 0..255 on 64 by 64: a turning square and a
// disc drifting past each other over a slowly turning ramp, brighter where
// they overlap.
function picture(S) {
  const t = S.clock, img = S.img;
  const sx = 30 + 10 * cos(t * 0.23), sy = 29 + 9 * sin(t * 0.31), a = t * 0.2, ca = cos(a), sa = sin(a);
  const dx = 33 + 14 * cos(t * 0.37 + 2), dy = 35 + 13 * sin(t * 0.29 + 1);
  const th = t * 0.13, ux = cos(th), uy = sin(th);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const px = x + 0.5, py = y + 0.5;
      const lx = (px - sx) * ca + (py - sy) * sa, ly = (py - sy) * ca - (px - sx) * sa;
      const sq = cl(0.5 - max(abs(lx), abs(ly)) + 12.5, 0, 1);
      const dc = cl(11.5 - sqrt((px - dx) ** 2 + (py - dy) ** 2), 0, 1);
      const v = 0.1 + 0.14 * (((px - 32) * ux + (py - 32) * uy) / 45) + 0.5 * sq + 0.4 * dc;
      img[y * 64 + x] = round(cl(v, 0, 1) * 255);
    }
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.05, 3);
  S.hue = k[0];
  S.keep = 64 - cl(round(k[3]), 0, 63);
  const o = cl(round(k[2]), 0, 2);
  if (S.knob < 0) (S.knob = S.order = o), (S.from = PLACES[o]);
  else if (o !== S.order) {
    // Slide from wherever the tiles are now, and count again from one.
    S.from = current(S);
    S.order = o;
    S.slide = 0;
    S.T = 1;
    S.dir = 1;
    S.wait = 0.4;
  }
  S.slide = min(1, S.slide + dt / 0.9);
  S.clock += dt * sp * 0.5;
  // The count: up at 3 x Speed a second to keep, a pause, down three times
  // faster, a pause, again.
  const rate = 3 * sp;
  if (S.wait > 0) S.wait -= dt;
  else if (S.dir > 0) {
    S.T = min(S.keep, S.T + dt * rate);
    if (S.T >= S.keep) (S.dir = -1), (S.wait = 1.4);
  } else {
    S.T = max(1, S.T - dt * rate * 3);
    if (S.T <= 1) (S.dir = 1), (S.wait = 0.6);
  }
  if (S.T > S.keep) S.T = S.keep;

  // Transform every 8 by 8 block of the picture, then rebuild it from the
  // first floor(T) coefficients in zigzag order and a share of the next.
  picture(S);
  const { img, rec, add, blk, keepW, R } = S;
  const n = floor(S.T), part = S.T - n, P = PLACES[S.order];
  let fN = -1;
  P.forEach(([, , i], f) => {
    keepW[f] = i < n ? 1 : i === n && n < S.keep ? part : 0;
    if (i === n && n < S.keep) fN = f;
  });
  S.bump = fN < 0 ? 0 : sin(PI * part);
  for (let by = 0; by < 8; by++)
    for (let bx = 0; bx < 8; bx++) {
      const o0 = by * 512 + bx * 8;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blk[y * 8 + x] = img[o0 + y * 64 + x];
      fwht(blk);
      // What the coefficient now fading in adds to this block: its own
      // basis image, as large as the coefficient.
      const c = fN < 0 ? 0 : blk[fN] / 64;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) add[o0 + y * 64 + x] = c * HAD(fN & 7, x) * HAD(fN >> 3, y);
      // Inverse: the same transform on the kept coefficients, over 64. Kept
      // whole, they stay whole numbers; only the one fading in is a share.
      for (let f = 0; f < 64; f++) R[f] = blk[f] * keepW[f];
      fwht(R);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) rec[o0 + y * 64 + x] = R[y * 8 + x] / 64;
    }
}

// Where the tiles are drawn now: on the way from the old layout to the new.
function current(S) {
  const to = PLACES[S.order], e = smooth(S.slide);
  return to.map(([c, r, i], f) => [S.from[f][0] + (c - S.from[f][0]) * e, S.from[f][1] + (r - S.from[f][1]) * e, i]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S.from) return;
  const pos = current(S);
  const T = S.T, keep = S.keep;
  // The chart. Tile f is the natural pair (hu, hv) = (f % 8, f / 8); its
  // colour belongs to the function, by its two sequencies, so it travels
  // with the tile: a checkerboard of two hues in sequency order.
  for (let f = 0; f < 64; f++) {
    const hu = f & 7, hv = f >> 3, su = SEQ[hu], sv = SEQ[hv], i = PLACES[S.order][f][2];
    const hueF = 0.59 + S.hue + 0.31 * ((su + sv) & 1) + (0.06 * (su + sv)) / 14;
    let L, flash = 0;
    if (i >= keep) L = 0.1;
    else {
      const inn = cl(T - i, 0, 1);
      flash = T > i ? exp(-(T - i) * 0.8) : 0;
      L = 0.34 + 0.5 * inn;
    }
    const [pr, pg, pb] = hsv(hueF, 0.75 - 0.6 * flash, min(1, L + 0.5 * flash));
    const [nr, ng, nb] = hsv(hueF, 0.6, 0.04 + 0.06 * L + 0.25 * flash);
    const ox = round(pos[f][0] * 8), oy = round(pos[f][1] * 8);
    for (let y = 0; y < 8; y++) {
      const sy = HAD(hv, y);
      for (let x = 0; x < 8; x++) {
        const plus = HAD(hu, x) * sy > 0;
        display.setPixel(ox + x, oy + y, min(255, (plus ? pr : nr) * 255), min(255, (plus ? pg : ng) * 255), min(255, (plus ? pb : nb) * 255));
      }
    }
  }
  // The rebuilt picture below.
  const rec = S.rec;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const v = cl(rec[y * 64 + x] / 255, 0, 1);
      const [r, g, b] = hsv(0.6 + S.hue - 0.16 * v, 0.85 - 0.6 * v * v, 0.13 + 0.87 * v);
      // A white stamp of the term coming in, where it changes the picture.
      const w = S.bump * min(1, abs(S.add[y * 64 + x]) / 48) * 0.45;
      display.setPixel(x, 64 + y, min(255, (r + w) * 255), min(255, (g + w) * 255), min(255, (b + w) * 255));
    }
}
