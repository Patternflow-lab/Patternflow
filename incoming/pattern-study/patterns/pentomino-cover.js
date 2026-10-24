// ===== Patternflow pattern =====
// Title:   Pentomino Cover
// Family:  algo
// Idea:    A rectangle of sixty cells stands on the panel and Knuth's dancing links fill it with the twelve pentominoes as an exact cover, always placing a piece on the cell with the fewest choices left and taking pieces back out as it backs up, so the board flickers with pieces dropping in and leaving their outlines as they go, and each full cover holds for two seconds under a sweep of light and adds a tick below the board.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dancing Links and Algorithm X (Donald Knuth, 2000) on Solomon Golomb's pentominoes (1953), pattern round 34
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Board=0..3, Shuffle=0..1
//
// Knob 1: Hue. Turns the twelve piece colours, 30 degrees apart, together round the wheel. At 0 the F is sky blue, the I blue, the X green and the U red-orange; at 0.5 each piece takes the colour the piece six letters on had.
// Knob 2: Speed. Steps of the search a second, one step being a column chosen, a row tried or a step back: 5 at 0.2, where each piece can be followed in and out; 394 at 2, where the 6 by 10 search averages 1532 steps, about 4 seconds, from one cover to the next; 4457 at 3.
// Knob 3: Board. 0 is 6 by 10 cells of 10 LEDs, with 2339 covers; 1 is 5 by 12 of 10 LEDs, 1010 covers; 2 is 4 by 15 of 8 LEDs, 368 covers; 3 is 3 by 20 of 6 LEDs, where the whole search, 33,545 steps, finds only 2 covers before it starts again. Covers are counted once for each set of rotations and mirror images.
// Knob 4: Shuffle. How far the rows are shuffled when a search starts: at 0 every column tries its placements in the fixed order F to Z, top left first; at 0.06 a row moves by up to 12% of the list; at 1 the order is random and the same board gives other covers first. Turning it by more than 0.04 starts a new search.
// Buttons: K1 tap starts a new search in a new shuffled order.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, abs, pow, exp, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The twelve pentominoes, F I L N P T U V W X Y Z.
const PIECES = [
  [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
];
const P_ = 4, X_ = 9;
// Boards, columns by rows, and the LEDs a cell takes.
const BOARDS = [[6, 10, 10], [5, 12, 10], [4, 15, 8], [3, 20, 6]];

// Every distinct orientation of a piece: the four turns first, then the
// four turns of its mirror image, so flip marks the mirrored ones.
function orientations(cells) {
  const out = [], seen = new Set();
  for (let f = 0; f < 2; f++)
    for (let q = 0; q < 4; q++) {
      let c = cells.map(([x, y]) => (f ? [-x, y] : [x, y]));
      for (let k = 0; k < q; k++) c = c.map(([x, y]) => [-y, x]);
      const mx = min(...c.map((p) => p[0])), my = min(...c.map((p) => p[1]));
      c = c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const key = c.join(";");
      if (!seen.has(key)) seen.add(key), out.push({ cells: c, flip: f });
    }
  return out;
}
const ORIENT = PIECES.map(orientations);

// The exact cover matrix: one column per piece, one per cell, and one
// secondary column that keeps the count to solutions up to symmetry. The X
// may only sit in the board's first quarter; when it sits on a mirror line
// of the board the P may not be mirrored, and the secondary column holds
// those two choices apart.
function placements(bw, bh) {
  const rows = [];
  PIECES.forEach((_, pi) => {
    for (const o of ORIENT[pi]) {
      const ow = max(...o.cells.map((p) => p[0])) + 1, oh = max(...o.cells.map((p) => p[1])) + 1;
      for (let y = 0; y + oh <= bh; y++)
        for (let x = 0; x + ow <= bw; x++) {
          let sec = pi === P_ && o.flip === 1;
          if (pi === X_) {
            const cx = x + 1, cy = y + 1;
            if (2 * cx > bw - 1 || 2 * cy > bh - 1) continue;
            sec = (bw % 2 === 1 && 2 * cx === bw - 1) || (bh % 2 === 1 && 2 * cy === bh - 1);
          }
          rows.push({ piece: pi, cells: o.cells.map(([a, b]) => (y + b) * bw + x + a), sec });
        }
    }
  });
  return rows;
}

const MAXN = 16000;
function newSearch(S, again) {
  const [bw, bh] = BOARDS[S.board];
  const rows = placements(bw, bh);
  // Shuffle moves each row by up to twice that share of the list. A search
  // started again keeps the order it had.
  if (!again) S.jit = rows.map(() => random());
  const key = rows.map((_, i) => i / rows.length + 2 * S.shuffle * S.jit[i]);
  const order = rows.map((_, i) => i).sort((a, b) => key[a] - key[b]);
  const NC = 12 + bw * bh, SEC = NC + 1;
  const { L, R, U, D, C, RW, SZ } = S;
  for (let c = 0; c <= NC; c++) (L[c] = c - 1), (R[c] = c + 1), (U[c] = D[c] = C[c] = c), (SZ[c] = 0);
  L[0] = NC;
  R[NC] = 0;
  L[SEC] = R[SEC] = U[SEC] = D[SEC] = C[SEC] = SEC;
  let k = SEC + 1;
  S.rows = order.map((i) => rows[i]);
  S.rows.forEach((r, ri) => {
    const cols = [1 + r.piece, ...r.cells.map((c) => 13 + c)];
    if (r.sec) cols.push(SEC);
    const first = k;
    for (const c of cols) {
      C[k] = c;
      RW[k] = ri;
      U[k] = U[c];
      D[k] = c;
      D[U[c]] = k;
      U[c] = k;
      SZ[c]++;
      L[k] = k - 1;
      R[k] = k + 1;
      k++;
    }
    L[first] = k - 1;
    R[k - 1] = first;
  });
  S.bw = bw;
  S.bh = bh;
  S.cs = BOARDS[S.board][2];
  S.k = 0;
  S.mode = 0;
  S.done = false;
  S.found = 0;
  S.hold = 0;
  S.cell.fill(-1);
  S.age.fill(9);
  S.ghost.fill(-1);
  S.gAge.fill(9);
  S.builtBoard = S.board;
  S.builtShuffle = S.shuffle;
}

function cover(S, c) {
  const { L, R, U, D, C, SZ } = S;
  L[R[c]] = L[c];
  R[L[c]] = R[c];
  for (let i = D[c]; i !== c; i = D[i])
    for (let j = R[i]; j !== i; j = R[j]) (U[D[j]] = U[j]), (D[U[j]] = D[j]), SZ[C[j]]--;
}
function uncover(S, c) {
  const { L, R, U, D, C, SZ } = S;
  for (let i = U[c]; i !== c; i = U[i])
    for (let j = L[i]; j !== i; j = L[j]) SZ[C[j]]++, (U[D[j]] = j), (D[U[j]] = j);
  L[R[c]] = c;
  R[L[c]] = c;
}
function place(S, node, on) {
  const r = S.rows[S.RW[node]];
  for (const c of r.cells) {
    if (on) (S.cell[c] = r.piece), (S.age[c] = 0);
    else (S.ghost[c] = S.cell[c]), (S.gAge[c] = 0), (S.cell[c] = -1);
  }
}

// Algorithm X, one node of the search tree a call: enter a level and cover
// the column with the fewest rows left, try its next row, or step back.
// Returns true when the board is full.
function searchStep(S) {
  const { L, R, D, C, SZ, col, row } = S;
  if (S.mode === 0) {
    if (R[0] === 0) {
      S.mode = 2;
      return true;
    }
    let c = R[0], best = 1e9;
    for (let j = R[0]; j !== 0; j = R[j]) if (SZ[j] < best) (best = SZ[j]), (c = j);
    cover(S, c);
    col[S.k] = c;
    row[S.k] = D[c];
    S.mode = 1;
  } else if (S.mode === 1) {
    const r = row[S.k];
    if (r === col[S.k]) {
      uncover(S, col[S.k]);
      S.mode = 2;
      return false;
    }
    for (let j = R[r]; j !== r; j = R[j]) cover(S, C[j]);
    place(S, r, true);
    S.k++;
    S.mode = 0;
  } else {
    if (S.k === 0) {
      S.done = true;
      return false;
    }
    S.k--;
    const r = row[S.k];
    place(S, r, false);
    for (let j = L[r]; j !== r; j = L[j]) uncover(S, C[j]);
    row[S.k] = D[r];
    S.mode = 1;
  }
  return false;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, board: 0, shuffle: 0.06, warm: false, acc: 0, sweep: 0,
    L: new Int32Array(MAXN), R: new Int32Array(MAXN), U: new Int32Array(MAXN), D: new Int32Array(MAXN),
    C: new Int32Array(MAXN), RW: new Int32Array(MAXN), SZ: new Int32Array(80), col: new Int32Array(16), row: new Int32Array(16),
    cell: new Int8Array(60), age: new Float32Array(60), ghost: new Int8Array(60), gAge: new Float32Array(60),
    key: new Int8Array(60), pc: new Int8Array(N), c: [0, 0, 0],
  };
}

