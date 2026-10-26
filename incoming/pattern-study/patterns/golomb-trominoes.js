// ===== Patternflow pattern =====
// Title:   Golomb Trominoes
// Family:  cells
// Idea:    Two 64 x 64 boards, each short one cell, are tiled with 3-LED L trominoes exactly as Golomb's proof lays them, and as each board's blinking hole walks one LED at a time the trominoes between its old and new place re-lay in a white flash, one tromino inside a 2 x 2 block but up to 63 when it crosses the board's middle, while the field's hue marks the nested L-shaped shells of the proof closing in on the hole.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tromino tiling of the deficient 2^n board (Solomon W. Golomb, 1954), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lift=0..4, Cell=1..4
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the 2 x 2 trominoes are azure and navy in the outermost shell and turn cyan, aqua, green, lime and yellow shell by shell towards the hole; the 4 x 4 trominoes are plum, 8 x 8 gold, 16 x 16 lime and 32 x 32 rose, and the trominoes the proof lays round the hole, one a level, are white. At 0.5 the shells run orange, red, pink and violet and the levels aqua, blue and violet. The dim colours skip the orange and yellow part of the wheel, which reads brown and olive.
// Knob 2: Speed. The hole walks 9 LEDs a second for each unit, 18 at the opening 2, on a straight line that reflects off the board's edges. A step that stays inside a 2 x 2 block re-lays that one tromino; a step over the line between two blocks of side 2^k re-lays at most 2^k - 1 trominoes (3, 7, 15, 31, 63) and about two thirds of that on average. At 2 the two holes cross their board's middle at 0.8 s and 0.7 s and then on average every 3.5 s. 0.2 is ten times slower.
// Knob 3: Lift. Leaves the lowest levels of the proof unlaid. At 0 every tromino is laid; 1 to 4 leave whole blocks of 4, 8, 16 and 32 cells a side (on a 16-cell board no more than 8), each one square in its tone short the one cell that the trominoes above it, or the hole, took. Each such square is the proof's induction hypothesis: a smaller board short one cell, which the same proof tiles.
// Knob 4: Cell. LEDs to a cell: 1 below 1.5, 2 below 3.5, then 4, so each half of the panel is a board of 64, 32 or 16 cells a side, laid with 1365, 341 or 85 trominoes. The hole still walks 18 LEDs a second at Speed 2, so on the bigger cells it takes fewer, larger steps.

// Each half of the panel is one square board, W LEDs a side.
const W = 64, H = 128;
const { floor, min, max, exp, round, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Three colours are enough for Golomb's tiling, and they come from the
// proof itself. The 2 x 2 trominoes fill three quarters of the board in
// two tones: bright where the block is missing its top left or bottom
// right cell, dark where it is missing the other two. Two trominoes of the
// same tone never share an edge, and no two trominoes laid at a bigger
// level ever touch each other, so those all take the third colour, with
// its hue by the level that laid them. Checked for every hole of boards
// 16, 32 and 64 cells wide: the rule breaks on at most four edges, all
// within two cells of the hole.
// The field's hue says how far the cell sits from the hole in the proof:
// its shell is the smallest block holding both, and shell k is the three
// quarters of the hole's 2^k block that the hole is not in: an L tromino
// scaled up 2^(k-1) times. Outermost shell azure, then cyan, aqua, green,
// lime and yellow inwards.
const SHUE = [0.6, 0.5, 0.42, 0.34, 0.27, 0.2];
// Bigger levels: plum for 4 x 4, gold for 8 x 8, lime, rose. The board's
// middle tromino always lies round the hole and shows white.
const LHUE = [0, 0, 0.98, 0.13, 0.3, 0.98, 0.75];
// Palette slots: 2 (n - shell) + tone for the field (0 bright, 1 dark),
// 12 + level for levels 2..6, 19 for the trominoes the proof lays round
// the hole and 20 for the hole.
// The block sides Lift leaves unlaid: 1 lays every tromino; a 2 x 2 block
// short one cell is a tromino already, so the next is 4.
const LIFT = [0, 2, 3, 4, 5];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the wheel skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

function makeBoard(y0, u, v, ang) {
  const M = W * W;
  return {
    y0, u, v, dx: cos(ang), dy: sin(ang), hx: -1, hy: -1,
    lev: new Int8Array(M), ori: new Int8Array(M), lev2: new Int8Array(M), ori2: new Int8Array(M),
    bori: Array.from({ length: 7 }, () => new Int8Array(M)),
    rgb: new Float32Array(M * 3), flash: new Float32Array(M), fresh: true,
  };
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, lift: 0, c: 0, n: 6, S: 64, acc: 0, t: 0,
    // Two boards, one on each half of the panel, their holes set off on
    // straight lines that cross the boards' middles early.
    boards: [makeBoard(0, 0.37, 0.29, 0.56), makeBoard(H - W, 0.71, 0.4, 2.2)],
    pal: new Float32Array(63), palHue: -1,
  };
}

