// ===== Patternflow pattern =====
// Title:   Lights Out
// Family:  algo
// Idea:    A random board of Lights Out the size of the panel is solved by light chasing: a front runs down pressing the cell below every lit cell, the lights turn into a record of presses behind it, the leftover on the bottom row is looked up as a set of presses on the top row, and a second chase runs the last lights off the bottom, leaving the record of what was pressed.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lights Out (Tiger Electronics, 1995), the sigma-plus game as linear algebra over GF(2) (Klaus Sutner, 1989), light chasing and the kernel (Marlow Anderson and Todd Feil, Turning Lights Out with Linear Algebra, 1998), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cells=1..4, Record=0..1
//
// Knob 1: Hue. Turns the board round the wheel: at 0 the lights are amber, the record of presses is sky blue and a press flashes white.
// Knob 2: Speed. At 2 a board is built in 0.6 s, the first chase runs down 127 rows in 2.4 s, the bottom row is looked up in 0.7 s and the second chase takes 2.0 s, 7.7 s a board in all. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Cells. Cell size in LEDs: 1 is a board of 64 by 128 cells, 2 is 32 by 64, 3 is 21 by 42, 4 is 16 by 32. Every one of these boards has a kernel of 0, so any pattern of lights has exactly one solution.
// Knob 4: Record. How long a press stays on the board. At 0.06 and below the record stays until the board is done, and when the second chase ends it is the one solution, cell for cell the random presses that built the board. Turned up, the record fades, at 1 within 0.2 s, and only the lights and the flashes of the chase are left, as on the toy.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, exp, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const WHITE = [1, 1, 1];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The game. Pressing a cell toggles it and its four neighbours. The
// board is a vector over GF(2) and a set of presses x lights A x, where A is
// the w h by w h matrix of the pluses; solving the board is solving A x = b.
function press(B, w, h, x, y) {
  const i = y * w + x;
  B[i] ^= 1;
  if (x > 0) B[i - 1] ^= 1;
  if (x < w - 1) B[i + 1] ^= 1;
  if (y > 0) B[i - w] ^= 1;
  if (y < h - 1) B[i + w] ^= 1;
}

// ---- Light chasing. Pressing the cell below every lit cell of a row clears
// that row and touches nothing above it, so chasing row 0 to row h - 2 leaves
// lights only on the bottom row. Chasing is linear: the leftover is the sum
// of what each top-row press alone would leave. Column j of the chase matrix
// is the bottom row that pressing top cell j and chasing leaves; to clear a
// leftover r, press the top-row set t with C t = r and chase again.
// Worked in Node for the four boards here (64x128, 32x64, 21x42, 16x32):
// C has full rank, so the kernel of A is 0 and every board is solvable. Three
// rows less is another story: 64x125 has a kernel of dimension 36, and 5x5,
// the toy, has 2.
function chaseMatrix(w, h) {
  const C = [], B = new Uint8Array(w * h);
  for (let j = 0; j < w; j++) {
    B.fill(0);
    press(B, w, h, j, 0);
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) if (B[y * w + x]) press(B, w, h, x, y + 1);
    C.push(B.slice((h - 1) * w));
  }
  return C;
}

// Gaussian elimination over GF(2) for C t = r; free columns, if a board ever
// has any, are left unpressed.
function solveTop(C, r, w) {
  const M = [];
  for (let i = 0; i < w; i++) {
    const row = new Uint8Array(w + 1);
    for (let j = 0; j < w; j++) row[j] = C[j][i];
    row[w] = r[i];
    M.push(row);
  }
  const piv = [];
  let k = 0;
  for (let c = 0; c < w && k < w; c++) {
    let p = -1;
    for (let i = k; i < w; i++) if (M[i][c]) { p = i; break; }
    if (p < 0) continue;
    const tmp = M[k]; M[k] = M[p]; M[p] = tmp;
    for (let i = 0; i < w; i++) if (i !== k && M[i][c]) for (let q = c; q <= w; q++) M[i][q] ^= M[k][q];
    piv.push(c);
    k++;
  }
  const t = new Uint8Array(w);
  for (let i = 0; i < piv.length; i++) t[piv[i]] = M[i][w];
  return t;
}

// ---- One board's life, in seconds at Speed 2.
const PH = ["build", "hold", "chase1", "resid", "correct", "chase2", "solved", "fade", "dark"];
const DUR = { build: 0.6, hold: 0.3, chase1: 2.4, resid: 0.7, correct: 0.35, chase2: 2.0, solved: 0.6, fade: 0.5, dark: 0.25 };

function sizeOf(S, c) {
  if (!S.cache[c]) {
    const w = floor(W / c), h = floor(H / c);
    S.cache[c] = { c, w, h, ox: floor((W - w * c) / 2), oy: floor((H - h * c) / 2), C: chaseMatrix(w, h) };
  }
  return S.cache[c];
}

function newBoard(S, c) {
  const z = sizeOf(S, c), n = z.w * z.h;
  S.z = z;
  S.L = new Uint8Array(n);
  S.R = new Uint8Array(n);
  S.age = new Float32Array(n).fill(99);
  S.fl = new Float32Array(n);
  S.fk = new Uint8Array(n);
  // The board is made the way the toy makes one: by pressing. Each cell is
  // pressed with probability one half, so the lights are a uniform draw from
  // the boards that can be solved (here all 2^(w h) of them).
  const g = [];
  for (let i = 0; i < n; i++) if (Math.random() < 0.5) g.push(i);
  for (let i = g.length - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = g[i];
    g[i] = g[j];
    g[j] = t;
  }
  S.g = g;
  S.gi = 0;
  S.ph = 0;
  S.u = 0;
  S.row = 0;
  S.t = null;
}