// A full cover holds for HOLD seconds; the search takes rate(Speed) steps a
// second.
const HOLD = 2;
const rate = (sp) => 5 * pow(2, 3.5 * (sp - 0.2));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.board = cl(round(k[2]), 0, 3);
  S.shuffle = cl(k[3], 0, 1);
  const pressed = input.btnPressed && input.btnPressed[0];
  if (!S.warm || pressed || S.board !== S.builtBoard || abs(S.shuffle - S.builtShuffle) > 0.04) {
    newSearch(S);
    if (!S.warm) {
      // Open about 1100 steps short of the first full board, so at Speed 2
      // the first solution comes near 2.8 s.
      let n = 0;
      while (!searchStep(S) && !S.done) n++;
      newSearch(S, true);
      for (let i = 0; i < n - 1100; i++) searchStep(S);
      S.age.fill(9);
      S.ghost.fill(-1);
      S.warm = true;
    }
  }
  for (let c = 0; c < 60; c++) (S.age[c] += d), (S.gAge[c] += d);
  if (S.hold > 0) {
    S.hold = max(0, S.hold - d);
    S.sweep += d / HOLD;
    return;
  }
  if (S.done) {
    newSearch(S);
    return;
  }
  S.acc += d * rate(S.speed);
  while (S.acc >= 1) {
    S.acc--;
    if (searchStep(S)) {
      S.found++;
      S.hold = HOLD;
      S.sweep = 0;
      S.acc = 0;
      break;
    }
    if (S.done) break;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { bw, bh, cs, cell, age, ghost, gAge, key, pc, c } = S, base = S.hue + 0.55;
  const BW = bw * cs + 1, BH = bh * cs + 1, ox = floor((W - BW) / 2), oy = floor((H - BH) / 2);
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, 0, 0, 0);
  // Each cell shows its piece, or for 0.18 s after the search takes a
  // piece out, that piece's outline fading.
  for (let i = 0; i < bw * bh; i++) key[i] = cell[i] >= 0 ? cell[i] : ghost[i] >= 0 && gAge[i] < 0.18 ? 12 + ghost[i] : -1;
  const at = (x, y) => (x < 0 || y < 0 || x >= bw || y >= bh ? -2 : key[y * bw + x]);
  // A cell's own LEDs show its piece, a grid line between two cells of one
  // piece that piece, any other grid line the dark seam.
  pc.fill(-1);
  for (let Y = 0; Y < BH; Y++)
    for (let X = 0; X < BW; X++) {
      const gx = X % cs === 0, gy = Y % cs === 0, cx = floor(X / cs), cy = floor(Y / cs);
      let q;
      if (!gx && !gy) q = at(cx, cy);
      else if (gx && !gy) q = at(cx - 1, cy) === at(cx, cy) ? at(cx, cy) : -1;
      else if (!gx && gy) q = at(cx, cy - 1) === at(cx, cy) ? at(cx, cy) : -1;
      else {
        const a = at(cx - 1, cy - 1);
        q = a === at(cx, cy - 1) && a === at(cx - 1, cy) && a === at(cx, cy) ? a : -1;
      }
      pc[(oy + Y) * W + ox + X] = q;
    }
  // A light sweeps across the board while a solution holds.
  const band = S.hold > 0 ? -0.25 + 1.5 * cl(S.sweep, 0, 1) : -9;
  for (let Y = 0; Y < BH; Y++)
    for (let X = 0; X < BW; X++) {
      const p = (oy + Y) * W + ox + X, q = pc[p];
      const cx = min(bw - 1, floor(X / cs)), cy = min(bh - 1, floor(Y / cs)), ci = cy * bw + cx;
      const g = (X / BW + Y / BH) / 2 - band, lit = S.hold > 0 ? exp(-g * g * 90) : 0;
      if (q >= 0 && q < 12) {
        // A slight bevel: lighter next to a seam above or to the left,
        // darker next to one below or to the right.
        const up = pc[p - W] < 0 || pc[p - W] >= 12, lf = pc[p - 1] < 0 || pc[p - 1] >= 12;
        const dn = pc[p + W] < 0 || pc[p + W] >= 12, rt = pc[p + 1] < 0 || pc[p + 1] >= 12;
        const fresh = cl(1 - age[ci] / 0.15, 0, 1);
        const v = min(1, 0.82 + (up || lf ? 0.18 : 0) - (dn || rt ? 0.2 : 0) + 0.15 * fresh + 0.3 * lit);
        hsv(base + q / 12, (0.72 - 0.3 * fresh) * (1 - 0.7 * lit), 1, c);
        display.setPixel(ox + X, oy + Y, round(c[0] * 255 * v), round(c[1] * 255 * v), round(c[2] * 255 * v));
      } else if (q >= 12) {
        // A piece just taken out leaves its outline for a moment.
        if (pc[p - W] === q && pc[p + W] === q && pc[p - 1] === q && pc[p + 1] === q) continue;
        const f = cl(1 - gAge[ci] / 0.18, 0, 1);
        hsv(base + (q - 12) / 12, 0.6, 1, c);
        display.setPixel(ox + X, oy + Y, round(c[0] * 150 * f), round(c[1] * 150 * f), round(c[2] * 150 * f));
      } else if (X === 0 || Y === 0 || X === BW - 1 || Y === BH - 1) display.setPixel(ox + X, oy + Y, 44, 44, 54);
      else if (X % cs === 0 && Y % cs === 0) display.setPixel(ox + X, oy + Y, 40, 40, 48);
    }
  // One tick under the board for each solution this search has found, 31
  // to a row; a full row turns dim and the next starts over it.
  const ty = oy + BH + (oy > 6 ? 2 : 0), full = floor(S.found / 31), part = S.found % 31;
  for (let i = 0; i < 31; i++) {
    const on = i < part, x = 1 + 2 * i;
    if (!on && full === 0) continue;
    hsv(base + 0.1 * (on ? full : full - 1), on ? 0.25 : 0.5, 1, c);
    const v = on ? (i === part - 1 && S.hold > 0 ? 255 : 190) : 70;
    for (let y = ty; y < min(H, ty + 2); y++) display.setPixel(x, y, round(c[0] * v), round(c[1] * v), round(c[2] * v));
  }
}