// Golomb's proof as a program: in a block with one cell taken, lay one
// tromino over the inner corners of the three quarters that do not hold
// it, and each of those quarters now has a cell taken too. Every cell
// records the level of the tromino that covers it (the block's side is
// 2^level) and which corner of the 2 x 2 at the block's centre that
// tromino leaves out.
function lay(B, n, hx, hy) {
  const S = 1 << n, lev = B.lev2, ori = B.ori2;
  lev[hy * S + hx] = 0;
  ori[hy * S + hx] = -1;
  const rec = (x0, y0, L, hx, hy) => {
    if (!L) return;
    const h = 1 << (L - 1), cx = x0 + h, cy = y0 + h, q = (hx >= cx ? 1 : 0) + (hy >= cy ? 2 : 0);
    B.bori[L][(y0 >> L) * (S >> L) + (x0 >> L)] = q;
    for (let k = 0; k < 4; k++) {
      const ix = cx - 1 + (k & 1), iy = cy - 1 + (k >> 1), qx = x0 + (k & 1 ? h : 0), qy = y0 + (k & 2 ? h : 0);
      if (k === q) rec(qx, qy, L - 1, hx, hy);
      else {
        lev[iy * S + ix] = L;
        ori[iy * S + ix] = q;
        rec(qx, qy, L - 1, ix, iy);
      }
    }
  };
  rec(0, 0, n, hx, hy);
}

// Shell of a cell: the side, as a level, of the smallest block holding both
// it and the hole.
const shellOf = (x, y, hx, hy) => 32 - Math.clz32((x ^ hx) | (y ^ hy));

// Move the hole one cell along its line: whichever of the two grid lines
// ahead it reaches first. At the board's edge the line reflects.
function step(B, S) {
  for (let guard = 0; guard < 4; guard++) {
    const px = B.u * S, py = B.v * S, cx = floor(px), cy = floor(py);
    const tx = B.dx > 0 ? (cx + 1 - px) / B.dx : B.dx < 0 ? (px - cx) / -B.dx : 1e9;
    const ty = B.dy > 0 ? (cy + 1 - py) / B.dy : B.dy < 0 ? (py - cy) / -B.dy : 1e9;
    if (tx <= ty) {
      const nx = cx + (B.dx > 0 ? 1 : -1);
      if (nx < 0 || nx >= S) {
        B.dx = -B.dx;
        continue;
      }
      B.u = (nx + (B.dx > 0 ? 1e-6 : 1 - 1e-6)) / S;
      B.v = (py + B.dy * tx) / S;
    } else {
      const ny = cy + (B.dy > 0 ? 1 : -1);
      if (ny < 0 || ny >= S) {
        B.dy = -B.dy;
        continue;
      }
      B.v = (ny + (B.dy > 0 ? 1e-6 : 1 - 1e-6)) / S;
      B.u = (px + B.dx * ty) / S;
    }
    return;
  }
}