// Chase rows up to (not including) row `to`: press below each lit cell.
function chaseTo(S, to) {
  const { w, h } = S.z, L = S.L;
  for (; S.row < min(to, h - 1); S.row++) {
    const y = S.row;
    for (let x = 0; x < w; x++)
      if (L[y * w + x]) {
        const i = (y + 1) * w + x;
        press(L, w, h, x, y + 1);
        mark(S, i);
      }
  }
}

// A press goes into the record (presses are counted mod 2, so a second press
// on a cell takes the first back) and flashes: white when it adds to the
// record, rose when it cancels an earlier press.
function mark(S, i) {
  S.R[i] ^= 1;
  S.age[i] = 0;
  S.fl[i] = 1;
  S.fk[i] = S.R[i] ? 1 : 2;
}

function enter(S, ph) {
  S.ph = ph;
  S.u = 0;
  const { w, h } = S.z;
  if (PH[ph] === "chase1" || PH[ph] === "chase2") S.row = 0;
  if (PH[ph] === "resid") S.t = solveTop(S.z.C, S.L.subarray((h - 1) * w), w);
  if (PH[ph] === "correct")
    for (let x = 0; x < w; x++)
      if (S.t[x]) {
        press(S.L, w, h, x, 0);
        mark(S, x);
      }
}

export function setup(params) {
  params.s = { cache: {}, hue: 0, rec: 0.06, cells: 1, rgb: new Float32Array(NP * 3) };
  newBoard(params.s, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rec = cl(k[3], 0, 1);
  const c = cl(round(k[2]), 1, 4);
  if (c !== S.cells) {
    S.cells = c;
    newBoard(S, c);
  }
  // step is board time: seconds at Speed 2.
  const step = (d * cl(k[1], 0.2, 3)) / 2, n = S.L.length, ff = exp(-step * 14);
  for (let i = 0; i < n; i++) {
    S.age[i] += step;
    S.fl[i] *= ff;
  }
  S.u += step;
  for (let guard = 0; guard < 16; guard++) {
    const name = PH[S.ph], T = DUR[name], u = cl(S.u / T, 0, 1);
    const { w, h } = S.z;
    if (name === "build") {
      const to = floor(S.g.length * u);
      for (; S.gi < to; S.gi++) {
        const i = S.g[S.gi];
        press(S.L, w, h, i % w, floor(i / w));
        S.fl[i] = max(S.fl[i], 0.55);
        S.fk[i] = 0;
      }
    } else if (name === "chase1" || name === "chase2") chaseTo(S, floor(u * (h - 1) + 1e-9));
    if (S.u < T) break;
    S.u -= T;
    if (name === "dark") newBoard(S, S.cells);
    else enter(S, S.ph + 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { c, w, h, ox, oy } = S.z, rgb = S.rgb;
  const lit = hsv(0.11 + S.hue, 0.78, 0.86), rec = hsv(0.56 + S.hue, 0.72, 0.72), undo = hsv(0.94 + S.hue, 0.6, 1);
  const name = PH[S.ph], u = cl(S.u / DUR[name], 0, 1);
  // The fade at the end of a board, and a blink on the leftover bottom row.
  const all = name === "fade" ? 1 - u : name === "dark" ? 0 : 1;
  const blink = name === "resid" ? 0.35 + 0.65 * (0.5 + 0.5 * cos(u * 4 * PI)) : 1;
  // Record fade per second of press age: 0 up to Record 0.06, 30 at 1.
  const rate = (30 * max(0, S.rec - 0.06)) / 0.94;
  rgb.fill(0);
  const g = c >= 3 ? 1 : 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      let r = 0, gg = 0, b = 0;
      if (S.L[q]) {
        const a = j === h - 1 && name === "resid" ? blink : 1;
        r = lit[0] * a;
        gg = lit[1] * a;
        b = lit[2] * a;
      } else if (S.R[q]) {
        const a = exp(-rate * S.age[q]);
        r = rec[0] * a;
        gg = rec[1] * a;
        b = rec[2] * a;
      }
      const f = cl(S.fl[q], 0, 1), fc = S.fk[q] === 2 ? undo : WHITE;
      r = (r + (fc[0] - r) * f) * all;
      gg = (gg + (fc[1] - gg) * f) * all;
      b = (b + (fc[2] - b) * f) * all;
      if (r + gg + b <= 0) continue;
      for (let yy = 0; yy < c - g; yy++)
        for (let xx = 0; xx < c - g; xx++) {
          const o = ((oy + j * c + yy) * W + ox + i * c + xx) * 3;
          rgb[o] = r;
          rgb[o + 1] = gg;
          rgb[o + 2] = b;
        }
    }
  // The lookup: a thin line rises from the leftover row to the top row,
  // where the presses it found land.
  if (name === "resid" && u > 0.45) {
    const y = floor(oy + (h * c - 1) * (1 - (u - 0.45) / 0.55));
    for (let x = ox; x < ox + w * c; x++) {
      const o = (y * W + x) * 3;
      rgb[o] = max(rgb[o], 0.5);
      rgb[o + 1] = max(rgb[o + 1], 0.5);
      rgb[o + 2] = max(rgb[o + 2], 0.5);
    }
  }
  for (let p = 0; p < NP; p++)
    display.setPixel(p % W, floor(p / W), min(255, rgb[p * 3] * 255) | 0, min(255, rgb[p * 3 + 1] * 255) | 0, min(255, rgb[p * 3 + 2] * 255) | 0);
}
