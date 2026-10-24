// ===== Patternflow pattern =====
// Title:   Hammersley Lines
// Family:  algo
// Idea:    Points rain onto the panel as a Poisson process with the origin at the bottom left, and L(x, y), the longest chain of points rising to the right inside the box from the origin to (x, y), is drawn as coloured bands between its level lines, Hammersley's lines, which step down to the right with a corner on a point and close in on the hyperbolas xy = constant as the points pile up, while the longest chain to the far corner is traced in gold.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ulam's problem and Hammersley's process (John Hammersley, 1972), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Points=200..1000, Bands=0..1
//
// Knob 1: Hue. Turns the band colours and the chain round the wheel together. At 0 the bands swing from cyan at L = 1 through blue and violet to magenta at L = 12 and back to cyan at L = 24, the level lines are the band colours paled and brighten for a third of a second when a landing moves them, the chain is gold and the points stay white.
// Knob 2: Speed. How fast the points come. At 2 the whole count arrives in about 6 s, 33 points a second at the start, and each falls from the top edge at 320 rows a second; at 0.2 the count takes a minute and at 3 it takes 4 s. When the last point lands the picture holds 1.2 s and fades out as the next rain begins.
// Knob 3: Points. How many points fall before the panel starts again, 200 to 1,000. The longest chain then comes out near 2 sqrt(n) - 1.77 n^(1/6): 23 to 29 over twelve rains of 200 against 24 from the formula, and 54 to 64 for 1,000 against 58. Near the top right corner the lines stand about 4 LEDs apart across and 9 up at 200, 2 across and 4 up at 1,000.
// Knob 4: Bands. How bright the bands between the level lines are. At 0 the lines alone on black; at 0.06 odd levels at 29% and even ones at 16%; at 1 at 90% and 50%, solid colour with the lines barely paler.
// Buttons: K1 tap starts a new rain of points on an empty panel while the old picture fades in 0.4 s.

const W = 64, H = 128, N = W * H, MAXN = 1100;
const { floor, exp, log, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Drops fall this many rows a second at Speed 2.
const FALL = 320;
const HOLD = 1.2;

const C = [0, 0, 0];
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = h | 0, f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  if (i === 0) (C[0] = v), (C[1] = t), (C[2] = p);
  else if (i === 1) (C[0] = q), (C[1] = v), (C[2] = p);
  else if (i === 2) (C[0] = p), (C[1] = v), (C[2] = t);
  else if (i === 3) (C[0] = p), (C[1] = q), (C[2] = v);
  else if (i === 4) (C[0] = t), (C[1] = p), (C[2] = v);
  else (C[0] = v), (C[1] = p), (C[2] = q);
}

function clear(P) {
  P.n = 0;
  P.nd = 0;
  P.made = 0;
  P.next = 0;
  P.hold = -1;
  P.top = 0;
  P.M.fill(0);
  P.prevM.fill(0);
  P.glow.fill(0);
  P.dirty = true;
}

export function setup(params) {
  const F = (n) => new Float32Array(n), I = (n) => new Int32Array(n);
  params.s = {
    px: F(MAXN), py: F(MAXN), pt: F(MAXN), ell: I(MAXN), pred: I(MAXN), byX: I(MAXN), byY: I(MAXN), rank: I(MAXN), chain: I(MAXN),
    dx: F(MAXN), dy: F(MAXN), dt0: F(MAXN),
    fen: I(MAXN + 1), fenI: I(MAXN + 1), cell: I(N), M: I(N), prevM: I(N), glow: F(N),
    gold: new Uint8Array(N), oldR: F(N), oldG: F(N), oldB: F(N), cr: F(N), cg: F(N), cb: F(N),
    n: 0, nd: 0, made: 0, next: 0, hold: -1, clock: 0, oldA: 0, target: 200, hue: 0, speed: 2, fill: 0.3, top: 0, dirty: true,
  };
  clear(params.s);
}

