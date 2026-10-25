// ===== Patternflow pattern =====
// Title:   Plancherel Growth
// Family:  data
// Idea:    A Young diagram grows one diamond box at a time by Robinson-Schensted insertion of random numbers, its corner on the left edge and its rows and columns running up and down the panel, and as the boxes pile up the diagram fills out toward the thin Logan-Shepp-Vershik-Kerov curve drawn for its final size, in rings coloured by arrival that are the same curve, smaller.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Plancherel growth of Young diagrams, with the limit shape of Benjamin Logan and Larry Shepp, and of Anatoly Vershik and Sergei Kerov (1977), pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=3..6, Curve=0..1
//
// Knob 1: Hue. Turns the arrival colours round the wheel: at 0 the first boxes in the corner are violet, then blue, cyan and green out to the last boxes at the edge; at 0.35 they run orange, red, magenta and violet to blue; at 0.6 green, yellow, orange and red to pink.
// Knob 2: Speed. At 2 the boxes come 27 a second: after a second's pause a diagram of 196 boxes grows in 7.3 seconds, holds for 3, then shrinks back into the corner in one, and a new random diagram starts. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Size. The half-diagonal of a box in LEDs, 3 to 6. The final count is chosen so the limit curve keeps its place on the panel: 196 boxes at 3, 110 at 4, 71 at 5, 49 at 6, and as the boxes come at the same rate the bigger ones fill it sooner.
// Knob 4: Curve. Brightness of the limit curve and of the two axes it leans on, from dim at 0 to white at 1. Past about 0.3 the boxes the limit shape expects but the diagram has not yet reached show faintly, each in the colour it is expected to arrive in.

