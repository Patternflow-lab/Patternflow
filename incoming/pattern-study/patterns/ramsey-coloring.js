// ===== Patternflow pattern =====
// Title:   Ramsey Coloring
// Family:  geometry
// Idea:    The 17 points of the Paley graph stand on a circle with every pair joined in one of two colours, the squares mod 17 in one and the non-squares in the other, each ring of chords of one length laid down in turn and its diagonals lit in the grid below, and then a scan runs through all 2,380 sets of four points and finds none with its six chords all one colour, the colouring that shows 17 points are not yet enough to force one (R(4,4) = 18), while on 29, 37 or 41 points the same rule has such sets and the scan flashes them.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ramsey's theorem (Frank Ramsey, 1930), Paley graphs from the quadratic-residue construction of Raymond Paley (1933), R(4,4) = 18 (Robert Greenwood and Andrew Gleason, 1955); the 3 by 5 digits of Kasiski Examination (pattern round 108); pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Points=-2..3, Multiplier=1..8
//
// Knob 1: Hue. Turns both colours round the wheel together, always opposite each other. At 0 the squares are pink and the non-squares green, the points are cream, and the sets of four that the scan looks at and finds are white.
// Knob 2: Speed. How fast the picture is drawn and scanned. At 2 the first chord lands at 0.3 s, the 8 rings of 17 take 2.5 s, the scan of 2,380 sets of four takes 3.4 s and the verdict is held for 3.2 s before the picture fades and is drawn again. 0.2 is ten times slower and 3 is half as fast again, and the gliding of the Multiplier keeps the same pace.
// Knob 3: Points. The number p of points, caught on whole numbers: -2 is 5, -1 is 13, 0 is 17, 1 is 29, 2 is 37, 3 is 41, the primes 1 mod 4 that fit. It opens at 17, where the scan finds nothing. A prime 1 mod 4 makes -1 a square, so a pair has one colour whichever way round it is read, and the picture starts again at the new p.
// Knob 4: Multiplier. Where each point is put on the circle: point i goes to the place u times i mod p, and the points glide there over 2.6 s from wherever they were. A square u (1, 2, 4 and 8 for 17) leaves the picture as it was, because x to ux is a symmetry of the graph, and a non-square u (3, 5, 6 and 7) draws it with the two colours swapped. The grid does not move, and the cream of each point shows where it went. It opens at 1.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, cos, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: K, 3 and 4 and the other digits, 3 wide and 5 tall, from kasiski-examination.js.
const FACE = {
  K: "#.#|#.#|##.|#.#|#.#",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const PRIMES = [5, 13, 17, 29, 37, 41]; // the primes 1 mod 4 that fit
const CX = 31.5, CY = 31.5, R = 28;      // the circle, in LED centres
const GY0 = 65, GH = 52; // the grid, rows 65 to 116
const T_B0 = 0.3, T_GAP = 0.35, TS = 3.4, DWELL = 0.7, HOLD = 3.2, FADE = 0.6, REST = 0.3;
const MORPH = 2.6;

// Everything that depends on p alone: which differences are squares mod p, the
// number of monochromatic triangles each ring completes, and the lexicographic
// rank of every monochromatic set of four, found by a pruned search through
// all of them. Kept for each p once built.
const CACHE = new Map();
function tables(p) {
  if (CACHE.has(p)) return CACHE.get(p);
  const sq = new Uint8Array(p);
  for (let x = 1; x < p; x++) sq[(x * x) % p] = 1;
  const cls = (a, b) => sq[(((a - b) % p) + p) % p]; // 1 for a square, 0 for a non-square
  const nr = (p - 1) / 2;
  const ring = (a, b) => {
    const d = abs(a - b);
    return min(d, p - d);
  };
  const triRing = new Int32Array(nr + 1);
  let tri = 0;
  for (let a = 0; a < p; a++)
    for (let b = a + 1; b < p; b++)
      for (let c = b + 1; c < p; c++) {
        const x = cls(b, a);
        if (cls(c, a) === x && cls(c, b) === x) {
          tri++;
          triRing[max(ring(a, b), ring(a, c), ring(b, c))]++;
        }
      }
  const ranks = [];
  let rank = 0;
  for (let a = 0; a < p; a++)
    for (let b = a + 1; b < p; b++)
      for (let c = b + 1; c < p; c++) {
        const x = cls(b, a), ok = cls(c, a) === x && cls(c, b) === x;
        for (let d = c + 1; d < p; d++, rank++) if (ok && cls(d, a) === x && cls(d, b) === x && cls(d, c) === x) ranks.push(rank);
      }
  // The three sets of four the scan will stand still on: in each third of the
  // scan, the one found that is spread widest round the circle, meaning its
  // smallest gap between neighbours is the largest, the first of them on a tie.
  const dwell = [], q = [0, 0, 0, 0];
  for (let w = 0; w < 3; w++) {
    let best = -1, bestGap = -1;
    for (const r of ranks) {
      if (r < (rank * w) / 3 || r >= (rank * (w + 1)) / 3) continue;
      unrank(p, r, q);
      const gap = min(q[1] - q[0], q[2] - q[1], q[3] - q[2], p - q[3] + q[0]);
      if (gap > bestGap) (bestGap = gap), (best = r);
    }
    if (best >= 0) dwell.push(best);
  }
  const T = { p, sq, nr, tri, triRing, ranks: Int32Array.from(ranks), dwell, c3: (p * (p - 1) * (p - 2)) / 6, c4: rank };
  CACHE.set(p, T);
  return T;
}

// The set of four with a given rank in lexicographic order.
function unrank(p, r, out) {
  const bin = (n, k) => {
    if (k > n) return 0;
    let v = 1;
    for (let i = 0; i < k; i++) v = (v * (n - i)) / (i + 1);
    return round(v);
  };
  let a = 0, c;
  while (r >= (c = bin(p - 1 - a, 3))) (r -= c), a++;
  let b = a + 1;
  while (r >= (c = bin(p - 1 - b, 2))) (r -= c), b++;
  let cc = b + 1;
  while (r >= p - 1 - cc) (r -= p - 1 - cc), cc++;
  out[0] = a;
  out[1] = b;
  out[2] = cc;
  out[3] = cc + 1 + r;
}

// How many ranks in the sorted list are at most r.
function countUpTo(ranks, r) {
  let lo = 0, hi = ranks.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (ranks[m] <= r) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, pi: 2, u: 1, uc: 1, uFrom: 1, uAt: 0, tau: 0, T: null,
    px: new Float32Array(41), py: new Float32Array(41), vA: new Float32Array(W * H), vB: new Float32Array(W * H), vW: new Float32Array(W * H),
    rgb: new Float32Array(W * H * 3), quad: [0, 1, 2, 3], dwell: [], morph: 1,
  };
  start(params.s, 2);
}