// Puts point k into a list kept sorted by one coordinate.
function insert(list, key, k) {
  let lo = 0, hi = k;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (key[list[m]] < key[k]) lo = m + 1;
    else hi = m;
  }
  for (let j = k; j > lo; j--) list[j] = list[j - 1];
  list[lo] = k;
}

// A drop lands and becomes a point.
function land(P, x, y) {
  const k = P.n++;
  (P.px[k] = x), (P.py[k] = y), (P.pt[k] = P.clock);
  insert(P.byX, P.px, k);
  insert(P.byY, P.py, k);
  P.dirty = true;
}

// Longest chains. Taking the points left to right, the longest chain ending at
// a point is one more than the longest ending at any earlier point below it;
// a Fenwick tree over the points' height ranks keeps the best so far below
// every height.
// Then L on the pixel grid: L(x, y) is the longest chain among the points in
// the box from the origin to the pixel's top right corner.
function chains(P) {
  const { px, py, ell, pred, byX, byY, rank, fen, fenI, cell, M, chain } = P, n = P.n;
  for (let a = 0; a < n; a++) rank[byY[a]] = a;
  fen.fill(0);
  fenI.fill(-1);
  let best = 0, bestI = -1;
  for (let a = 0; a < n; a++) {
    const p = byX[a], b = rank[p];
    let l = 0, li = -1;
    for (let i = b; i > 0; i -= i & -i) if (fen[i] > l) (l = fen[i]), (li = fenI[i]);
    ell[p] = l + 1;
    pred[p] = li;
    for (let i = b + 1; i <= n; i += i & -i) if (fen[i] < l + 1) (fen[i] = l + 1), (fenI[i] = p);
    if (l + 1 > best) (best = l + 1), (bestI = p);
  }
  P.top = best;
  let c = 0;
  for (let p = bestI; p >= 0; p = pred[p]) chain[c++] = p;
  cell.fill(0);
  for (let p = 0; p < P.n; p++) {
    const i = floor(py[p]) * W + floor(px[p]);
    if (ell[p] > cell[i]) cell[i] = ell[p];
  }
  for (let j = 0; j < H; j++)
    for (let x = 0; x < W; x++) {
      const i = j * W + x;
      let v = cell[i];
      if (x > 0 && M[i - 1] > v) v = M[i - 1];
      if (j > 0 && M[i - W] > v) v = M[i - W];
      M[i] = v;
    }
  // The longest chain as a gold path from the origin through its points to
  // the far corner.
  const { gold } = P;
  gold.fill(0);
  if (!c) return;
  let x0 = 0, y0 = 0;
  for (let k = c - 1; k >= -1; k--) {
    const x1 = k >= 0 ? px[chain[k]] : W - 0.5, y1 = k >= 0 ? py[chain[k]] : H - 0.5;
    const steps = max(1, Math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * 2));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps, xx = floor(x0 + (x1 - x0) * u), yy = floor(y0 + (y1 - y0) * u);
      gold[yy * W + xx] = 1;
    }
    (x0 = x1), (y0 = y1);
  }
}