// Re-lay the board for the hole's cell; every cell whose tromino changed
// flashes.
function relay(S, B, n) {
  const N = 1 << n, hx = cl(floor(B.u * N), 0, N - 1), hy = cl(floor(B.v * N), 0, N - 1);
  if (hx === B.hx && hy === B.hy && !B.fresh) return;
  lay(B, n, hx, hy);
  const M = N * N;
  for (let p = 0; p < M; p++) {
    if (!B.fresh && (B.lev[p] !== B.lev2[p] || B.ori[p] !== B.ori2[p])) B.flash[p] = 1;
    B.lev[p] = B.lev2[p];
    B.ori[p] = B.ori2[p];
  }
  if (B.fresh) B.flash.fill(0), (B.snap = true);
  B.fresh = false;
  B.hx = hx;
  B.hy = hy;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const c = [1, 1, 2, 2, 4][cl(round(kv[3]), 1, 4)];
  if (c !== S.c) {
    S.c = c;
    S.n = 6 - (c === 1 ? 0 : c === 2 ? 1 : 2);
    S.S = 64 / c;
    for (const B of S.boards) B.fresh = true;
  }
  const n = S.n, N = S.S;
  S.lift = min(LIFT[cl(round(kv[2]), 0, 4)], n - 1);
  // The hole walks nine LEDs a second for each unit of Speed, whatever the
  // cell size.
  S.t += d;
  S.acc += (d * S.speed * 9) / c;
  let steps = floor(S.acc);
  S.acc -= steps;
  for (const B of S.boards) {
    relay(S, B, n);
    for (let k = 0; k < steps; k++) {
      step(B, N);
      relay(S, B, n);
    }
    // Each cell eases to its slot's colour in about an eighth of a second,
    // so a shell that changes hue dissolves into the next; flashes fade.
    if (S.palHue !== S.hue) palette(S);
    const P = S.pal, u = S.lift, fv = B.snap ? 1 : min(1, d * 8), ff = exp(-d / 0.25), rgb = B.rgb;
    B.snap = false;
    for (let y = 0, p = 0; y < N; y++)
      for (let x = 0; x < N; x++, p++) {
        const o = B.ori[p], L = B.lev[p];
        const sh = shellOf(x, y, B.hx, B.hy);
        let k;
        if (o < 0) (k = 20), (B.flash[p] = 0);
        else if (L === sh && L > u) k = 19;
        else if (L > max(u, 1)) k = 12 + L;
        else {
          // Below the lift a cell takes the tone of its whole unlaid block.
          const q = u ? B.bori[u][(y >> u) * (N >> u) + (x >> u)] : o;
          k = 2 * (n - sh) + (q === 0 || q === 3 ? 0 : 1);
        }
        for (let e = 0; e < 3; e++) rgb[p * 3 + e] += (P[k * 3 + e] - rgb[p * 3 + e]) * fv;
        B.flash[p] *= ff;
      }
  }
}

function palette(S) {
  const P = S.pal, h = S.hue;
  for (let k = 0; k < 6; k++) {
    hsv(SHUE[k] + h, 0.72, 1, P, 6 * k);
    hsv(wheel(SHUE[k] + 0.05 + h), 0.9, 0.27, P, 6 * k + 3);
  }
  // The 4 x 4 trominoes are half bright, so their hue skips orange too.
  for (let L = 2; L <= 6; L++) hsv(L === 2 ? wheel(LHUE[2] + h) : LHUE[L] + h, 0.75, L === 2 ? 0.62 : 0.95, P, (12 + L) * 3);
  hsv(0.6 + h, 0.04, 1, P, 57);
  P[60] = P[61] = P[62] = 0;
  S.palHue = h;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.c) return;
  const c = S.c, N = S.S, blink = S.t * 3 - floor(S.t * 3) < 0.5;
  for (const B of S.boards) {
    for (let y = 0; y < W; y++) {
      const cy = floor(y / c);
      for (let x = 0; x < W; x++) {
        const p = cy * N + floor(x / c), o = p * 3, r = B.rgb;
        // The hole blinks white three times a second.
        const f = B.ori[p] < 0 ? (blink ? 1 : 0) : B.flash[p] * 0.8;
        display.setPixel(x, B.y0 + y, (255 * (r[o] + (1 - r[o]) * f)) | 0, (255 * (r[o + 1] + (1 - r[o + 1]) * f)) | 0, (255 * (r[o + 2] + (1 - r[o + 2]) * f)) | 0);
      }
    }
  }
}