function start(S, pi) {
  S.pi = pi;
  const T = (S.T = tables(PRIMES[pi]));
  S.tau = 0;
  S.ringT = cl(2.5 / T.nr, 0.12, 0.42);
  S.tScan = T_B0 + T.nr * S.ringT + T_GAP;
  // The scan stands still for a moment at each of three sets of four it finds.
  S.dwell = [];
  for (const r of T.dwell) S.dwell.push((r + 0.5) / T.c4);
  S.tScanLen = TS + DWELL * S.dwell.length;
  S.tHoldEnd = S.tScan + S.tScanLen + HOLD;
  S.tEnd = S.tHoldEnd + FADE + REST;
}

// Where the scan is at a time: its progress from 0 to 1 through all the sets
// of four, and whether it is standing still on one it found.
function scanAt(S, ts) {
  let t = 0, s = 0;
  for (const x of S.dwell) {
    const tm = (x - s) * TS;
    if (ts < t + tm) return [s + (ts - t) / TS, false];
    t += tm;
    s = x;
    if (ts < t + DWELL) return [x, true];
    t += DWELL;
  }
  return [min(1, s + (ts - t) / TS), false];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const pi = cl(round(k[2]), -2, 3) + 2;
  if (pi !== S.pi) start(S, pi);
  const u = cl(round(k[3]), 1, 8) % S.T.p || 1;
  const c = d * (S.speed / 2);
  if (u !== S.u) {
    S.uFrom = S.uc;
    S.u = u;
    S.morph = 0;
  }
  S.morph = min(1, S.morph + c / MORPH);
  S.uc = S.uFrom + (S.u - S.uFrom) * sm(S.morph);
  S.tau += c;
  if (S.tau > S.tEnd) S.tau = 0;
}