const W = 64, H = 128, MIDY = 64;
const { floor, min, max, abs, sqrt, round, asin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The limit shape in Russian coordinates: u is the content j - i, v is
// i + j, both over the square root of the box count. A box is then a
// diamond of half-diagonal 1/sqrt(n) and area 2/n, so the area between
// Omega and |u| is 2 whatever n is (checked numerically: 2.0000, and an RSK
// run of 10000 boxes sits within 0.01 of the curve on average).
const omega = (u) => (abs(u) >= 2 ? abs(u) : (2 / PI) * (u * asin(u / 2) + sqrt(4 - u * u)));

// The unit of the limit shape on the panel, h sqrt(n) LEDs: the curve's
// middle sits 4/pi of it from the corner (53 LEDs) and its ends would meet
// the axes at twice it, past the right edge, so the curve leaves the panel
// 12 rows from the top and bottom. At 38 the full diagram lit a quarter of
// the panel and the picture changed too little while it grew (drift 0.20);
// at 42 it lights about a third.
const SCALE = 42;
// One cycle, in story seconds (one a second at Speed 2): an empty pause, the
// growth at BPS boxes a second, the hold on the full diagram, and the
// shrink back to the corner. The rate is in boxes, not in share of the
// diagram, so bigger boxes fill the curve sooner: 196 boxes take 7.3
// seconds and 49 take 1.8.
const PRE = 1, BPS = 27, HOLD = 3, SHRINK = 1;
// The seams between boxes keep this much of the box's colour, so each box
// reads as its own diamond.
const SEAM = 0.4;
// Rows and columns kept for a diagram: far more than any arm of 196 boxes reaches.
const M = 64;

export function setup(params) {
  params.s = {
    t: 0, hue: -1, speed: 2, size: 0, curveK: 0.06,
    h: 3, n: 0, sc: SCALE, phase: 0, cycleT: 0, shown: 0,
    rows: [], count: 0, arr: new Int16Array(M * M), col: null, colHue: NaN,
    cell: new Int32Array(W * H * 4), inner: new Uint8Array(W * H), lens: new Uint8Array(W * H),
    curveX: new Int16Array(H), expect: new Float32Array(M * M),
  };
}

// The pixel tables for box half-diagonal h. With A = x + y - 64 and
// B = x - y + 64, box (i, j) has its centre at A = (2j+1)h, B = (2i+1)h,
// so j = floor(A / 2h), i = floor(B / 2h), and a pixel with A or B a
// multiple of 2h lies on a seam between two boxes (four at a vertex).
function rebuild(S, h) {
  S.h = h;
  S.n = round((SCALE / h) ** 2);
  S.sc = h * sqrt(S.n);
  S.size = h;
  const cell = S.cell, h2 = 2 * h;
  cell.fill(-1);
  S.inner.fill(0);
  S.lens.fill(0);
  for (let y = 0; y < H; y++) {
    const xc = S.sc * omega((y - MIDY) / S.sc);
    S.curveX[y] = abs(y - MIDY) < 2 * S.sc ? round(xc) : -1;
    for (let x = 0; x < W; x++) {
      const A = x + y - MIDY, B = x - y + MIDY, p = y * W + x;
      if (A < 0 || B < 0) continue;
      const j = floor(A / h2), i = floor(B / h2), sa = A % h2 === 0, sb = B % h2 === 0;
      if (x <= xc) S.lens[p] = 1;
      if (!sa && !sb) {
        S.inner[p] = 1;
        cell[p * 4] = i < M && j < M ? i * M + j : -1;
        continue;
      }
      // A seam: the boxes on either side of it that exist.
      let n = 0;
      for (const [di, dj] of [[0, 0], [0, sa ? -1 : 0], [sb ? -1 : 0, 0], [sb ? -1 : 0, sa ? -1 : 0]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= M || jj >= M) continue;
        const c = ii * M + jj;
        if (n === 0 || cell[p * 4 + n - 1] !== c) cell[p * 4 + n++] = c;
      }
    }
  }
  // When the limit shape expects each box to be covered, kept as the square
  // root of the share k/n of the final count: the diagram after k boxes
  // hugs the curve scaled by sqrt(k/n), and those scaled curves are nested,
  // so it is the scale whose curve passes through the box's centre.
  const rn = sqrt(S.n);
  for (let i = 0; i < M; i++)
    for (let j = 0; j < M; j++) {
      const u = (j - i) / rn, v = (i + j + 1) / rn;
      if (v > omega(u)) {
        S.expect[i * M + j] = -1;
        continue;
      }
      let lo = 0, hi = 1;
      for (let it = 0; it < 24; it++) {
        const s = (lo + hi) / 2;
        if (s * omega(u / s) < v) lo = s;
        else hi = s;
      }
      S.expect[i * M + j] = hi;
    }
  S.colHue = NaN;
  restart(S);
}

// A fresh diagram: empty rows, and no box has arrived yet.
function restart(S) {
  S.rows = [];
  S.count = 0;
  S.shown = 0;
  S.arr.fill(-1);
  S.phase = 0;
  S.cycleT = 0;
}

// Robinson-Schensted row insertion of one uniform random number: into row 0
// it bumps the smallest entry bigger than itself into the next row, and so
// on; where nothing is bumped it goes on the end of the row, and that is the
// new box. After k insertions the shape is Plancherel-distributed.
function insert(S) {
  let x = Math.random(), r = 0;
  for (;;) {
    if (r === S.rows.length) S.rows.push([]);
    const row = S.rows[r];
    let lo = 0, hi = row.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (row[m] > x) hi = m;
      else lo = m + 1;
    }
    if (lo === row.length) {
      row.push(x);
      if (r < M && lo < M) S.arr[r * M + lo] = S.count;
      S.count++;
      return;
    }
    const y = row[lo];
    row[lo] = x;
    x = y;
    r++;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.curveK = cl(k[3], 0, 1);
  const h = cl(round(k[2]), 3, 6);
  if (h !== S.size) rebuild(S, h);
  const ds = (d * S.speed) / 2;
  S.cycleT += ds;
  if (S.phase === 0) {
    // Growing: the boxes come at an even rate, one random number each.
    const want = min(S.n, floor(BPS * max(0, S.cycleT - PRE)));
    while (S.count < want) insert(S);
    S.shown = S.count;
    if (S.count >= S.n) (S.phase = 1), (S.cycleT = 0);
  } else if (S.phase === 1) {
    if (S.cycleT >= HOLD) (S.phase = 2), (S.cycleT = 0);
  } else {
    // Shrinking back the way it came: the last box to arrive leaves first,
    // so the rings close in on the corner.
    S.shown = floor(S.n * (1 - cl(S.cycleT / SHRINK, 0, 1)));
    if (S.cycleT >= SHRINK) restart(S);
  }
}

// One colour per arrival. Colouring by arrival is the recording tableau of
// the insertion, so a box never changes colour once it is down (the
// inserted values do change as they are bumped). And it shows the
// mathematics: the boxes that came by the k-th hug the limit curve scaled
// by sqrt(k/n), so the hue runs with sqrt(k/n) and the colour bands are
// evenly spaced copies of the curve, nested in the corner.
function palette(S) {
  const n = S.n;
  S.col = new Float32Array(n * 3);
  for (let a = 0; a < n; a++) {
    const c = hsv(0.8 + S.hue - 0.5 * sqrt((a + 1) / n), 0.88, 1);
    S.col.set(c, a * 3);
  }
  S.colHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  if (S.colHue !== S.hue) palette(S);
  const { cell, inner, lens, arr, col, shown, expect } = S;
  const ck = S.curveK;
  // The limit curve and the axes: dim at 0, white at 1.
  const lineV = 0.42 + 0.58 * ck, axisV = 0.18 + 0.4 * ck;
  // The expected boxes show from about 0.3 up.
  const ghost = 0.3 * cl((ck - 0.25) / 0.75, 0, 1);
  for (let y = 0; y < H; y++) {
    const cx = S.curveX[y];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = 0, g = 0, b = 0;
      if (inner[p]) {
        const c = cell[p * 4];
        const a = c >= 0 ? arr[c] : -1;
        if (a >= 0 && a < shown) (r = col[a * 3]), (g = col[a * 3 + 1]), (b = col[a * 3 + 2]);
        else if (ghost > 0 && c >= 0 && lens[p] && expect[c] > 0) {
          const e = min(S.n - 1, floor(expect[c] * expect[c] * S.n)) * 3;
          (r = col[e] * ghost), (g = col[e + 1] * ghost), (b = col[e + 2] * ghost);
        }
      } else if (cell[p * 4] >= 0 || cell[p * 4 + 1] >= 0) {
        // A seam takes the colour of the first box beside it to arrive, so it
        // is set once and never changes while the diagram grows.
        let best = 1e9;
        for (let q = 0; q < 4; q++) {
          const c = cell[p * 4 + q];
          if (c < 0) break;
          const a = arr[c];
          if (a >= 0 && a < shown && a < best) best = a;
        }
        if (best < 1e9) (r = col[best * 3] * SEAM), (g = col[best * 3 + 1] * SEAM), (b = col[best * 3 + 2] * SEAM);
        // The two axes the diagram stands on: the outer seams of row 0 and
        // column 0.
        if (x + y === MIDY || x - y + MIDY === 0) {
          r = max(r, axisV * 0.85);
          g = max(g, axisV * 0.9);
          b = max(b, axisV);
        }
      }
      if (x === cx) {
        // The limit curve for the final count, drawn over everything.
        r = lineV;
        g = lineV * 0.96;
        b = lineV * 0.88;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
}