function restart(P) {
  P.oldA = 1;
  P.oldR.set(P.cr);
  P.oldG.set(P.cg);
  P.oldB.set(P.cb);
  clear(P);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, kv = input.knobValues || [0, 2, 200, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = kv[0];
  P.speed = cl(kv[1], 0.2, 3);
  P.target = floor(cl(kv[2], 200, 1000));
  P.fill = 0.9 * cl(kv[3], 0, 1) ** 0.4;
  P.clock += d;
  P.oldA *= exp(-d / 0.4);
  if (input.btnPressed && input.btnPressed[0]) restart(P);
  // Poisson arrivals at the top of the panel: target points in 12 / Speed
  // seconds. Each falls straight down to its place and lands there.
  const rate = (P.target * P.speed) / 12;
  if (P.hold < 0) {
    P.next -= d;
    while (P.next <= 0 && P.made < P.target) {
      const k = P.nd++;
      (P.dx[k] = Math.random() * W), (P.dy[k] = Math.random() * H), (P.dt0[k] = P.clock + P.next);
      P.made++;
      P.next += -log(1 - Math.random()) / rate;
    }
  }
  // Drops: dy is the landing height from the bottom; a drop starts at the top.
  let w = 0;
  for (let k = 0; k < P.nd; k++) {
    const fallen = (P.clock - P.dt0[k]) * FALL * (0.6 + 0.2 * P.speed);
    if (fallen >= H - P.dy[k]) land(P, P.dx[k], P.dy[k]);
    else (P.dx[w] = P.dx[k]), (P.dy[w] = P.dy[k]), (P.dt0[w] = P.dt0[k]), w++;
  }
  P.nd = w;
  if (P.dirty) {
    P.prevM.set(P.M);
    chains(P);
    // A landing lifts L by one wherever the new point lengthens the best
    // chain; the level lines there flash white as they move.
    const { M, prevM, glow } = P;
    for (let i = 0; i < N; i++) if (M[i] !== prevM[i]) glow[i] = 1;
    P.dirty = false;
  }
  const g = exp(-d / 0.35), { glow } = P;
  for (let i = 0; i < N; i++) glow[i] *= g;
  if (P.hold < 0 && P.made >= P.target && P.nd === 0) P.hold = 0;
  else if (P.hold >= 0 && (P.hold += d) > HOLD) restart(P);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { M, glow, gold, px, py, pt, cr, cg, cb, oldR, oldG, oldB } = P;
  const h0 = P.hue, fill = P.fill, oa = P.oldA, now = P.clock;
  for (let j = 0; j < H; j++)
    for (let x = 0; x < W; x++) {
      const i = j * W + x, L = M[i];
      let R = 0, G = 0, B = 0;
      const line = (x > 0 && M[i - 1] !== L) || (j > 0 && M[i - W] !== L);
      // Band colour swings between cyan and magenta and back every 24 levels.
      const ph = (L / 24) % 1, hue = h0 + 0.5 + 0.38 * (ph < 0.5 ? 2 * ph : 2 - 2 * ph);
      if (L > 0) {
        hsv(hue, 0.85, fill * (0.55 + 0.45 * (L & 1)));
        (R = C[0]), (G = C[1]), (B = C[2]);
      }
      if (line) {
        const gw = glow[i];
        hsv(hue, 0.5 - 0.2 * gw, 0.5 + 0.45 * gw);
        (R = max(R, C[0])), (G = max(G, C[1])), (B = max(B, C[2]));
      }
      if (gold[i]) {
        hsv(h0 + 0.12, 0.7, 1);
        (R = C[0]), (G = C[1]), (B = C[2]);
      }
      cr[i] = R * 255;
      cg[i] = G * 255;
      cb[i] = B * 255;
    }
  // Points: white, brightest on landing.
  for (let p = 0; p < P.n; p++) {
    const i = floor(py[p]) * W + floor(px[p]), v = 190 + 65 * exp(-(now - pt[p]) / 0.4);
    (cr[i] = max(cr[i], v)), (cg[i] = max(cg[i], v)), (cb[i] = max(cb[i], v));
  }
  // Falling drops: a short streak above the head.
  const sp = FALL * (0.6 + 0.2 * P.speed);
  for (let k = 0; k < P.nd; k++) {
    const head = H - (now - P.dt0[k]) * sp, x = floor(P.dx[k]);
    for (let s = 0; s < 4; s++) {
      const y = floor(head) + s;
      if (y < 0 || y >= H || y < P.dy[k]) continue;
      const i = y * W + x, v = 200 - 45 * s;
      (cr[i] = max(cr[i], v * 0.8)), (cg[i] = max(cg[i], v * 0.9)), (cb[i] = max(cb[i], v));
    }
  }
  for (let j = 0; j < H; j++)
    for (let x = 0; x < W; x++) {
      const i = j * W + x;
      let R = cr[i], G = cg[i], B = cb[i];
      if (oa > 0.01) (R = max(R, oldR[i] * oa)), (G = max(G, oldG[i] * oa)), (B = max(B, oldB[i] * oa));
      display.setPixel(x, H - 1 - j, R, G, B);
    }
}