// An antialiased line of constant strength into one of the layers, a pixel
// of the major axis at a time with the weight shared between the two pixels
// the line passes between. Strength meets strength by taking the larger.
function line(arr, x0, y0, x1, y1, v) {
  const dx = x1 - x0, dy = y1 - y0, steep = abs(dy) > abs(dx);
  let a0 = steep ? y0 : x0, a1 = steep ? y1 : x1, b0 = steep ? x0 : y0, b1 = steep ? x1 : y1;
  if (a0 > a1) {
    let t = a0;
    a0 = a1;
    a1 = t;
    t = b0;
    b0 = b1;
    b1 = t;
  }
  const len = a1 - a0, slope = len > 1e-6 ? (b1 - b0) / len : 0;
  for (let a = round(a0); a <= round(a1); a++) {
    const b = b0 + slope * (a - a0), bi = floor(b), f = b - bi;
    for (let j = 0; j < 2; j++) {
      const w = (j ? f : 1 - f) * v, bb = bi + j, x = steep ? bb : a, y = steep ? a : bb;
      if (x >= 0 && x < W && y >= 0 && y < H && w > arr[y * W + x]) arr[y * W + x] = w;
    }
  }
}

function glyph(rgb, ch, x0, y0, r, g, b) {
  const gl = GLYPH[ch];
  if (!gl) return;
  for (let i = 0; i < 15; i++) if (gl[i]) put(rgb, x0 + (i % 3), y0 + floor(i / 3), r, g, b);
}

function put(rgb, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  if (r > rgb[o]) rgb[o] = r;
  if (g > rgb[o + 1]) rgb[o + 1] = g;
  if (b > rgb[o + 2]) rgb[o + 2] = b;
}

function number(rgb, n, xr, y, r, g, b) {
  const s = String(n);
  for (let i = 0; i < s.length; i++) glyph(rgb, s[s.length - 1 - i], xr - 2 - i * 4, y, r, g, b);
}

function dot(rgb, x, y, rad, r, g, b) {
  for (let yy = floor(y - rad - 1); yy <= y + rad + 1; yy++)
    for (let xx = floor(x - rad - 1); xx <= x + rad + 1; xx++) {
      const w = cl(rad + 0.5 - sqrt((xx - x) * (xx - x) + (yy - y) * (yy - y)), 0, 1);
      if (w > 0) put(rgb, xx, yy, r * w, g * w, b * w);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.T, p = T.p, nr = T.nr, tau = S.tau;
  const { vA, vB, vW, rgb } = S;
  vA.fill(0);
  vB.fill(0);
  vW.fill(0);
  rgb.fill(0);
  const A = [0, 0, 0], B = [0, 0, 0], K = [0, 0, 0];
  hsv(S.hue + 0.9, 0.82, 1, A);
  hsv(S.hue + 0.4, 0.82, 1, B);

  // Where each label sits. Label i counts from the middle of the range so the
  // gliding to the multiplier is the same on both sides of the top.
  const px = S.px, py = S.py;
  for (let i = 0; i < p; i++) {
    const li = i > p / 2 ? i - p : i, a = -PI / 2 + (2 * PI * S.uc * li) / p;
    px[i] = CX + R * cos(a);
    py[i] = CY + R * sin(a);
  }

  const [sProg, dwelling] = scanAt(S, tau - S.tScan);
  const scanning = tau >= S.tScan && tau < S.tScan + S.tScanLen;
  const scanDone = tau >= S.tScan + S.tScanLen;
  const fade = 1 - sm((tau - S.tHoldEnd) / FADE);
  const rank = tau < S.tScan ? -1 : min(T.c4 - 1, floor(sProg * T.c4));
  const found = rank < 0 ? 0 : countUpTo(T.ranks, rank);

  // The rings: chord i of ring r joins labels i and i + r, laid down ring by
  // ring. A ring is bright while it is being laid and settles to a lower light,
  // which comes up a little once the scan is over.
  const verdict = sm((tau - S.tScan - S.tScanLen) / 0.8), floorV = 0.3 + 0.14 * verdict;
  const ringAct = (r) => exp(-max(0, tau - (T_B0 + r * S.ringT)) / 0.45);
  let tri = 0;
  for (let r = 1; r <= nr; r++) {
    const t0 = T_B0 + (r - 1) * S.ringT, arr = T.sq[r] ? vA : vB;
    if (tau < t0) break;
    let laid = 0;
    const lv = floorV + (1 - floorV) * ringAct(r);
    for (let i = 0; i < p; i++) {
      const tc = t0 + (i / p) * S.ringT * 0.8, al = sm((tau - tc) / 0.1);
      if (al <= 0) continue;
      laid += al > 0.99 ? 1 : 0;
      const j = (i + r) % p;
      line(arr, px[i], py[i], px[j], py[j], min(1, fade * al * lv));
    }
    if (laid >= p) tri += T.triRing[r];
  }

  // The grid: row i and column j hold the colour of the pair, a cell lit when
  // its ring has been laid. A strip along the left and top edges has the
  // labels' own light.
  const gc = floor(GH / p), gw = gc * p, gx = floor((W - gw) / 2), gy = GY0 + floor((GH - gw) / 2);
  const ramp = (i) => 0.4 + 0.6 * (i / (p - 1));
  hsv(0.13, 0.3, 1, K);
  for (let i = 0; i < p; i++)
    for (let j = 0; j < p; j++) {
      if (i === j) continue;
      const dd = abs(i - j), r = min(dd, p - dd), t0 = T_B0 + (r - 1) * S.ringT;
      const al = sm((tau - (t0 + (min(i, j) / p) * S.ringT * 0.8)) / 0.1) * fade;
      if (al <= 0) continue;
      const col = T.sq[r] ? A : B, v = (0.42 + 0.4 * ringAct(r)) * al;
      for (let yy = 0; yy < gc; yy++) for (let xx = 0; xx < gc; xx++) put(rgb, gx + j * gc + xx, gy + i * gc + yy, col[0] * 255 * v, col[1] * 255 * v, col[2] * 255 * v);
    }
  for (let i = 0; i < p; i++) {
    const v = ramp(i) * 0.9 * min(1, tau / 0.3);
    for (let q = 0; q < gc; q++) {
      put(rgb, gx - 2, gy + i * gc + q, K[0] * 255 * v, K[1] * 255 * v, K[2] * 255 * v);
      put(rgb, gx + i * gc + q, gy - 2, K[0] * 255 * v, K[1] * 255 * v, K[2] * 255 * v);
    }
  }

  // The scan. The set of four it is looking at, with a short trail of the ones
  // before, as six faint chords each; the last set of four found so far as six
  // bright ones, and its cells in the grid.
  const q = S.quad, hot = [];
  let lastFound = found > 0 ? T.ranks[found - 1] : -1, heat = 0;
  if (scanning && !dwelling) {
    const step = max(1, floor(T.c4 / (TS * 30 * 4)));
    for (let j = 3; j >= 0; j--) {
      const r = max(0, rank - j * step);
      unrank(p, r, q);
      for (let m = 0; m < 4; m++) for (let n = m + 1; n < 4; n++) line(vW, px[q[m]], py[q[m]], px[q[n]], py[q[n]], 0.42 * (1 - j * 0.22));
    }
    unrank(p, rank, q);
    for (let m = 0; m < 4; m++) {
      const v = 0.95 * min(1, (tau - S.tScan) / 0.15);
      
      for (let c = 0; c < gc; c++) {
        put(rgb, gx - 2, gy + q[m] * gc + c, 255 * v, 255 * v, 255 * v);
        put(rgb, gx + q[m] * gc + c, gy - 2, 255 * v, 255 * v, 255 * v);
      }
    }
  }
  if (lastFound >= 0) {
    heat = dwelling ? 1 : scanDone ? 0.85 + 0.15 * sin(tau * 5) : exp(-(rank - lastFound) / (T.c4 * 0.01));
    unrank(p, lastFound, q);
    for (let m = 0; m < 4; m++) hot.push(q[m]);
    for (let m = 0; m < 4; m++) for (let n = m + 1; n < 4; n++) line(vW, px[q[m]], py[q[m]], px[q[n]], py[q[n]], heat * fade);
    for (let m = 0; m < 4; m++)
      for (let n = 0; n < 4; n++) {
        if (m === n) continue;
        for (let yy = 0; yy < gc; yy++) for (let xx = 0; xx < gc; xx++) put(rgb, gx + q[n] * gc + xx, gy + q[m] * gc + yy, 255 * heat * fade, 255 * heat * fade, 255 * heat * fade);
      }
  }

  // The layers into colour.
  for (let o = 0; o < W * H; o++) {
    const a = vA[o], b = vB[o], w = vW[o];
    if (a + b + w <= 0) continue;
    // the stronger colour wins, with a little of the other
    const hi = a > b ? a : b, lo = a > b ? b : a, ca = a > b ? A : B, cb = a > b ? B : A;
    put(rgb, o % W, floor(o / W), (ca[0] * hi + cb[0] * lo * 0.3 + w) * 255, (ca[1] * hi + cb[1] * lo * 0.3 + w) * 255, (ca[2] * hi + cb[2] * lo * 0.3 + w) * 255);
  }

  // The points: lit by their label, white when in the set being looked at.
  const dr = p > 20 ? 1.1 : 1.7;
  for (let i = 0; i < p; i++) {
    const v = ramp(i) * min(1, tau / 0.3) * fade, on = hot.includes(i) ? heat : 0;
    dot(rgb, px[i], py[i], dr + on * 0.6, (K[0] * v + on) * 255, (K[1] * v + on) * 255, (K[2] * v + on) * 255);
  }
  // A held, steady ring round the circle when the scan has found nothing.
  if (scanDone && T.ranks.length === 0) {
    const v = 0.8 * sm((tau - S.tScan - S.tScanLen) / 0.8) * fade;
    for (let a = 0; a < 360; a++) put(rgb, round(CX + (R + 2.5) * cos((a * PI) / 180)), round(CY + (R + 2.5) * sin((a * PI) / 180)), 255 * v, 255 * v, 255 * v);
  }

  // The foot: monochromatic triangles and monochromatic sets of four, each as
  // a bar against what a random colouring would have, 1 in 4 and 1 in 32.
  const bars = [
    [117, "3", tri, T.c3 / 4],
    [123, "4", found, T.c4 / 32],
  ];
  for (const [y, ch, n, rnd] of bars) {
    const lv = 0.8 * fade, f = cl(n / rnd, 0, 1);
    glyph(rgb, "K", 1, y, 255 * lv, 255 * lv, 255 * lv);
    glyph(rgb, ch, 5, y, 255 * lv, 255 * lv, 255 * lv);
    for (let x = 0; x < 36; x++)
      for (let yy = 1; yy < 4; yy++) {
        const on = x < round(f * 36);
        const wv = on ? 0.95 : 0.14;
        put(rgb, 10 + x, y + yy, K[0] * 255 * wv * fade, K[1] * 255 * wv * fade, K[2] * 255 * wv * fade);
      }
    for (let yy = 0; yy < 5; yy++) put(rgb, 46, y + yy, 200 * fade, 200 * fade, 220 * fade);
    number(rgb, n, 63, y, 255 * lv, 255 * lv, 255 * lv);
  }
  // The number of points, K and p, at the top left.
  glyph(rgb, "K", 1, 1, 150 * fade, 150 * fade, 160 * fade);
  const ps = String(p);
  for (let i = 0; i < ps.length; i++) glyph(rgb, ps[i], 5 + i * 4, 1, 150 * fade, 150 * fade, 160 * fade);

  for (let o = 0; o < W * H; o++) display.setPixel(o % W, floor(o / W), min(255, rgb[o * 3]), min(255, rgb[o * 3 + 1]), min(255, rgb[o * 3 + 2]));
}
